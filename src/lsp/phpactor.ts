import type { ServerConfig } from "../types.js";
import php from "./fileTypes/php.js";

const config: ServerConfig = {
	cmd: ["phpactor", "language-server"],
	fileTypes: [...php],
	rootMarkers: [".git", "composer.json", ".phpactor.json", ".phpactor.yml"],
};

export default config;
