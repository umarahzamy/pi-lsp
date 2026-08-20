import type { ServerConfig } from "../types.js";
import css from "./fileTypes/css.js";
import less from "./fileTypes/less.js";
import scss from "./fileTypes/scss.js";

const config: ServerConfig = {
	cmd: ["vscode-css-language-server", "--stdio"],
	fileTypes: [...css, ...less, ...scss],
	rootMarkers: ["package.json", ".git"],
};

export default config;
