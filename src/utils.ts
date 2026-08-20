import path from "node:path";
import type { Diagnostic } from "./types.js";

export const fileToUri = (filePath: string): string => {
	const abs = path.resolve(filePath);
	return `file://${abs}`;
};

export const uriToFile = (uri: string): string => {
	if (uri.startsWith("file://")) return uri.slice(7);
	return uri;
};

export const detectLanguageId = (filePath: string): string => {
	const ext = path.extname(filePath).toLowerCase();
	if (ext === ".ts") return "typescript";
	if (ext === ".tsx") return "typescriptreact";
	if (ext === ".js") return "javascript";
	if (ext === ".jsx") return "javascriptreact";
	if (ext === ".mjs" || ext === ".cjs") return "javascript";
	if (ext === ".py") return "python";
	if (ext === ".rs") return "rust";
	if (ext === ".go") return "go";
	return "plaintext";
};

export const formatDiagnostic = (d: Diagnostic, rel: string): string => {
	const line = d.range.start.line + 1;
	const col = d.range.start.character + 1;
	const sev =
		d.severity === 1
			? "error"
			: d.severity === 2
				? "warning"
				: d.severity === 3
					? "info"
					: "hint";
	const src = d.source ? ` [${d.source}]` : "";
	return `${rel}:${line}:${col} [${sev}]${src} ${d.message}`;
};

export const sortDiagnostics = (list: Diagnostic[]): void => {
	list.sort((a, b) => {
		if (a.range.start.line !== b.range.start.line)
			return a.range.start.line - b.range.start.line;
		if (a.range.start.character !== b.range.start.character)
			return a.range.start.character - b.range.start.character;
		return (a.severity ?? 4) - (b.severity ?? 4);
	});
};
