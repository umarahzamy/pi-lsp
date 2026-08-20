import fs from "node:fs";
import path from "node:path";
import {
	getOrCreateClient,
	syncContent,
	waitForDiagnostics,
} from "./client.js";
import { getServersForFile } from "./config.js";
import type { Diagnostic } from "./types.js";
import { formatDiagnostic, sortDiagnostics } from "./utils.js";

type CollectResult = { server: string; messages: string[]; errored: boolean };

export const collectDiagnostics = async (
	absPath: string,
	cwd: string,
	signal?: AbortSignal,
): Promise<CollectResult | null> => {
	const servers = getServersForFile(cwd, absPath);
	if (servers.length === 0) return null;

	let content: string;
	try {
		content = await fs.promises.readFile(absPath, "utf-8");
	} catch {
		return null;
	}

	const all: Diagnostic[] = [];
	const names: string[] = [];

	const results = await Promise.allSettled(
		servers.map(async ([name, cfg]) => {
			const client = await getOrCreateClient(cfg, cwd, signal);
			await syncContent(client, absPath, content, signal);
			const diags = await waitForDiagnostics(client, absPath, {
				timeoutMs: 1200,
				signal,
			});
			return { name, diags };
		}),
	);

	for (const r of results) {
		if (r.status === "fulfilled") {
			names.push(r.value.name);
			all.push(...r.value.diags);
		}
	}

	if (names.length === 0) return null;
	if (all.length === 0)
		return { server: names.join(","), messages: [], errored: false };

	const seen = new Set<string>();
	const uniq: Diagnostic[] = [];
	for (const d of all) {
		const k = `${d.range.start.line}:${d.range.start.character}:${d.message}`;
		if (!seen.has(k)) {
			seen.add(k);
			uniq.push(d);
		}
	}
	sortDiagnostics(uniq);
	const rel = path.relative(cwd, absPath) || path.basename(absPath);
	const messages = uniq.slice(0, 20).map((d) => formatDiagnostic(d, rel));
	const errored = uniq.some((d) => d.severity === 1);
	return { server: names.join(","), messages, errored };
};

export const formatMessages = (
	absPath: string,
	cwd: string,
	res: CollectResult,
): string => {
	const rel = path.relative(cwd, absPath) || absPath;
	if (res.messages.length === 0) return `✓ ${rel}: no issues`;
	const head = res.errored
		? `✗ ${rel}: ${res.messages.length} issue(s)`
		: `⚠ ${rel}: ${res.messages.length} issue(s)`;
	return `${head}\n${res.messages.join("\n")}`;
};

export const diagnosticsFromDiskFallback = async (
	absPath: string,
	cwd: string,
): Promise<string | null> => {
	if (!absPath.endsWith(".ts") && !absPath.endsWith(".tsx")) return null;
	try {
		const { spawnSync } = await import("node:child_process");
		const r = spawnSync("npx", ["tsc", "--noEmit", "--pretty", "false"], {
			cwd,
			encoding: "utf-8",
			timeout: 8000,
		});
		const out = (r.stdout + r.stderr).trim();
		if (!out) return null;
		const lines = out
			.split("\n")
			.filter(
				(l) => l.includes(absPath) || l.includes(path.relative(cwd, absPath)),
			);
		return lines.slice(0, 20).join("\n") || null;
	} catch {
		return null;
	}
};
