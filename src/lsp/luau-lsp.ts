import type { ServerConfig } from "../types.js";
import luau from "./fileTypes/luau.js";

const config: ServerConfig = {
	cmd: ["luau-lsp", "lsp"],
	fileTypes: [...luau],
	rootMarkers: [".git"],
};

export default config;
