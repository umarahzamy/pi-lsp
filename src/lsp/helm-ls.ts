import type { ServerConfig } from "../types.js";
import helm from "./fileTypes/helm.js";
import yamlHelmValues from "./fileTypes/yaml-helm-values.js";

const config: ServerConfig = {
	cmd: ["helm-ls", "serve"],
	fileTypes: [...helm, ...yamlHelmValues],
	rootMarkers: ["Chart.yaml"],
};

export default config;
