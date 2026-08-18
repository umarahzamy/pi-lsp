import { readFileSync, statSync } from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createMessageConnection, StreamMessageReader, StreamMessageWriter, type MessageConnection } from "vscode-jsonrpc/node";
import { pathToUri, type Diagnostic, type LspParams } from "./protocol.ts";

export type ServerCommand = { name: string; cmd: string[]; root: string };

type DiagnosticNotification = { uri: string; diagnostics?: Diagnostic[] };

export type StandaloneClient = {
  readonly name: string;
  readonly root: string;
  readonly command: string[];
  readonly isReady: () => boolean;
  readonly stderr: () => string;
  readonly diagnosticStore: ReadonlyMap<string, Diagnostic[]>;
  readonly isOpen: (file: string) => boolean;
  readonly start: (timeout?: number) => Promise<void>;
  readonly request: <T>(method: string, params: LspParams, timeout?: number) => Promise<T>;
  readonly notify: (method: string, params: LspParams) => Promise<void>;
  readonly open: (file: string) => Promise<void>;
  readonly change: (file: string) => Promise<void>;
  readonly getDiagnostics: (file?: string) => Diagnostic[];
  readonly syncDocument: (file: string, timeout?: number, force?: boolean) => Promise<void>;
  readonly stop: () => Promise<void>;
};

const languageId = (file: string): string => {
  const name = file.toLowerCase();
  if (name.endsWith(".c") || name.endsWith(".h")) return "c";
  if (name.endsWith(".cpp") || name.endsWith(".cc") || name.endsWith(".cxx") || name.endsWith(".hpp") || name.endsWith(".hxx")) return "cpp";
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "typescript";
  if (name.endsWith(".js") || name.endsWith(".jsx")) return "javascript";
  if (name.endsWith(".py")) return "python";
  if (name.endsWith(".rs")) return "rust";
  if (name.endsWith(".go")) return "go";
  if (name.endsWith(".lua")) return "lua";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".yaml") || name.endsWith(".yml")) return "yaml";
  return "plaintext";
};

const isPipeError = (error: unknown): boolean => {
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === "EPIPE" || code === "ERR_STREAM_DESTROYED" || code === "ECONNRESET") return true;
  const msg = String(error);
  return msg.includes("EPIPE") || msg.includes("ERR_STREAM_DESTROYED");
};

