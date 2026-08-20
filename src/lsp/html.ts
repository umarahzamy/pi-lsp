import type { ServerConfig } from "../types.js";
import html from "./fileTypes/html.js";

const config: ServerConfig = {
	cmd: ["vscode-html-language-server", "--stdio"],
	fileTypes: [...html],
	rootMarkers: ["package.json", ".git"],
};

export default config;
