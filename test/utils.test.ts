import { describe, it, expect } from "vitest";
import path from "node:path";
import { detectLanguageId, fileToUri, formatDiagnostic, sortDiagnostics, uriToFile } from "../src/utils.js";
import type { Diagnostic } from "../src/types.js";

describe("fileToUri / uriToFile", () => {
  it("round-trips absolute path", () => {
    const p = path.resolve("/tmp/a.ts");
    expect(uriToFile(fileToUri(p))).toBe(p);
  });
  it("handles file:// prefix", () => {
    expect(uriToFile("file:///tmp/b.js")).toBe("/tmp/b.js");
  });
});

describe("detectLanguageId", () => {
  it("maps extensions", () => {
    expect(detectLanguageId("a.ts")).toBe("typescript");
    expect(detectLanguageId("b.tsx")).toBe("typescriptreact");
    expect(detectLanguageId("c.py")).toBe("python");
    expect(detectLanguageId("d.rs")).toBe("rust");
    expect(detectLanguageId("e.go")).toBe("go");
    expect(detectLanguageId("f.unknown")).toBe("plaintext");
  });
});

describe("formatDiagnostic", () => {
  it("formats with severity and source", () => {
    const d: Diagnostic = { range: { start: { line: 1, character: 2 }, end: { line: 1, character: 5 } }, severity: 1, message: "oops", source: "ts" };
    expect(formatDiagnostic(d, "a.ts")).toBe("a.ts:2:3 [error] [ts] oops");
  });
  it("formats hint without source", () => {
    const d: Diagnostic = { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, severity: 4, message: "hint" };
    expect(formatDiagnostic(d, "b.ts")).toBe("b.ts:1:1 [hint] hint");
  });
});

describe("sortDiagnostics", () => {
  it("sorts by line, char, severity", () => {
    const a: Diagnostic = { range: { start: { line: 1, character: 5 }, end: { line: 1, character: 6 } }, severity: 2, message: "b" };
    const b: Diagnostic = { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, severity: 1, message: "a" };
    const c: Diagnostic = { range: { start: { line: 1, character: 2 }, end: { line: 1, character: 3 } }, severity: 1, message: "c" };
    const list = [a, b, c];
    sortDiagnostics(list);
    expect(list.map((x) => x.message)).toEqual(["a", "c", "b"]);
  });
});
