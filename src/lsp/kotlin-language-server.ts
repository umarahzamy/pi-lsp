import type { ServerConfig } from "../types.js";
import kotlin from "./fileTypes/kotlin.js";

const config: ServerConfig = {
	cmd: ["kotlin-language-server"],
	fileTypes: [...kotlin],
	rootMarkers: [
		"settings.gradle",
		"settings.gradle.kts",
		"build.xml",
		"pom.xml",
		"build.gradle",
		"build.gradle.kts",
	],
};

export default config;
