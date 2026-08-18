import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { LspManager } from "./manager.ts";
import { lspStatusText } from "./status.ts";
import type { NormalizedDiagnostic } from "./protocol.ts";

const diagnosticsSchema = Type.Object({
  path: Type.Optional(Type.String({ description: "File path; omit for project diagnostics" })),
  severity: Type.Optional(Type.String({ description: "Minimum severity" })),
  server: Type.Optional(Type.String({ description: "Configured server name" })),
});

type DiagnosticsDetails = { server?: string; elapsedMs?: number; value?: NormalizedDiagnostic[] };

type ManagerGetter = () => LspManager | null;

function requireManager(getManager: ManagerGetter): LspManager {
  const manager = getManager();
  if (!manager) throw new Error("LSP session is not initialized");
  return manager;
}

function refreshStatus(ctx: { hasUI?: boolean; ui?: { setStatus(key: string, value: string | undefined): void } }, manager: LspManager): void {
  if (ctx.hasUI && ctx.ui) ctx.ui.setStatus("lsp", lspStatusText(manager));
}

function diagnostics(getManager: ManagerGetter): ToolDefinition<typeof diagnosticsSchema, DiagnosticsDetails> {
  return {
    name: "lsp_diagnostics",
    label: "LSP diagnostics",
    description: "Get compiler and language-server diagnostics.",
    promptSnippet: toolSnippets.lsp_diagnostics,
    promptGuidelines: toolGuidelines,
    parameters: diagnosticsSchema,
    async execute(_id, params, _signal, _update, ctx) {
      const manager = requireManager(getManager);
      if (!params.path) {
        const all = manager.queryAllDiagnostics();
        const minimum = { hint: 4, info: 3, warning: 2, error: 1 }[params.severity ?? "hint"] ?? 4;
        const value = all.filter((item) => {
          const sev = { hint: 4, info: 3, warning: 2, error: 1 }[item.severity] ?? 4;
          return sev <= minimum;
        });
        return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], details: { value } };
      }
      const result = await manager.queryDiagnostics(params.path, params.server);
      refreshStatus(ctx, manager);
      const minimum = { hint: 4, info: 3, warning: 2, error: 1 }[params.severity ?? "hint"] ?? 4;
      const value = result.value.filter((item) => {
        const sev = { hint: 4, info: 3, warning: 2, error: 1 }[item.severity] ?? 4;
        return sev <= minimum;
      });
      return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], details: { ...result, value } };
    },
    renderCall(args, theme, context) {
      const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      const path = args.path ?? "project";
      const severity = args.severity ? ` (≥${args.severity})` : "";
      text.setText(
        theme.fg("toolTitle", theme.bold("lsp_diagnostics")) +
        " " +
        theme.fg("accent", path) +
        theme.fg("muted", severity)
      );
      return text;
    },
  };
}

const toolSnippets: Record<string, string> = {
  lsp_diagnostics: "LSP diagnostics: compile/type/syntax errors and warnings for a file (or project-wide)",
};

const toolGuidelines = [
  "Use lsp_diagnostics to find compile, type, or syntax errors before building or running tests; grep/read cannot detect type errors.",
];

export function createTools(getManager: ManagerGetter) {
  const diagnosticsTool = diagnostics(getManager);
  return [diagnosticsTool] as const;
}
