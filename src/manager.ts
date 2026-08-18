import { statSync } from "node:fs";
import { extname } from "node:path";
import { discoverInventory, serverSpec, type Inventory, type InventoryEntry } from "./discovery.ts";
import { createStandaloneClient, type StandaloneClient } from "./standalone-client.ts";
import {
  normalizeDiagnostics,
  normalizePath,
  projectRootFromMarkers,
  type NormalizedDiagnostic,
} from "./protocol.ts";

export type OperationResult<T = NormalizedDiagnostic[]> = {
  value: T;
  server: string;
  elapsedMs: number;
};

export type LspManager = {
  readonly projectRoot: string;
  readonly configured: InventoryEntry[];
  readonly initialize: () => Inventory;
  readonly refresh: () => Inventory;
  readonly stop: () => Promise<void>;
  readonly restart: (server?: string) => Promise<string[]>;
  readonly queryDiagnostics: (file: string, server?: string) => Promise<OperationResult<NormalizedDiagnostic[]>>;
  readonly syncFile: (file: string, opts?: { server?: string; force?: boolean }) => Promise<OperationResult<NormalizedDiagnostic[]>>;
  readonly queryAllDiagnostics: () => NormalizedDiagnostic[];
  readonly status: () => {
    root: string;
    clients: Array<{ key: string; ready: boolean; stderr: string }>;
    servers: Array<InventoryEntry & { state: string; failures?: string }>;
  };
};

const EXTENSIONS: Record<string, string[]> = {
  ".ts": ["vtsls"], ".tsx": ["vtsls"], ".js": ["vtsls"], ".jsx": ["vtsls"],
  ".py": ["basedpyright"], ".sh": ["bashls"], ".bash": ["bashls"],
  ".go": ["gopls"], ".rs": ["rust_analyzer"], ".c": ["clangd"], ".h": ["clangd"],
  ".cpp": ["clangd"], ".cc": ["clangd"], ".cxx": ["clangd"], ".hpp": ["clangd"], ".hxx": ["clangd"], ".java": ["jdtls"], ".kt": ["kotlin_language_server"],
  ".lua": ["lua_ls"], ".luau": ["luau_lsp"], ".php": ["phpactor"], ".astro": ["astro"],
  ".svelte": ["svelte"], ".vue": ["volar"], ".css": ["cssls"], ".html": ["html"],
  ".json": ["jsonls"], ".yaml": ["yamlls"], ".yml": ["yamlls"], ".tf": ["terraformls"],
  ".typ": ["tinymist"], ".toml": ["taplo", "lua_ls"],
};

export const createLspManager = (cwd: string): LspManager => {
  const root = projectRootFromMarkers(cwd);
  let inventory: Inventory = { entries: [], updatedAt: 0 };
  const clients = new Map<string, StandaloneClient>();
  const failures = new Map<string, string>();
  const readyServers = new Set<string>();
  const lastSynced = new Map<string, { mtimeMs: number; size: number }>();

  const diskSignature = (file: string): { mtimeMs: number; size: number } | null => {
    try {
      const stats = statSync(file);
      return { mtimeMs: stats.mtimeMs, size: stats.size };
    } catch {
      return null;
    }
  };

  const selectServer = (file: string, preferred?: string): string | null => {
    const names = preferred ? [preferred] : EXTENSIONS[extname(file).toLowerCase()] ?? [];
    const configured = new Set(inventory.entries.map((entry) => entry.name));
    return names.find((name) => configured.has(name)) ?? null;
  };

  const getClient = async (name: string, spec: { name: string; cmd: string[]; root: string }): Promise<StandaloneClient> => {
    const key = `${name}:${root}`;
    const existing = clients.get(key);
    if (existing?.isReady()) return existing;
    if (existing) await existing.stop();
    const client = createStandaloneClient(spec);
    clients.set(key, client);
    try {
      await client.start();
      return client;
    } catch (error) {
      await client.stop();
      failures.set(name, String(error));
      throw error;
    }
  };

  const initialize = (): Inventory => {
    inventory = discoverInventory(root);
    return inventory;
  };

  const refresh = (): Inventory => {
    inventory = discoverInventory(root);
    return inventory;
  };

  const stop = async (): Promise<void> => {
    await Promise.all([...clients.values()].map((client) => client.stop()));
    clients.clear();
    lastSynced.clear();
  };

  const restart = async (server?: string): Promise<string[]> => {
    const targets = server ? [...clients.entries()].filter(([key]) => key.startsWith(`${server}:`)) : [...clients.entries()];
    for (const [key, client] of targets) {
      await client.stop();
      clients.delete(key);
    }
    lastSynced.clear();
    return targets.map(([key]) => key);
  };

  const queryDiagnostics = async (file: string, server?: string): Promise<OperationResult<NormalizedDiagnostic[]>> => {
    return syncFile(file, { server, force: true });
  };

  const syncFile = async (file: string, opts: { server?: string; force?: boolean } = {}): Promise<OperationResult<NormalizedDiagnostic[]>> => {
    const started = Date.now();
    const abs = normalizePath(file, root);
    const name = selectServer(abs, opts.server);
    if (!name) throw new Error(`No configured LSP server for ${extname(abs) || abs}`);
    const spec = serverSpec(inventory, name, root);
    if (!spec) throw new Error(`LSP server unavailable: ${name}`);

    const client = await getClient(name, spec);
    const sig = diskSignature(abs);
    const last = lastSynced.get(abs);
    if (!opts.force && sig && last && last.mtimeMs === sig.mtimeMs && last.size === sig.size) {
      const diags = client.getDiagnostics(abs);
      const value = normalizeDiagnostics(diags, abs);
      readyServers.add(name);
      return { value, server: name, elapsedMs: Date.now() - started };
    }

    await client.syncDocument(abs, 8000, opts.force);
    if (sig) lastSynced.set(abs, sig);
    else lastSynced.delete(abs);

    const diags = client.getDiagnostics(abs);
    const value = normalizeDiagnostics(diags, abs);

    readyServers.add(name);
    return { value, server: name, elapsedMs: Date.now() - started };
  };

  const queryAllDiagnostics = (): NormalizedDiagnostic[] => {
    const all: NormalizedDiagnostic[] = [];
    for (const client of clients.values()) {
      for (const [uri, diags] of client.diagnosticStore) {
        const file = uri.startsWith("file://") ? decodeURI(uri.slice(7)) : uri;
        all.push(...normalizeDiagnostics(diags, file));
      }
    }
    return all;
  };

  const status = () => {
    return {
      root,
      clients: [...clients.entries()].map(([key, client]) => ({ key, ready: client.isReady(), stderr: client.stderr() })),
      servers: inventory.entries.map((entry) => {
        const client = [...clients.entries()].find(([key]) => key.startsWith(`${entry.name}:`))?.[1];
        const failure = failures.get(entry.name);
        const state = !entry.available ? "missing" : readyServers.has(entry.name) || client?.isReady() ? "ready" : failure ? "failed" : "configured";
        return { ...entry, state, failures: failure };
      }),
    };
  };

  return {
    projectRoot: root,
    configured: inventory.entries,
    initialize,
    refresh,
    stop,
    restart,
    queryDiagnostics,
    syncFile,
    queryAllDiagnostics,
    status,
  };
};
