import { stdin, stdout } from "node:process";
let buffer = Buffer.alloc(0);
let currentUri = null;
let changeCount = 0;
stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const end = buffer.indexOf("\r\n\r\n");
    if (end < 0) break;
    const match = buffer.subarray(0, end).toString().match(/Content-Length:\s*(\d+)/i);
    if (!match) { buffer = buffer.subarray(end + 4); continue; }
    const length = Number(match[1]);
    if (buffer.length < end + 4 + length) break;
    const message = JSON.parse(buffer.subarray(end + 4, end + 4 + length));
    buffer = buffer.subarray(end + 4 + length);
    handle(message);
  }
});
const send = (msg) => {
  const body = JSON.stringify(msg);
  stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
};
const publish = (msg, version) => {
  send({
    jsonrpc: "2.0",
    method: "textDocument/publishDiagnostics",
    params: {
      uri: currentUri ?? "file:///fixture.ts",
      version: version ?? null,
      diagnostics: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, severity: 1, message: msg }],
    },
  });
};
const handle = (msg) => {
  if (msg.method === "textDocument/didOpen") {
    currentUri = msg.params.textDocument.uri;
    publish("v1", msg.params.textDocument.version);
  }
  if (msg.method === "textDocument/didChange") {
    currentUri = msg.params.textDocument.uri;
    changeCount += 1;
    publish(`v2-${changeCount}`, msg.params.textDocument.version);
  }
  if (msg.method === "initialize") return send({ jsonrpc: "2.0", id: msg.id, result: { capabilities: {} } });
  if (msg.method === "shutdown") return send({ jsonrpc: "2.0", id: msg.id, result: null });
  if (msg.method === "workspace/configuration") return send({ jsonrpc: "2.0", id: msg.id, result: msg.params.items.map(() => null) });
  if (msg.method === "workspace/workspaceFolders") return send({ jsonrpc: "2.0", id: msg.id, result: [{ uri: "file:///tmp", name: "tmp" }] });
};