const withTimeout = async <T>(promise: Promise<T> | undefined, timeout: number, operation: string, clientName: string): Promise<T> => {
  if (!promise) throw new Error(`${clientName} is not running`);
  let timer: NodeJS.Timeout | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${clientName} request timed out: ${operation}`)), timeout);
  });
  try {
    return await Promise.race([promise, limit]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const createStandaloneClient = (spec: ServerCommand): StandaloneClient => {
  const { name, root, cmd: command } = spec;

  let child: ChildProcessWithoutNullStreams | null = null;
  let connection: MessageConnection | null = null;
  const versions = new Map<string, number>();
  const openFiles = new Set<string>();
  const lastSentText = new Map<string, string>();
  const lastSyncTime = new Map<string, number>();
  const diagnostics = new Map<string, Diagnostic[]>();
  const diagVersions = new Map<string, number>();
  let ready = false;
  let stderrText = "";
  const diagWaiters = new Map<string, Set<(version: number) => void>>();

  const failReady = (): void => {
    ready = false;
    for (const waiters of diagWaiters.values()) {
      for (const done of waiters) done((diagVersions.get("") ?? 0) + 1);
    }
    diagWaiters.clear();
  };

  const waitForVersion = (uri: string, since: number, timeout: number): Promise<void> => {
    if ((diagVersions.get(uri) ?? 0) > since) return Promise.resolve();
    if (!ready) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        diagWaiters.get(uri)?.delete(done);
        resolve();
      }, timeout);
      const done = (version: number) => {
        if (version <= since) return;
        clearTimeout(timer);
        resolve();
      };
      const set = diagWaiters.get(uri) ?? new Set<(version: number) => void>();
      set.add(done);
      diagWaiters.set(uri, set);
    });
  };

  const start = async (timeout = 10000): Promise<void> => {
    if (ready) return;
    const [program, ...args] = command;
    if (!program) throw new Error(`No command configured for ${name}`);
    child = spawn(program, args, { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrText += chunk.toString();
    });
    child.stdin.on("error", (error) => {
      if (isPipeError(error)) failReady();
      else stderrText += String(error);
    });
    child.stdout.on("error", (error) => {
      if (isPipeError(error)) failReady();
      else stderrText += String(error);
    });
    child.on("exit", () => {
      failReady();
      connection?.dispose();
    });
    child.on("error", (error) => {
      failReady();
      stderrText += String(error);
      connection?.dispose();
    });
    child.on("close", () => failReady());
    connection = createMessageConnection(
      new StreamMessageReader(child.stdout),
      new StreamMessageWriter(child.stdin),
      { error: () => {}, warn: () => {}, info: () => {}, log: () => {}, debug: () => {} } as never,
    );
    connection.onError(([error]) => {
      if (isPipeError(error)) failReady();
    });
    connection.onClose(() => failReady());
    connection.onDispose(() => failReady());
    connection.onNotification("textDocument/publishDiagnostics", (params: DiagnosticNotification) => {
      if (!params.uri) return;
      const version = (diagVersions.get(params.uri) ?? 0) + 1;
      diagVersions.set(params.uri, version);
      diagnostics.set(params.uri, params.diagnostics ?? []);
      diagWaiters.get(params.uri)?.forEach((done) => done(version));
      diagWaiters.delete(params.uri);
    });
    connection.listen();
    let initialized: unknown;
    try {
      initialized = await withTimeout(
        connection.sendRequest("initialize", {
          processId: globalThis.process.pid,
          rootUri: pathToUri(root),
          workspaceFolders: [{ uri: pathToUri(root), name: root.split(/[\\/]/).at(-1) ?? "workspace" }],
          capabilities: {
            workspace: { workspaceEdit: { documentChanges: true }, applyEdit: false },
            textDocument: { publishDiagnostics: { relatedInformation: true } },
          },
          clientInfo: { name: "pi-lsp", version: "0.1.0" },
        }),
        timeout,
        "initialize",
        name,
      );
    } catch (error) {
      if (isPipeError(error)) {
        failReady();
        throw new Error(`${name} pipe broke during initialize: ${String(error)}`);
      }
      throw error;
    }
    if (initialized === undefined) throw new Error(`${name} returned no initialize result`);
    try {
      await notify("initialized", {});
    } catch (error) {
      if (isPipeError(error)) {
        failReady();
        throw new Error(`${name} pipe broke during initialized: ${String(error)}`);
      }
      throw error;
    }
    ready = true;
  };

  const request = async <T>(method: string, params: LspParams, timeout = 10000): Promise<T> => {
    if (!connection) throw new Error(`${name} is not running`);
    try {
      return await withTimeout(connection.sendRequest(method, params), timeout, method, name);
    } catch (error) {
      if (isPipeError(error)) failReady();
      throw error;
    }
  };

  const notify = async (method: string, params: LspParams): Promise<void> => {
    if (!connection || !ready) return;
    try {
      await connection.sendNotification(method, params);
    } catch (error) {
      if (isPipeError(error)) {
        failReady();
        return;
      }
      throw error;
    }
  };

  const open = async (file: string): Promise<void> => {
    if (!ready) await start();
    const text = readFileSync(file, "utf8");
    const uri = pathToUri(file);
    const version = (versions.get(uri) ?? 0) + 1;
    versions.set(uri, version);
    openFiles.add(uri);
    await notify("textDocument/didOpen", { textDocument: { uri, languageId: languageId(file), version, text } });
  };

  const change = async (file: string): Promise<void> => {
    if (!ready) await start();
    const text = readFileSync(file, "utf8");
    const uri = pathToUri(file);
    const version = (versions.get(uri) ?? 0) + 1;
    versions.set(uri, version);
    await notify("textDocument/didChange", { textDocument: { uri, version }, contentChanges: [{ text }] });
  };

  const getDiagnostics = (file?: string): Diagnostic[] => {
    if (!file) return [...diagnostics.values()].flat();
    return diagnostics.get(pathToUri(file)) ?? [];
  };

  const syncDocument = async (file: string, timeout = 8000, force = false): Promise<void> => {
    if (!ready) await start();
    const uri = pathToUri(file);
    const text = readFileSync(file, "utf8");
    const mtime = statSync(file).mtimeMs;
    const lastSync = lastSyncTime.get(uri) ?? 0;
    const contentChanged = lastSentText.get(uri) !== text;
    const fileChangedExternally = mtime > lastSync;
    if (openFiles.has(uri)) {
      if (!force && !contentChanged && !fileChangedExternally) return;
      const since = diagVersions.get(uri) ?? 0;
      lastSentText.set(uri, text);
      lastSyncTime.set(uri, Date.now());
      const version = (versions.get(uri) ?? 0) + 1;
      versions.set(uri, version);
      await notify("textDocument/didChange", { textDocument: { uri, version }, contentChanges: [{ text }] });
      await waitForVersion(uri, since, timeout);
    } else {
      lastSentText.set(uri, text);
      lastSyncTime.set(uri, Date.now());
      await open(file);
      await waitForVersion(uri, 0, timeout);
    }
  };

  const stop = async (): Promise<void> => {
    if (ready) {
      try {
        await withTimeout(connection?.sendRequest("shutdown", null), 2000, "shutdown", name);
      } catch {
        /* server may be gone */
      }
      try {
        await notify("exit", {});
      } catch {
        /* stream may already be gone */
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    connection?.dispose();
    child?.kill();
    connection = null;
    child = null;
    ready = false;
    openFiles.clear();
    lastSentText.clear();
    failReady();
  };

  return {
    name,
    root,
    command,
    isReady: () => ready,
    stderr: () => stderrText.slice(-4000),
    diagnosticStore: diagnostics,
    isOpen: (file: string) => openFiles.has(pathToUri(file)),
    start,
    request,
    notify,
    open,
    change,
    getDiagnostics,
    syncDocument,
    stop,
  };
};
