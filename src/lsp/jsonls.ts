import type { ServerConfig } from "../types.js";
import json from "./fileTypes/json.js";
import jsonc from "./fileTypes/jsonc.js";

const config: ServerConfig = {
	cmd: ["vscode-json-language-server", "--stdio"],
	fileTypes: [...json, ...jsonc],
	rootMarkers: [".git"],
};

export default config;
