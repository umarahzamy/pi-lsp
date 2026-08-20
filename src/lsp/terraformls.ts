import type { ServerConfig } from "../types.js";
import terraform from "./fileTypes/terraform.js";
import terraformVars from "./fileTypes/terraform-vars.js";

const config: ServerConfig = {
	cmd: ["terraform-ls", "serve"],
	fileTypes: [...terraform, ...terraformVars],
	rootMarkers: [".terraform", ".git"],
};

export default config;
