import { describe, it, expect, afterEach, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { collectDiagnostics, formatMessages } from "../src/diagnostics.js";
import { shutdownAll } from "../src/client.js";

const fakeLsp = fileURLToPath(new URL("./fake-lsp.mjs", import.meta.url));

let dir: string;
let prevPath: string | undefined;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "diag-"));
  fs.writeFileSync(path.join(dir, "package.json"), "{}");
  const bin = path.join(dir, "node_modules", ".bin");
  fs.mkdirSync(bin, { recursive: true });
  const launcher = path.join(bin, "vtsls");
  fs.writeFileSync(launcher, `#!/bin/sh\nexec "${process.execPath}" "${fakeLsp}"\n`);
  fs.chmodSync(launcher, 0o755);
  prevPath = process.env.PATH;
  process.env.PATH = `${bin}:${prevPath ?? ""}`;
});

afterEach(async () => {
  await shutdownAll();
  process.env.PATH = prevPath ?? "";
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("collectDiagnostics", () => {
  it("returns diagnostics for matched file", async () => {
    const file = path.join(dir, "a.ts");
    fs.writeFileSync(file, "const a = 1;");
    const res = await collectDiagnostics(file, dir);
    expect(res).not.toBeNull();
    expect(res!.messages.length).toBe(1);
    expect(res!.messages[0]).toMatch(/a\.ts:1:1/);
    expect(res!.errored).toBe(true);
  });

  it("returns null for unmatched extension", async () => {
    const file = path.join(dir, "a.unknown");
    fs.writeFileSync(file, "hi");
    const res = await collectDiagnostics(file, dir);
    expect(res).toBeNull();
  });

  it("deduplicates and formats", async () => {
    const file = path.join(dir, "b.ts");
    fs.writeFileSync(file, "x");
    const res = await collectDiagnostics(file, dir);
    const msg = formatMessages(file, dir, res!);
    expect(msg).toMatch(/1 issue/);
    expect(msg).toMatch(/\[error\]/);
  });

  it("returns no issues when server returns empty", async () => {
    // fake always returns 1 diag, so test formatMessages empty path directly
    const res = { server: "fake", messages: [], errored: false };
    const out = formatMessages(path.join(dir, "c.ts"), dir, res);
    expect(out).toMatch(/no issues/);
  });
});
