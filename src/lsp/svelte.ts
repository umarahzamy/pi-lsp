import type { ServerConfig } from "../types.js";
import svelte from "./fileTypes/svelte.js";

const config: ServerConfig = {
	cmd: ["svelteserver", "--stdio"],
	fileTypes: [...svelte],
	rootMarkers: [
		"package-lock.json",
		"yarn.lock",
		"pnpm-lock.yaml",
		"bun.lockb",
		"bun.lock",
		"deno.lock",
	],
};

export default config;
