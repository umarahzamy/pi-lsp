import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createStandaloneClient } from "../src/standalone-client.ts";

test("standalone client initializes and syncs documents", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-lsp-"));
  const file = join(root, "fixture.ts");
  await writeFile(file, "const value = 1;\n");
  const fake = fileURLToPath(new URL("./fake-lsp.mjs", import.meta.url));
  const client = createStandaloneClient({ name: "fake", cmd: [process.execPath, fake], root });
  await client.start(3000);
  await client.open(file);
  await client.change(file);
  const diagnostics = client.getDiagnostics(file);
  assert.ok(Array.isArray(diagnostics));
  await client.stop();
});

test("syncDocument pushes fresh diagnostics after disk edits", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-lsp-"));
  const file = join(root, "fixture.ts");
  await writeFile(file, "const a = 1;\n");
  const fake = fileURLToPath(new URL("./fake-lsp.mjs", import.meta.url));
  const client = createStandaloneClient({ name: "fake", cmd: [process.execPath, fake], root });
  await client.start(3000);

  await client.syncDocument(file);
  assert.ok(client.isOpen(file));
  assert.equal(client.getDiagnostics(file)[0]?.message, "v1");

  await writeFile(file, "const b = 2;\n");
  await client.syncDocument(file);
  assert.equal(client.getDiagnostics(file)[0]?.message, "v2-1");

  await client.stop();
  assert.equal(client.isOpen(file), false);
});
