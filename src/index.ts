import fs from "node:fs";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { shutdownAll } from "./client.js";
import { collectDiagnostics, formatMessages } from "./diagnostics.js";

type EditInput = {
	path: string;
	edits: Array<{ oldText: string; newText: string }>;
};
type WriteInput = { path: string; content: string };

const isEditInput = (v: object): v is EditInput => {
	return (
		"path" in v &&
		"edits" in v &&
		typeof Reflect.get(v, "path") === "string" &&
		Array.isArray(Reflect.get(v, "edits"))
	);
};

const isWriteInput = (v: object): v is WriteInput => {
	return (
		"path" in v &&
		"content" in v &&
		typeof Reflect.get(v, "path") === "string" &&
		typeof Reflect.get(v, "content") === "string"
	);
};

const resolveAbs = (p: string, cwd: string): string =>
	path.isAbsolute(p) ? p : path.join(cwd, p);

const shouldHandle = (name: string): boolean =>
	name === "edit" || name === "write";

const appendDiagnostics = async (
	absPath: string,
	cwd: string,
	signal?: AbortSignal,
): Promise<string | null> => {
	try {
		await fs.promises.access(absPath);
	} catch {
		return null;
	}
	const res = await collectDiagnostics(absPath, cwd, signal);
	if (!res) return null;
	if (res.messages.length === 0) return formatMessages(absPath, cwd, res);
	return formatMessages(absPath, cwd, res);
};

export default (pi: ExtensionAPI) => {
	pi.on("session_shutdown", async () => {
		await shutdownAll();
	});

	pi.on("tool_result", async (event, ctx) => {
		if (!shouldHandle(event.toolName)) return;
		if (event.isError) return;

		const input = event.input;
		let absPath: string | null = null;
		if (input && typeof input === "object" && isEditInput(input))
			absPath = resolveAbs(input.path, ctx.cwd);
		else if (input && typeof input === "object" && isWriteInput(input))
			absPath = resolveAbs(input.path, ctx.cwd);
		if (!absPath) return;

		// delegation to getServersForFile via collectDiagnostics handles other extensions; quick prefilter via ext is no longer needed
		// keep fast-path for obviously non-code (images etc) but allow all text-ish handled by lsp.json
		const ext = path.extname(absPath).toLowerCase();
		if (
			[
				".png",
				".jpg",
				".jpeg",
				".gif",
				".webp",
				".ico",
				".pdf",
				".zip",
				".tar",
				".gz",
			].includes(ext)
		)
			return;

		const rel = path.relative(ctx.cwd, absPath) || path.basename(absPath);
		if (ctx.hasUI) ctx.ui.setStatus("lsp", `diagnostics ${rel}…`);
		try {
			const text = await appendDiagnostics(absPath, ctx.cwd, ctx.signal);
			if (!text) return;
			const isOk = text.startsWith("✓");
			const hasErrors = text.startsWith("✗") || text.startsWith("⚠");
			if (!hasErrors && isOk)
				return { content: [...event.content, { type: "text", text }] };
			if (hasErrors)
				return {
					content: [
						...event.content,
						{ type: "text", text: `\n--- lsp diagnostics ---\n${text}` },
					],
				};
		} catch {
		} finally {
			if (ctx.hasUI) ctx.ui.setStatus("lsp", undefined);
		}
	});
};
