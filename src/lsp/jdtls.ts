import type { ServerConfig } from "../types.js";
import java from "./fileTypes/java.js";

const config: ServerConfig = {
	cmd: ["jdtls"],
	fileTypes: [...java],
	rootMarkers: [".git"],
};

export default config;
