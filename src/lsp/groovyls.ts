import type { ServerConfig } from "../types.js";
import groovy from "./fileTypes/groovy.js";

const config: ServerConfig = {
	cmd: ["groovy-language-server"],
	fileTypes: [...groovy],
	rootMarkers: ["Jenkinsfile", ".git"],
};

export default config;
