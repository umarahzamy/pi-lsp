import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getServersForFile, hasRootMarkers, loadServers, resolveCommand } from "../src/config.js";

describe("hasRootMarkers", () => {
  it("detects direct marker", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cfg-"));
    fs.writeFileSync(path.join(dir, "package.json"), "{}");
    expect(hasRootMarkers(dir, ["package.json"])).toBe(true);
    expect(hasRootMarkers(dir, ["Cargo.toml"])).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it("matches glob", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cfg-"));
    fs.writeFileSync(path.join(dir, "foo.cabal"), "");
    expect(hasRootMarkers(dir, ["*.cabal"])).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("resolveCommand", () => {
  it("prefers local node_modules/.bin", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cfg-"));
    const bin = path.join(dir, "node_modules", ".bin");
    fs.mkdirSync(bin, { recursive: true });
    const fake = path.join(bin, "mytool");
    fs.writeFileSync(fake, "#!/bin/sh\necho hi");
    fs.writeFileSync(path.join(dir, "package.json"), "{}");
    expect(resolveCommand("mytool", dir)).toBe(fake);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("loadServers / getServersForFile", () => {
  let dir: string;
  let prevPath: string | undefined;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "cfg-"));
    prevPath = process.env.PATH;
  });
  afterEach(() => {
    process.env.PATH = prevPath;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it("loads only when marker and binary present", async () => {
    fs.writeFileSync(path.join(dir, "package.json"), "{}");
    const bin = path.join(dir, "node_modules", ".bin");
    fs.mkdirSync(bin, { recursive: true });
    const fake = path.join(bin, "vtsls");
    fs.writeFileSync(fake, "#!/bin/sh\necho hi");
    fs.chmodSync(fake, 0o755);
    const servers = loadServers(dir);
    expect(servers.has("vtsls")).toBe(true);
    expect(servers.has("rust_analyzer")).toBe(false);
  });
  it("matches by extension", async () => {
    fs.writeFileSync(path.join(dir, "package.json"), "{}");
    const bin = path.join(dir, "node_modules", ".bin");
    fs.mkdirSync(bin, { recursive: true });
    const fake = path.join(bin, "vtsls");
    fs.writeFileSync(fake, "#!/bin/sh\necho hi");
    fs.chmodSync(fake, 0o755);
    const matched = getServersForFile(dir, path.join(dir, "a.ts"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched.some(([n]) => n === "vtsls")).toBe(true);
    const none = getServersForFile(dir, path.join(dir, "a.rs"));
    expect(none.length).toBe(0);
  });
});
