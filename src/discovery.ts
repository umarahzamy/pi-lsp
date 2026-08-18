import { accessSync, constants, existsSync, readFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { homedir } from "node:os";
import type { ServerCommand } from "./standalone-client.ts";

export const SERVER_NAMES = [
  "ansiblels", "astro", "basedpyright", "bashls", "clangd", "cssls", "dockerls", "emmet_ls",
  "eslint", "gopls", "groovyls", "helm_ls", "html", "jdtls", "jsonls", "kotlin_language_server",
  "lua_ls", "luau_lsp", "phpactor", "rust_analyzer", "svelte", "tailwindcss", "terraformls",
  "tinymist", "vtsls", "volar", "yamlls",
] as const;

export type InventoryEntry = { name: string; cmd: string[]; available: boolean; reason?: string; formattingDisabled?: boolean };
export type Inventory = { entries: InventoryEntry[]; updatedAt: number };

const FALLBACK: Record<string, string[]> = {
  ansiblels: ["ansible-language-server", "--stdio"], astro: ["astro-ls", "--stdio"],
  basedpyright: ["basedpyright-langserver", "--stdio"], bashls: ["bash-language-server", "start"],
  clangd: ["clangd", "--background-index"], cssls: ["vscode-css-language-server", "--stdio"],
  dockerls: ["docker-langserver", "--stdio"], emmet_ls: ["emmet-language-server", "--stdio"],
  eslint: ["vscode-eslint-language-server", "--stdio"], gopls: ["gopls"], groovyls: ["groovy-language-server", "--stdio"],
  helm_ls: ["helm_ls", "serve"], html: ["vscode-html-language-server", "--stdio"], jdtls: ["jdtls"],
  jsonls: ["vscode-json-language-server", "--stdio"], kotlin_language_server: ["kotlin-language-server"],
  lua_ls: ["lua-language-server"], luau_lsp: ["luau-lsp"], phpactor: ["phpactor", "language-server"],
  rust_analyzer: ["rust-analyzer"], svelte: ["svelteserver", "--stdio"],
  tailwindcss: ["tailwindcss-language-server", "--stdio"], terraformls: ["terraform-ls", "serve"],
  tinymist: ["tinymist", "lsp"], vtsls: ["vtsls", "--stdio"], volar: ["vue-language-server", "--stdio"],
  yamlls: ["yaml-language-server", "--stdio"],
};

export function findOnPath(command: string): string | null {
  for (const dir of (process.env.PATH ?? "").split(delimiter).filter(Boolean)) {
    const candidate = join(dir, command);
    try { accessSync(candidate, constants.X_OK); return candidate; } catch { /* continue */ }
  }
  return null;
}

function resolveExecutable(command: string, root: string): string | null {
  if (command.includes("/")) return existsSync(command) ? command : null;
  for (const candidate of [join(root, "node_modules", ".bin", command), join(root, ".venv", "bin", command), join(root, "bin", command)]) {
    try { accessSync(candidate, constants.X_OK); return candidate; } catch { /* continue */ }
  }
  return findOnPath(command);
}

function configuredRegistry(): Record<string, string[]> {
  const file = join(homedir(), ".pi", "agent", "lsp", "servers.json");
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Record<string, string[]>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, command]) => Array.isArray(command) && command.every((part) => typeof part === "string"))
    );
  } catch {
    return {};
  }
}

export function discoverInventory(root: string): Inventory {
  const registry = configuredRegistry();
  const entries = SERVER_NAMES.map((name) => {
    const cmd = FALLBACK[name] ?? registry[name] ?? [];
    const executable = cmd[0] ? resolveExecutable(cmd[0], root) : null;
    const available = cmd.length > 0 && Boolean(executable);
    const resolvedCmd = executable && !findOnPath(cmd[0] ?? "") ? [executable, ...cmd.slice(1)] : cmd;
    return { name, cmd: resolvedCmd, available, reason: cmd.length === 0 ? "no command mapping" : available ? undefined : `missing: ${cmd[0]}`, formattingDisabled: name === "tinymist" };
  });
  return { entries, updatedAt: Date.now() };
}

export function serverSpec(inventory: Inventory, name: string, root: string): ServerCommand | null {
  const entry = inventory.entries.find((item) => item.name === name);
  if (!entry || !entry.cmd.length || !entry.available) return null;
  return { name, cmd: entry.cmd, root };
}
