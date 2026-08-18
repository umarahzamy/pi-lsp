# pi-lsp

> **⚠️ Vibecoded toy - don't trust it.**
>
>LSP diagnostics integration for Pi. Injects compiler/type errors into the model's view after reading source files.

## What it does

- Hooks into Pi's `tool_result` event after `read` calls
- Queries LSP servers for diagnostics on the file that was just read
- Appends errors/warnings inline so the model sees them immediately
- No Neovim required - spawns LSP servers directly via JSON-RPC

## Install

```bash
pi install git:github.com/umarahzamy/pi-lsp
```

## Dev

```bash
npm install
npm run typecheck
npm test
```

## License

MIT
