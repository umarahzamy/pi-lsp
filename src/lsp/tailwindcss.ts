import fs from "node:fs";
import path from "node:path";
import type { ServerConfig } from "../types.js";
import aspnetcorerazor from "./fileTypes/aspnetcorerazor.js";
import astro from "./fileTypes/astro.js";
import astroMarkdown from "./fileTypes/astro-markdown.js";
import blade from "./fileTypes/blade.js";
import clojure from "./fileTypes/clojure.js";
import css from "./fileTypes/css.js";
import djangoHtml from "./fileTypes/django-html.js";
import edge from "./fileTypes/edge.js";
import eelixir from "./fileTypes/eelixir.js";
import ejs from "./fileTypes/ejs.js";
import elixir from "./fileTypes/elixir.js";
import erb from "./fileTypes/erb.js";
import eruby from "./fileTypes/eruby.js";
import gohtml from "./fileTypes/gohtml.js";
import gohtmltmpl from "./fileTypes/gohtmltmpl.js";
import haml from "./fileTypes/haml.js";
import handlebars from "./fileTypes/handlebars.js";
import hbs from "./fileTypes/hbs.js";
import heex from "./fileTypes/heex.js";
import html from "./fileTypes/html.js";
import htmlEex from "./fileTypes/html-eex.js";
import htmlangular from "./fileTypes/htmlangular.js";
import htmldjango from "./fileTypes/htmldjango.js";
import jade from "./fileTypes/jade.js";
import javascript from "./fileTypes/javascript.js";
import javascriptreact from "./fileTypes/javascriptreact.js";
import leaf from "./fileTypes/leaf.js";
import less from "./fileTypes/less.js";
import liquid from "./fileTypes/liquid.js";
import markdown from "./fileTypes/markdown.js";
import mdx from "./fileTypes/mdx.js";
import mustache from "./fileTypes/mustache.js";
import njk from "./fileTypes/njk.js";
import nunjucks from "./fileTypes/nunjucks.js";
import php from "./fileTypes/php.js";
import postcss from "./fileTypes/postcss.js";
import pug from "./fileTypes/pug.js";
import razor from "./fileTypes/razor.js";
import reason from "./fileTypes/reason.js";
import rescript from "./fileTypes/rescript.js";
import sass from "./fileTypes/sass.js";
import scss from "./fileTypes/scss.js";
import slim from "./fileTypes/slim.js";
import stylus from "./fileTypes/stylus.js";
import sugarss from "./fileTypes/sugarss.js";
import svelte from "./fileTypes/svelte.js";
import templ from "./fileTypes/templ.js";
import twig from "./fileTypes/twig.js";
import typescript from "./fileTypes/typescript.js";
import typescriptreact from "./fileTypes/typescriptreact.js";
import vue from "./fileTypes/vue.js";

const findUp = (start: string, markers: string[]): string | null => {
	let dir = start;
	while (true) {
		for (const m of markers) if (fs.existsSync(path.join(dir, m))) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
};

const config: ServerConfig = {
	cmd: ["tailwindcss-language-server", "--stdio"],
	fileTypes: [
		...aspnetcorerazor,
		...astro,
		...astroMarkdown,
		...blade,
		...clojure,
		...css,
		...djangoHtml,
		...edge,
		...eelixir,
		...ejs,
		...elixir,
		...erb,
		...eruby,
		...gohtml,
		...gohtmltmpl,
		...haml,
		...handlebars,
		...hbs,
		...heex,
		...html,
		...htmlEex,
		...htmlangular,
		...htmldjango,
		...jade,
		...javascript,
		...javascriptreact,
		...leaf,
		...less,
		...liquid,
		...markdown,
		...mdx,
		...mustache,
		...njk,
		...nunjucks,
		...php,
		...postcss,
		...pug,
		...razor,
		...reason,
		...rescript,
		...sass,
		...scss,
		...slim,
		...stylus,
		...sugarss,
		...svelte,
		...templ,
		...twig,
		...typescript,
		...typescriptreact,
		...vue,
	],
	rootMarkers: [
		"tailwind.config.js",
		"tailwind.config.cjs",
		"tailwind.config.mjs",
		"tailwind.config.ts",
		"postcss.config.js",
		"postcss.config.cjs",
		"postcss.config.mjs",
		"postcss.config.ts",
		"theme/static_src/tailwind.config.js",
		"theme/static_src/tailwind.config.cjs",
		"theme/static_src/tailwind.config.mjs",
		"theme/static_src/tailwind.config.ts",
		"theme/static_src/postcss.config.js",
		".git",
		"package.json",
	],
	rootDir: (startDir: string): string | null => {
		const localRootFiles = [
			"tailwind.config.js",
			"tailwind.config.cjs",
			"tailwind.config.mjs",
			"tailwind.config.ts",
			"postcss.config.js",
			"postcss.config.cjs",
			"postcss.config.mjs",
			"postcss.config.ts",
			"theme/static_src/tailwind.config.js",
			"theme/static_src/tailwind.config.cjs",
			"theme/static_src/tailwind.config.mjs",
			"theme/static_src/tailwind.config.ts",
			"theme/static_src/postcss.config.js",
			".git",
			"package.json",
		];
		return findUp(startDir, localRootFiles);
	},
};

export default config;
