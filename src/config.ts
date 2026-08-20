import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import registry from "./lsp/index.js";
import type { ResolvedServerConfig, ServerConfig } from "./types.js";

type ServerMap = Record<string, ServerConfig>;
type UserServerMap = Record<string, ServerConfig | null | false>;

type LspJsonFile = UserServerMap & {
	servers?: UserServerMap;
	enabled?: string[];
};

const FALLBACK_DEFAULTS: ServerMap = {
	"typescript-language-server": {
		cmd: ["typescript-language-server", "--stdio"],
		fileTypes: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
		rootMarkers: ["package.json", "tsconfig.json", "jsconfig.json"],
	},
	vtsls: {
		cmd: ["vtsls", "--stdio"],
		fileTypes: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
		rootMarkers: ["package.json", "tsconfig.json", "jsconfig.json"],
	},
	basedpyright: {
		cmd: ["basedpyright-langserver", "--stdio"],
		fileTypes: [".py", ".pyi"],
		rootMarkers: [
			"pyproject.toml",
			"pyrightconfig.json",
			"setup.py",
			"requirements.txt",
		],
	},
	pyright: {
		cmd: ["pyright-langserver", "--stdio"],
		fileTypes: [".py", ".pyi"],
		rootMarkers: [
			"pyproject.toml",
			"pyrightconfig.json",
			"setup.py",
			"requirements.txt",
		],
	},
	"rust-analyzer": {
		cmd: ["rust-analyzer"],
		fileTypes: [".rs"],
		rootMarkers: ["Cargo.toml"],
	},
	gopls: {
		cmd: ["gopls", "serve"],
		fileTypes: [".go"],
		rootMarkers: ["go.mod", "go.work"],
	},
	clangd: {
		cmd: ["clangd", "--background-index"],
		fileTypes: [".c", ".cc", ".cpp", ".cxx", ".h", ".hpp", ".hh"],
		rootMarkers: [
			"compile_commands.json",
			"compile_flags.txt",
			".clangd",
			"CMakeLists.txt",
			".clang-format",
		],
	},
	biome: {
		cmd: ["biome", "lsp-proxy"],
		fileTypes: [
			".ts",
			".tsx",
			".js",
			".jsx",
			".mjs",
			".cjs",
			".json",
			".jsonc",
		],
		rootMarkers: ["biome.json", "biome.jsonc"],
	},
	"vscode-json-language-server": {
		cmd: ["vscode-json-language-server", "--stdio"],
		fileTypes: [".json", ".jsonc"],
		rootMarkers: ["package.json", ".git"],
	},
	"vscode-css-language-server": {
		cmd: ["vscode-css-language-server", "--stdio"],
		fileTypes: [".css", ".scss", ".less"],
		rootMarkers: ["package.json", ".git"],
	},
	"vscode-html-language-server": {
		cmd: ["vscode-html-language-server", "--stdio"],
		fileTypes: [".html", ".htm"],
		rootMarkers: ["package.json", ".git"],
	},
	"bash-language-server": {
		cmd: ["bash-language-server", "start"],
		fileTypes: [".sh", ".bash", ".zsh"],
		rootMarkers: [".git"],
	},
	"yaml-language-server": {
		cmd: ["yaml-language-server", "--stdio"],
		fileTypes: [".yaml", ".yml"],
		rootMarkers: [".git"],
	},
	"lua-language-server": {
		cmd: ["lua-language-server"],
		fileTypes: [".lua"],
		rootMarkers: [".luarc.json", ".luarc.jsonc", "selene.toml"],
	},
};

const readJsonFile = (p: string): LspJsonFile | null => {
	try {
		if (!fs.existsSync(p)) return null;
		const raw = fs.readFileSync(p, "utf-8");
		if (!raw.trim()) return null;
		const parsed: LspJsonFile = JSON.parse(raw);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
			return parsed;
		return null;
	} catch {
		return null;
	}
};

const getCmd = (cfg: ServerConfig): string[] => {
	if (cfg.cmd && Array.isArray(cfg.cmd)) return cfg.cmd;
	if (cfg.command) return [cfg.command, ...(cfg.args ?? [])];
	return [];
};

const isServerConfigValue = (
	v: object | null | boolean,
): v is ServerConfig | null | false => {
	if (v === null || v === false) return true;
	if (v === true) return false;
	if (typeof v !== "object") return false;
	const cmd = Reflect.get(v, "cmd");
	const command = Reflect.get(v, "command");
	const hasCmd = Array.isArray(cmd) || typeof command === "string";
	return hasCmd && Array.isArray(Reflect.get(v, "fileTypes"));
};

const extractServers = (raw: LspJsonFile): UserServerMap => {
	if (raw.servers && typeof raw.servers === "object" && raw.servers !== null)
		return raw.servers;
	const copy: UserServerMap = {};
	for (const [k, v] of Object.entries(raw)) {
		if (k === "servers" || k === "enabled") continue;
		if (isServerConfigValue(v)) copy[k] = v;
	}
	return copy;
};

const loadRepoDefaults = (): ServerMap => {
	if (Object.keys(registry).length > 0) return { ...registry };
	return FALLBACK_DEFAULTS;
};

