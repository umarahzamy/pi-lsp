import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import fs from "node:fs";
import type { MessageConnection } from "vscode-jsonrpc";
import {
	createMessageConnection,
	StreamMessageReader,
	StreamMessageWriter,
} from "vscode-jsonrpc/node";
import type { Diagnostic, ResolvedServerConfig } from "./types.js";
import { detectLanguageId, fileToUri } from "./utils.js";

type PublishedDiagnostics = {
	version: number | null;
	diagnostics: Diagnostic[];
};

type LspClient = {
	key: string;
	cwd: string;
	proc: ChildProcess;
	connection: MessageConnection;
	openFiles: Map<string, number>;
	diagnostics: Map<string, PublishedDiagnostics>;
};

const clients = new Map<string, LspClient>();
const locks = new Map<string, Promise<LspClient>>();

export const clientKey = (cmd: string, cwd: string): string => `${cmd}:${cwd}`;

export const getActiveClients = (): LspClient[] => [...clients.values()];

export const shutdownAll = async (): Promise<void> => {
	const all = [...clients.values()];
	clients.clear();
	locks.clear();
	for (const c of all) {
		try {
			c.connection.sendNotification("shutdown");
		} catch {}
		try {
			c.connection.dispose();
		} catch {}
		try {
			c.proc.kill();
		} catch {}
	}
};

const getCmd = (cfg: ResolvedServerConfig): string[] => {
	if (cfg.cmd && cfg.cmd.length > 0) return cfg.cmd;
	if (cfg.command) return [cfg.command, ...(cfg.args ?? [])];
	return [];
};

const createClient = async (
	cfg: ResolvedServerConfig,
	cwd: string,
	signal?: AbortSignal,
): Promise<LspClient> => {
	const cmd = getCmd(cfg);
	const key = clientKey(cmd[0] ?? cfg.command ?? "", cwd);
	const proc = spawn(cfg.resolved, cmd.slice(1), {
		cwd,
		stdio: ["pipe", "pipe", "pipe"],
	});
	const connection = createMessageConnection(
		new StreamMessageReader(proc.stdout!),
		new StreamMessageWriter(proc.stdin!),
	);

	const client: LspClient = {
		key,
		cwd,
		proc,
		connection,
		openFiles: new Map(),
		diagnostics: new Map(),
	};

	connection.onNotification(
		"textDocument/publishDiagnostics",
		(p: {
			uri: string;
			version?: number | null;
			diagnostics: Diagnostic[];
		}) => {
			client.diagnostics.set(p.uri, {
				version: p.version ?? null,
				diagnostics: p.diagnostics,
			});
		},
	);

	connection.onRequest(
		"workspace/configuration",
		(p: { items: Array<{ section?: string }> }) =>
			(p.items ?? []).map(() => null),
	);
	connection.onRequest("workspace/workspaceFolders", () => [
		{ uri: fileToUri(cwd), name: cwd },
	]);
	connection.onRequest("client/registerCapability", () => null);
	connection.onRequest("client/unregisterCapability", () => null);
	connection.onNotification("window/workDoneProgress/create", () => {});

	connection.listen();
	proc.on("exit", () => {
		if (clients.get(key) === client) clients.delete(key);
		connection.dispose();
	});

	if (signal?.aborted) throw new Error("aborted");
	type InitializeResult = { capabilities: object };
	const init = await connection.sendRequest<InitializeResult>("initialize", {
		processId: process.pid,
		rootUri: fileToUri(cwd),
		capabilities: {
			textDocument: {
				publishDiagnostics: { versionSupport: true },
				synchronization: { didSave: true, dynamicRegistration: false },
			},
			workspace: { workspaceFolders: true, configuration: true },
		},
		initializationOptions: {},
		workspaceFolders: [{ uri: fileToUri(cwd), name: cwd }],
	});

	if (!init) throw new Error("initialize failed");
	await connection.sendNotification("initialized", {});
	await connection.sendNotification("workspace/didChangeConfiguration", {
		settings: {},
	});
	clients.set(key, client);
	return client;
};

export const getOrCreateClient = async (
	cfg: ResolvedServerConfig,
	cwd: string,
	signal?: AbortSignal,
): Promise<LspClient> => {
	const cmd = getCmd(cfg);
	const key = clientKey(cmd[0] ?? cfg.command ?? "", cwd);
	const existing = clients.get(key);
	if (existing) return existing;
	const locked = locks.get(key);
	if (locked) return locked;
	const p = createClient(cfg, cwd, signal).finally(() => locks.delete(key));
	locks.set(key, p);
	return p;
};

export const ensureFileOpen = async (
	client: LspClient,
	absPath: string,
	signal?: AbortSignal,
): Promise<void> => {
	const uri = fileToUri(absPath);
	if (client.openFiles.has(uri)) return;
	let content: string;
	try {
		content = await fs.promises.readFile(absPath, "utf-8");
	} catch {
		return;
	}
	if (signal?.aborted) throw new Error("aborted");
	const version = 1;
	client.openFiles.set(uri, version);
	client.diagnostics.delete(uri);
	await client.connection.sendNotification("textDocument/didOpen", {
		textDocument: {
			uri,
			languageId: detectLanguageId(absPath),
			version,
			text: content,
		},
	});
};

export const syncContent = async (
	client: LspClient,
	absPath: string,
	content: string,
	_signal?: AbortSignal,
): Promise<void> => {
	const uri = fileToUri(absPath);
	client.diagnostics.delete(uri);
	const cur = client.openFiles.get(uri);
	if (cur === undefined) {
		const version = 1;
		client.openFiles.set(uri, version);
		await client.connection.sendNotification("textDocument/didOpen", {
			textDocument: {
				uri,
				languageId: detectLanguageId(absPath),
				version,
				text: content,
			},
		});
		return;
	}
	const version = cur + 1;
	client.openFiles.set(uri, version);
	await client.connection.sendNotification("textDocument/didChange", {
		textDocument: { uri, version },
		contentChanges: [{ text: content }],
	});
	await client.connection.sendNotification("textDocument/didSave", {
		textDocument: { uri },
	});
};

export const waitForDiagnostics = async (
	client: LspClient,
	absPath: string,
	opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<Diagnostic[]> => {
	const uri = fileToUri(absPath);
	const expected = client.openFiles.get(uri) ?? null;
	const deadline = Date.now() + (opts.timeoutMs ?? 800);
	let lastRef: PublishedDiagnostics | undefined;
	let settledAt = 0;
	const settleMs = 180;
	while (Date.now() < deadline) {
		if (opts.signal?.aborted) throw new Error("aborted");
		const cur = client.diagnostics.get(uri);
		if (cur) {
			if (expected !== null && cur.version === expected) return cur.diagnostics;
			if (cur !== lastRef) {
				lastRef = cur;
				settledAt = Date.now();
			} else if (Date.now() - settledAt >= settleMs) return cur.diagnostics;
		}
		await new Promise((r) => setTimeout(r, 50));
	}
	return client.diagnostics.get(uri)?.diagnostics ?? [];
};
