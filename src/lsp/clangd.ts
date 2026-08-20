import type { ServerConfig } from "../types.js";
import c from "./fileTypes/c.js";
import cDoxygen from "./fileTypes/c-doxygen.js";
import cpp from "./fileTypes/cpp.js";
import cppDoxygen from "./fileTypes/cpp-doxygen.js";
import cuda from "./fileTypes/cuda.js";
import objc from "./fileTypes/objc.js";
import objcpp from "./fileTypes/objcpp.js";

const config: ServerConfig = {
	cmd: ["clangd"],
	fileTypes: [
		...c,
		...cDoxygen,
		...cpp,
		...cppDoxygen,
		...cuda,
		...objc,
		...objcpp,
	],
	rootMarkers: [
		".clangd",
		".clang-tidy",
		".clang-format",
		"compile_commands.json",
		"compile_flags.txt",
		"configure.ac",
		".git",
	],
};

export default config;
