import type { ServerConfig } from "../types.js";
import typst from "./fileTypes/typst.js";

const config: ServerConfig = {
	cmd: ["tinymist"],
	fileTypes: [...typst],
	rootMarkers: [".git"],
};

export default config;
