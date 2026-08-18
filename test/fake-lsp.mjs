import { stdin, stdout } from "node:process";
let buffer = Buffer.alloc(0);
let received = [];
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
function send(message) {
  const body = JSON.stringify(message);
  stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}
function publishDiagnostics(message) {
  send({
    jsonrpc: "2.0",
    method: "textDocument/publishDiagnostics",
    params: {
      uri: currentUri ?? "file:///fixture.ts",
      diagnostics: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, severity: 1, message }],
    },
  });
}
function handle(message) {
  if (message.method === "textDocument/didOpen") {
    currentUri = message.params.textDocument.uri;
    received.push(message.method);
    publishDiagnostics("v1");
  }
  if (message.method === "textDocument/didChange") {
    currentUri = message.params.textDocument.uri;
    changeCount += 1;
    received.push(message.method);
    publishDiagnostics(`v2-${changeCount}`);
  }
  if (message.method === "initialize") return send({ jsonrpc: "2.0", id: message.id, result: { capabilities: {} } });
  if (message.method === "shutdown") return send({ jsonrpc: "2.0", id: message.id, result: null });
}
