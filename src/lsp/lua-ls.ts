import type { ServerConfig } from "../types.js";
import lua from "./fileTypes/lua.js";

const config: ServerConfig = {
	cmd: ["lua-language-server"],
	fileTypes: [...lua],
	rootMarkers: [".git"],
};

export default config;
