import type { ServerConfig } from "../types.js";
import astro from "./fileTypes/astro.js";
import css from "./fileTypes/css.js";
import eruby from "./fileTypes/eruby.js";
import html from "./fileTypes/html.js";
import htmlangular from "./fileTypes/htmlangular.js";
import htmldjango from "./fileTypes/htmldjango.js";
import javascriptreact from "./fileTypes/javascriptreact.js";
import less from "./fileTypes/less.js";
import pug from "./fileTypes/pug.js";
import sass from "./fileTypes/sass.js";
import scss from "./fileTypes/scss.js";
import svelte from "./fileTypes/svelte.js";
import templ from "./fileTypes/templ.js";
import typescriptreact from "./fileTypes/typescriptreact.js";
import vue from "./fileTypes/vue.js";

const config: ServerConfig = {
	cmd: ["emmet-language-server", "--stdio"],
	fileTypes: [
		...astro,
		...css,
		...eruby,
		...html,
		...htmlangular,
		...htmldjango,
		...javascriptreact,
		...less,
		...pug,
		...sass,
		...scss,
		...svelte,
		...templ,
		...typescriptreact,
		...vue,
	],
	rootMarkers: [".git"],
};

export default config;
