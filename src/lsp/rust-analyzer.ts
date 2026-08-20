import type { ServerConfig } from "../types.js";
import rust from "./fileTypes/rust.js";

const config: ServerConfig = {
	cmd: ["rust-analyzer"],
	fileTypes: [...rust],
	rootMarkers: ["Cargo.toml", "rust-project.json"],
};

export default config;
