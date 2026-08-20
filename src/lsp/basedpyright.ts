import type { ServerConfig } from "../types.js";
import python from "./fileTypes/python.js";

const config: ServerConfig = {
	cmd: ["basedpyright-langserver", "--stdio"],
	fileTypes: [...python],
	rootMarkers: [
		"pyrightconfig.json",
		"pyproject.toml",
		"setup.py",
		"setup.cfg",
		"requirements.txt",
		"Pipfile",
		".git",
	],
};

export default config;
