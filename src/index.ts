import { isAbsolute, relative, resolve } from "node:path";
import type { ExtensionAPI, ToolResultEvent, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createLspManager, type LspManager } from "./manager.ts";
import { createTools } from "./tools.ts";
import { registerCommands, lspStatusText } from "./status.ts";
import type { NormalizedDiagnostic } from "./protocol.ts";

export default function lspExtension(pi: ExtensionAPI): void {
  let manager: LspManager | null = null;
  const getManager = (): LspManager | null => manager;

  const tools = createTools(getManager);
  pi.registerTool(tools[0]);
  registerCommands(pi, getManager);

  pi.on("session_start", async (_event: { type: string }, ctx: ExtensionContext) => {
    manager = createLspManager(ctx.cwd);
    manager.initialize();
    if (ctx.hasUI) ctx.ui.setStatus("lsp", lspStatusText(manager));
  });

  pi.on("agent_start", (_event: { type: string }, ctx: ExtensionContext) => {
    if (manager && ctx.hasUI) ctx.ui.setStatus("lsp", lspStatusText(manager));
  });

  const SOURCE_EXTS = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".c", ".h", ".cpp", ".cc", ".cxx", ".hpp", ".hxx",
    ".java", ".kt", ".lua", ".luau", ".php", ".astro", ".svelte", ".vue", ".css",
    ".html", ".json", ".yaml", ".yml", ".tf", ".typ", ".toml", ".sh", ".bash",
  ]);

  const TRACKED_TOOLS = new Set(["read", "edit", "write"]);
  const MAX_RETRIES = 3;

  const isPipeError = (error: unknown): boolean => {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "EPIPE" || code === "ERR_STREAM_DESTROYED" || code === "ECONNRESET") return true;
    const msg = String(error);
    return msg.includes("EPIPE") || msg.includes("ERR_STREAM_DESTROYED");
  };

  const isOutsideRootError = (error: unknown): boolean => String(error).includes("Path outside project root");

  const isInsideRoot = (file: string, root: string): boolean => {
    const abs = resolve(root, file);
    const rel = relative(root, abs);
    return !(rel.startsWith("..") || isAbsolute(rel));
  };

  // Track files touched during the turn
  const touchedFiles = new Set<string>();
  
  // Track retry count per file (for false positive detection)
  const retryCount = new Map<string, number>();

  // On each read/edit/write, just track the file (no per-tool injection)
  pi.on("tool_result", async (event: ToolResultEvent, _ctx: ExtensionContext) => {
    if (!TRACKED_TOOLS.has(event.toolName)) return;
    const path = event.input.path as string | undefined;
    if (!path) return;
    const ext = path.includes(".") ? "." + path.split(".").pop()!.toLowerCase() : "";
    if (!SOURCE_EXTS.has(ext)) return;
    const mgr = getManager();
    if (mgr && !isInsideRoot(path, mgr.projectRoot)) return;
    touchedFiles.add(path);
  });

  // At turn_end: fetch diagnostics for all touched files, trigger new turn if issues exist
  pi.on("turn_end", async (_event: { type: string; turnIndex: number }, ctx: ExtensionContext) => {
    if (touchedFiles.size === 0) return;
    const mgr = getManager();
    if (!mgr) return;

    const files = [...touchedFiles];
    touchedFiles.clear();

    // Fetch diagnostics for all touched files with force=true to ensure fresh results.
    // Never let a single LSP pipe failure crash pi (EPIPE -> swallow, retry next turn).
    let results: Array<{ file: string; diags: NormalizedDiagnostic[]; server: string | null; error: string | null }>;
    try {
      results = await Promise.all(
        files.map(async (file) => {
          try {
            if (!isInsideRoot(file, mgr.projectRoot)) return { file, diags: [], server: null, error: null };
            const result = await mgr.syncFile(file, { force: true });
            return { file, diags: result.value, server: result.server, error: null };
          } catch (error) {
            if (isPipeError(error) || isOutsideRootError(error)) return { file, diags: [], server: null, error: null };
            return { file, diags: [], server: null, error: error instanceof Error ? error.message : String(error) };
          }
        }),
      );
    } catch (error) {
      if (isPipeError(error)) return;
      return;
    }

    // Consolidate results
    const totalIssues = results.reduce((sum, r) => sum + r.diags.length, 0);
    const filesWithIssues = results.filter(r => r.diags.length > 0);
    const errors = results.filter(r => r.error);

    if (totalIssues === 0 && errors.length === 0) {
      // All clean - reset retry counts and no new turn needed
      for (const file of files) {
        retryCount.delete(file);
      }
      return;
    }
    
    // Check if any file has hit the retry limit
    const filesAtLimit = filesWithIssues.filter(r => (retryCount.get(r.file) || 0) >= MAX_RETRIES);
    const isFalsePositive = filesAtLimit.length > 0;

    // Build consolidated message
    const lines: string[] = [];
    
    if (isFalsePositive) {
      lines.push(`--- LSP Summary: Possible false positives detected ---`);
      lines.push(`\nThe following files have had persistent errors after ${MAX_RETRIES} attempts:`);
      for (const { file } of filesAtLimit) {
        const relPath = file.replace(ctx.cwd + "/", "");
        lines.push(`  - ${relPath}`);
      }
      lines.push(`\nThese errors may be false positives from the LSP (e.g., missing dependencies, incomplete project setup).`);
      lines.push(`You can acknowledge this and stop trying to fix them if you believe they are not real issues.`);
    } else {
      lines.push(`--- LSP Summary (${files.length} file${files.length === 1 ? "" : "s"}, ${totalIssues} issue${totalIssues === 1 ? "" : "s"}) ---`);
    }

    if (filesWithIssues.length > 0) {
      for (const { file, diags, server } of filesWithIssues) {
        const relPath = file.replace(ctx.cwd + "/", "");
        lines.push(`\n${relPath} (${server}, ${diags.length} issue${diags.length === 1 ? "" : "s"}):`);
        for (const d of diags.slice(0, 10) as NormalizedDiagnostic[]) {
          const sev = d.severity.toUpperCase();
          const code = d.code ? ` [${d.code}]` : "";
          lines.push(`  L${d.line}: ${sev}${code} ${d.message}`);
        }
        if (diags.length > 10) {
          lines.push(`  ... and ${diags.length - 10} more`);
        }
      }
    }

    if (errors.length > 0) {
      lines.push(`\nLSP errors:`);
      for (const { file, error } of errors) {
        const relPath = file.replace(ctx.cwd + "/", "");
        lines.push(`  ${relPath}: ${error}`);
      }
    }

    // Add instruction for the agent
    if (!isFalsePositive) {
      lines.push(`\nPlease fix these errors.`);
    }

    // Increment retry count for files with errors
    for (const { file } of filesWithIssues) {
      retryCount.set(file, (retryCount.get(file) || 0) + 1);
    }
    
    // Send consolidated message to model, trigger new turn
    const message = lines.join("\n");
    pi.sendMessage({
      customType: "lsp-summary",
      content: message,
      display: true,
    }, {
      deliverAs: "followUp",
      triggerTurn: true,
    });
  });

  pi.on("session_shutdown", async (_event: { type: string }, ctx: ExtensionContext) => {
    if (ctx.hasUI) ctx.ui.setStatus("lsp", undefined);
    await manager?.stop();
    manager = null;
  });
}
