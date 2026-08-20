import type { ServerConfig } from "../types.js";
import dockerfile from "./fileTypes/dockerfile.js";

const config: ServerConfig = {
	cmd: ["docker-langserver", "--stdio"],
	fileTypes: [...dockerfile],
	rootMarkers: ["Dockerfile"],
};

export default config;
