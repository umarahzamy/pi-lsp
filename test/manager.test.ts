import { test } from "vitest";
import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLspManager } from "../src/manager.ts";

test("manager reports configured inventory and isolates project root", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-manager-"));
  const manager = createLspManager(root);
  manager.initialize();
  const status = manager.status();
  assert.equal(status.root, root);
  assert.equal(status.servers.length, 27);
  await assert.rejects(() => manager.queryDiagnostics(join(root, "unknown.bin")), /No configured LSP server/);
  await manager.stop();
});

test("syncFile skips no-op syncs and refreshes on disk drift", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-drift-"));
  await writeFile(join(root, "package.json"), "{}");
  const bin = join(root, "bin");
  await mkdir(bin);
  const fake = fileURLToPath(new URL("./fake-lsp.mjs", import.meta.url));
  const launcher = join(bin, "vtsls");
  await writeFile(launcher, `#!/bin/sh\nexec "${process.execPath}" "${fake}"\n`);
  await chmod(launcher, 0o755);
  const savedPath = process.env.PATH;
  process.env.PATH = `${bin}:${savedPath ?? ""}`;
  try {
    const manager = createLspManager(root);
    manager.initialize();
    const file = join(root, "a.ts");
    await writeFile(file, "const a = 1;\n");

    const first = await manager.syncFile(file);
    assert.equal(first.value[0]?.message, "v1");

    // No drift: no LSP roundtrip (message stays v1, fast).
    const start = Date.now();
    const second = await manager.syncFile(file);
    assert.equal(second.value[0]?.message, "v1");
    assert.ok(Date.now() - start < 1000, "drift-free sync should not wait");

    // Disk change: didChange sent, fresh diagnostics.
    await writeFile(file, "const b = 2;\n");
    const third = await manager.syncFile(file);
    assert.equal(third.value[0]?.message, "v2-1");

    // Force resync with unchanged content: should still fetch fresh diagnostics
    const forceStart = Date.now();
    const fourth = await manager.syncFile(file, { force: true });
    assert.equal(fourth.value[0]?.message, "v2-2");
    assert.ok(Date.now() - forceStart < 1000, "forced sync should complete quickly");

    await manager.stop();
  } finally {
    process.env.PATH = savedPath ?? "";
  }
});
