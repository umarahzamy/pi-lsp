import type { ServerConfig } from "../types.js";
import bash from "./fileTypes/bash.js";
import sh from "./fileTypes/sh.js";

const config: ServerConfig = {
	cmd: ["bash-language-server", "start"],
	fileTypes: [...bash, ...sh],
	rootMarkers: [],
};

export default config;
