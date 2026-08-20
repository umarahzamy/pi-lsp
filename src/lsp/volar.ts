import type { ServerConfig } from "../types.js";
import vue from "./fileTypes/vue.js";

const config: ServerConfig = {
	cmd: ["vue-language-server", "--stdio"],
	fileTypes: [...vue],
	rootMarkers: ["package.json"],
};

export default config;
