import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { LspManager } from "./manager.ts";

function statusText(manager: LspManager): string {
  const status = manager.status() as { root: string; servers: Array<{ name: string; state: string; reason?: string }> };
  const lines = [`root: ${status.root}`];
  for (const server of status.servers) lines.push(`${server.state} ${server.name}${server.reason ? ` (${server.reason})` : ""}`);
  return lines.join("\n");
}

export function lspStatusText(manager: LspManager): string {
  const status = manager.status() as { root: string; servers: Array<{ state: string; name: string }> };
  const total = status.servers.length;
  const ready = status.servers.filter((server) => server.state === "ready").length;
  return `LSP: ${ready}/${total} servers`;
}

export function registerCommands(pi: ExtensionAPI, getManager: () => LspManager | null): void {
  pi.registerCommand("lsp", {
    description: "Show LSP status; use /lsp restart or /lsp refresh",
    handler: async (args, ctx) => {
      const manager = getManager();
      if (!manager) { ctx.ui.notify("LSP session is not initialized", "warning"); return; }
      const command = args.trim();
      if (command === "restart") await manager.restart();
      if (command === "refresh") manager.refresh();
      ctx.ui.notify(statusText(manager), "info");
    },
  });

  pi.registerCommand("lsp-status", {
    description: "Show configured LSP servers",
    handler: async (_args, ctx) => {
      const manager = getManager();
      if (manager) ctx.ui.notify(statusText(manager), "info");
    },
  });
}

export function attachStatus(pi: ExtensionAPI, getManager: () => LspManager | null): void {
  pi.on("agent_start", async (_event, ctx: ExtensionContext) => {
    const manager = getManager();
    if (manager && ctx.hasUI) ctx.ui.setStatus("lsp", lspStatusText(manager));
  });
}
