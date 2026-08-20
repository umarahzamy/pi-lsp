import type { ServerConfig } from "../types.js";
import astro from "./fileTypes/astro.js";

const config: ServerConfig = {
	cmd: ["astro-ls", "--stdio"],
	fileTypes: [...astro],
	rootMarkers: ["package.json", "tsconfig.json", "jsconfig.json", ".git"],
};

export default config;
