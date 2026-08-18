import { test } from "vitest";
import assert from "node:assert/strict";
import { discoverInventory, SERVER_NAMES } from "../src/discovery.ts";

test("inventory discovers available servers", () => {
  const inventory = discoverInventory(process.cwd());
  assert.equal(inventory.entries.length, SERVER_NAMES.length);
  assert.deepEqual(inventory.entries.find((entry) => entry.name === "clangd")?.cmd, ["clangd", "--background-index"]);
  assert.ok(inventory.entries.some((entry) => entry.name === "tinymist"));
});
