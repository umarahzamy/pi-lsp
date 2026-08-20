import type { ServerConfig } from "../types.js";
import yamlAnsible from "./fileTypes/yaml-ansible.js";

const config: ServerConfig = {
	cmd: ["ansible-language-server", "--stdio"],
	fileTypes: [...yamlAnsible],
	rootMarkers: ["ansible.cfg", ".ansible-lint"],
};

export default config;