let _cachedDefaults: ServerMap | null = null;
const getDefaults = (): ServerMap => {
	if (_cachedDefaults) return _cachedDefaults;
	_cachedDefaults = loadRepoDefaults();
	return _cachedDefaults;
};

const getMergedDefaults = (cwd: string): ServerMap => {
	const merged: ServerMap = { ...getDefaults() };
	const candidates: string[] = [];
	const envConfig = process.env.PI_LSP_CONFIG;
	if (envConfig) candidates.push(envConfig);
	candidates.push(path.join(os.homedir(), ".pi", "agent", "lsp.json"));
	candidates.push(path.join(cwd, ".pi", "lsp.json"));
	candidates.push(path.join(cwd, "lsp.json"));
	let enabled: string[] | null = null;
	for (const p of candidates) {
		const raw = readJsonFile(p);
		if (!raw) continue;
		if (Array.isArray(raw.enabled)) enabled = raw.enabled.map((s) => String(s));
		const servers = extractServers(raw);
		for (const [name, val] of Object.entries(servers)) {
			if (val === null || val === false) {
				delete merged[name];
				continue;
			}
			if (val && typeof val === "object") {
				const base: ServerConfig = merged[name] ?? {
					cmd: [],
					fileTypes: [],
					rootMarkers: [],
				};
				merged[name] = { ...base, ...val };
			}
		}
	}
	if (enabled !== null) {
		const keep = new Set(enabled.map((s) => s.toLowerCase()));
		for (const k of Object.keys(merged))
			if (!keep.has(k.toLowerCase())) delete merged[k];
	}
	return merged;
};

const hasRoot = (cwd: string, cfg: ServerConfig): boolean => {
	if (cfg.rootDir) {
		try {
			return cfg.rootDir(cwd) !== null;
		} catch {
			return false;
		}
	}
	if (cfg.rootMarkers.length === 0) return true;
	return hasRootMarkers(cwd, cfg.rootMarkers);
};

export const hasRootMarkers = (
	cwd: string,
	markers: (string | string[])[],
): boolean => {
	for (const m of markers) {
		const group = Array.isArray(m) ? m : [m];
		for (const g of group) {
			if (g.includes("*")) {
				try {
					const entries = fs.readdirSync(cwd);
					if (g.startsWith("*.")) {
						const ext = g.slice(1);
						if (entries.some((e) => e.endsWith(ext))) return true;
					} else {
						const re = new RegExp(
							`^${g
								.replace(/[.+^${}()|[\]\\]/g, "\\$&")
								.replace(/\*/g, ".*")
								.replace(/\?/g, ".")}$`,
						);
						if (entries.some((e) => re.test(e))) return true;
					}
				} catch {}
				continue;
			}
			if (fs.existsSync(path.join(cwd, g))) return true;
		}
	}
	return false;
};

export const resolveLocal = (cwd: string, cmd: string): string | null => {
	const local = path.join(cwd, "node_modules", ".bin", cmd);
	if (fs.existsSync(local)) return local;
	for (const p of [".venv/bin", "venv/bin"]) {
		const v = path.join(cwd, p, cmd);
		if (fs.existsSync(v)) return v;
	}
	return null;
};

export const which = (cmd: string): string | null => {
	try {
		const out = execSync(`which ${cmd}`, { encoding: "utf-8" }).trim();
		return out || null;
	} catch {
		return null;
	}
};

export const resolveCommand = (cmd: string, cwd: string): string | null => {
	const local = resolveLocal(cwd, cmd);
	if (local) return local;
	return which(cmd);
};

export const loadServers = (cwd: string): Map<string, ResolvedServerConfig> => {
	const defaults = getMergedDefaults(cwd);
	const out = new Map<string, ResolvedServerConfig>();
	for (const [name, cfg] of Object.entries(defaults)) {
		if (!hasRoot(cwd, cfg)) continue;
		const cmd = getCmd(cfg);
		if (cmd.length === 0) continue;
		const bin = cmd[0] ?? "";
		const resolved = resolveCommand(bin, cwd);
		if (!resolved) continue;
		out.set(name, { ...cfg, cmd, resolved });
	}
	return out;
};

export const getServersForFile = (
	cwd: string,
	filePath: string,
): Array<[string, ResolvedServerConfig]> => {
	const ext = path.extname(filePath).toLowerCase();
	const base = path.basename(filePath).toLowerCase();
	const servers = loadServers(cwd);
	const matched: Array<[string, ResolvedServerConfig]> = [];
	const fileDir = path.dirname(filePath);
	for (const [name, cfg] of servers) {
		if (cfg.rootDir) {
			try {
				if (cfg.rootDir(fileDir) === null) continue;
			} catch {
				continue;
			}
		}
		const types = cfg.fileTypes.map((t) => t.toLowerCase());
		if (types.includes(ext) || types.includes(base)) matched.push([name, cfg]);
	}
	return matched;
};

export const _defaultsForTest = FALLBACK_DEFAULTS;
export const _resetCacheForTest = (): void => {
	_cachedDefaults = null;
};
