import type { ServerConfig } from "../types.js";
import go from "./fileTypes/go.js";
import gomod from "./fileTypes/gomod.js";
import gotmpl from "./fileTypes/gotmpl.js";
import gowork from "./fileTypes/gowork.js";

const config: ServerConfig = {
	cmd: ["gopls"],
	fileTypes: [...go, ...gomod, ...gotmpl, ...gowork],
	rootMarkers: [".git"],
};

export default config;
