import type { ServerConfig } from "../types.js";
import astro from "./fileTypes/astro.js";
import htmlangular from "./fileTypes/htmlangular.js";
import javascript from "./fileTypes/javascript.js";
import javascriptreact from "./fileTypes/javascriptreact.js";
import svelte from "./fileTypes/svelte.js";
import typescript from "./fileTypes/typescript.js";
import typescriptreact from "./fileTypes/typescriptreact.js";
import vue from "./fileTypes/vue.js";

const config: ServerConfig = {
	cmd: ["vscode-eslint-language-server", "--stdio"],
	fileTypes: [
		...astro,
		...htmlangular,
		...javascript,
		...javascriptreact,
		...svelte,
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
		"deno.json",
		"deno.jsonc",
		"deno.lock",
		"package.json",
	],
};

export default config;
