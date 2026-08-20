import ansiblels from "./ansiblels.js";
import astro from "./astro.js";
import basedpyright from "./basedpyright.js";
import bashls from "./bashls.js";
import clangd from "./clangd.js";
import cssls from "./cssls.js";
import dockerls from "./dockerls.js";
import emmetLs from "./emmet-ls.js";
import eslint from "./eslint.js";
import gopls from "./gopls.js";
import groovyls from "./groovyls.js";
import helmLs from "./helm-ls.js";
import html from "./html.js";
import jdtls from "./jdtls.js";
import jsonls from "./jsonls.js";
import kotlinLanguageServer from "./kotlin-language-server.js";
import luaLs from "./lua-ls.js";
import luauLsp from "./luau-lsp.js";
import phpactor from "./phpactor.js";
import rustAnalyzer from "./rust-analyzer.js";
import svelte from "./svelte.js";
import tailwindcss from "./tailwindcss.js";
import terraformls from "./terraformls.js";
import tinymist from "./tinymist.js";
import volar from "./volar.js";
import vtsls from "./vtsls.js";
import yamlls from "./yamlls.js";

const registry: Record<string, import("../types.js").ServerConfig> = {
	ansiblels: ansiblels,
	astro: astro,
	basedpyright: basedpyright,
	bashls: bashls,
	clangd: clangd,
	cssls: cssls,
	dockerls: dockerls,
	"emmet-ls": emmetLs,
	eslint: eslint,
	gopls: gopls,
	groovyls: groovyls,
	"helm-ls": helmLs,
	html: html,
	jdtls: jdtls,
	jsonls: jsonls,
	"kotlin-language-server": kotlinLanguageServer,
	"lua-ls": luaLs,
	"luau-lsp": luauLsp,
	phpactor: phpactor,
	"rust-analyzer": rustAnalyzer,
	svelte: svelte,
	tailwindcss: tailwindcss,
	terraformls: terraformls,
	tinymist: tinymist,
	volar: volar,
	vtsls: vtsls,
	yamlls: yamlls,
};

export default registry;
