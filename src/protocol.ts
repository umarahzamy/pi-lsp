import { existsSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

// LSP Protocol Types
export type Position = { line: number; character: number };
export type Range = { start: Position; end: Position };

export type Diagnostic = {
  range: Range;
  severity?: number;
  code?: string | number;
  source?: string;
  message: string;
};

export type NormalizedDiagnostic = {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  severity: string;
  message: string;
  code?: string | number;
  source?: string;
};

export type DidOpenTextDocumentParams = {
  textDocument: { uri: string; languageId: string; version: number; text: string };
};

export type DidChangeTextDocumentParams = {
  textDocument: { uri: string; version: number };
  contentChanges: Array<{ text: string }>;
};

export type LspParams =
  | DidOpenTextDocumentParams
  | DidChangeTextDocumentParams
  | Record<string, never>
  | null;

// Path/URI utilities
export function pathToUri(file: string): string {
  return pathToFileURL(resolve(file)).toString();
}

export function uriToPath(uri: string): string {
  if (uri.startsWith("file://")) return fileURLToPath(uri);
  return uri;
}

export function normalizePath(file: string, root: string): string {
  const abs = resolve(root, file);
  const rel = relative(root, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error(`Path outside project root: ${abs}`);
  return abs;
}

// Normalization
export function normalizeDiagnostics(value: Diagnostic[], file: string): NormalizedDiagnostic[] {
  const result: NormalizedDiagnostic[] = [];
  for (const diagnostic of value) {
    const start = diagnostic.range?.start;
    const end = diagnostic.range?.end;
    if (!start || typeof start.line !== "number" || typeof start.character !== "number") continue;
    const line = start.line;
    const column = start.character;
    const endLine = typeof end?.line === "number" ? end.line : undefined;
    const endColumn = typeof end?.character === "number" ? end.character : undefined;
    const severity = { 1: "error", 2: "warning", 3: "info", 4: "hint" }[Number(diagnostic.severity)] ?? "unknown";
    const code = typeof diagnostic.code === "string" || typeof diagnostic.code === "number" ? diagnostic.code : undefined;
    const source = typeof diagnostic.source === "string" ? diagnostic.source : undefined;
    const message = String(diagnostic.message ?? "");
    result.push({
      file,
      line: line + 1,
      column: column + 1,
      endLine: typeof endLine === "number" ? endLine + 1 : undefined,
      endColumn: typeof endColumn === "number" ? endColumn + 1 : undefined,
      severity,
      message,
      code,
      source,
    });
  }
  return result;
}

export function projectRootFromMarkers(cwd: string): string {
  let current = resolve(cwd);
  while (dirname(current) !== current) {
    if (
      [".git", "tsconfig.json", "pyproject.toml", "Cargo.toml", "go.mod", "package.json"].some((name) => {
        return existsSync(resolve(current, name));
      })
    )
      return current;
    current = dirname(current);
  }
  return resolve(cwd);
}
