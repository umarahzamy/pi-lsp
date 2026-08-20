import type { ServerConfig } from "../types.js";
import yaml from "./fileTypes/yaml.js";
import yamlDockerCompose from "./fileTypes/yaml-docker-compose.js";
import yamlGitlab from "./fileTypes/yaml-gitlab.js";
import yamlHelmValues from "./fileTypes/yaml-helm-values.js";

const config: ServerConfig = {
	cmd: ["yaml-language-server", "--stdio"],
	fileTypes: [...yaml, ...yamlDockerCompose, ...yamlGitlab, ...yamlHelmValues],
	rootMarkers: [".git"],
};

export default config;
