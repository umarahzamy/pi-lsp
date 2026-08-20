import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { getOrCreateClient, shutdownAll, syncContent, waitForDiagnostics } from "../src/client.js";
import type { ResolvedServerConfig } from "../src/types.js";

const fakeLsp = fileURLToPath(new URL("./fake-lsp.mjs", import.meta.url));

const makeCfg = (cwd: string): ResolvedServerConfig => ({
  command: "fake-lsp",
  args: [fakeLsp],
  fileTypes: [".ts"],
  rootMarkers: [],
  resolved: process.execPath,
});

describe("client sync and wait", () => {
  let dir: string;
  afterEach(async () => {
    await shutdownAll();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("publishes diagnostics with version match", async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "client-"));
    const file = path.join(dir, "a.ts");
    fs.writeFileSync(file, "const a = 1;");
    const cfg: ResolvedServerConfig = { ...makeCfg(dir), args: [fakeLsp], resolved: process.execPath };
    const client = await getOrCreateClient(cfg, dir);
    await syncContent(client, file, "const a = 1;", undefined);
    const diags = await waitForDiagnostics(client, file, { timeoutMs: 1000 });
    expect(diags.length).toBe(1);
    expect((diags[0] as { message: string }).message).toBe("v1");
  });

  it("settles unversioned and bumps version on change", async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "client-"));
    const file = path.join(dir, "b.ts");
    fs.writeFileSync(file, "v1");
    const cfg: ResolvedServerConfig = { ...makeCfg(dir), args: [fakeLsp], resolved: process.execPath };
    const client = await getOrCreateClient(cfg, dir);
    await syncContent(client, file, "v1", undefined);
    await waitForDiagnostics(client, file, { timeoutMs: 1000 });
    await syncContent(client, file, "v2", undefined);
    const diags = await waitForDiagnostics(client, file, { timeoutMs: 1000 });
    expect((diags[0] as { message: string }).message).toMatch(/^v2-/);
  });

  it("shutdown clears clients", async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "client-"));
    const cfg: ResolvedServerConfig = { ...makeCfg(dir), args: [fakeLsp], resolved: process.execPath };
    await getOrCreateClient(cfg, dir);
    await shutdownAll();
    // second call after shutdown should create new client without error
    const c2 = await getOrCreateClient(cfg, dir);
    expect(c2).toBeDefined();
  });
});
