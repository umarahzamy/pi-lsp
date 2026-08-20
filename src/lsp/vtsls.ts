import fs from "node:fs";
import path from "node:path";
import type { ServerConfig } from "../types.js";
import javascript from "./fileTypes/javascript.js";
import javascriptreact from "./fileTypes/javascriptreact.js";
import typescript from "./fileTypes/typescript.js";
import typescriptreact from "./fileTypes/typescriptreact.js";
import vue from "./fileTypes/vue.js";

const findUp = (start: string, markers: string[]): string | null => {
	let dir = start;
	while (true) {
		for (const m of markers) if (fs.existsSync(path.join(dir, m))) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
};

const config: ServerConfig = {
	cmd: ["vtsls", "--stdio"],
	fileTypes: [
		...javascript,
		...javascriptreact,
		...typescript,
		...typescriptreact,
		...vue,
	],
	rootMarkers: [
		"package-lock.json",
		"yarn.lock",
		"pnpm-lock.yaml",
		"bun.lockb",
		"bun.lock",
		".git",
	],
	rootDir: (startDir: string): string | null => {
		const lockMarkers = [
			"package-lock.json",
			"yarn.lock",
			"pnpm-lock.yaml",
			"bun.lockb",
			"bun.lock",
		];
		const denoMarkers = ["deno.json", "deno.jsonc"];
		const denoLock = "deno.lock";
		const denoRoot = findUp(startDir, denoMarkers);
		const denoLockRoot = findUp(startDir, [denoLock]);
		const lockRoot = findUp(startDir, lockMarkers);
		const gitRoot = findUp(startDir, [".git"]);
		const projectRoot = lockRoot ?? gitRoot;
		if (
			denoLockRoot &&
			(!projectRoot || denoLockRoot.length > projectRoot.length)
		)
			return null;
		if (denoRoot && (!projectRoot || denoRoot.length >= projectRoot.length))
			return null;
		return projectRoot ?? startDir;
	},
};

export default config;
