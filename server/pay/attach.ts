import type { IncomingMessage, ServerResponse } from "node:http";
import { handlePayRequest } from "./handle";

async function toRequest(req: IncomingMessage) {
  const host = req.headers.host ?? "localhost";
  const url = `http://${host}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  const method = (req.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return new Request(url, { method, headers });
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > 100_000) throw new Error("body");
    chunks.push(buf);
  }
  return new Request(url, { method, headers, body: Buffer.concat(chunks) });
}

export function attachPayApi(req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) {
  const path = (req.url ?? "").split("?", 1)[0] ?? "";
  if (!path.startsWith("/api/pay")) {
    next();
    return;
  }
  void (async () => {
    try {
      const response = await handlePayRequest(await toRequest(req));
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      res.end(bytes);
    } catch (err) {
      console.error("[pay]", err instanceof Error ? err.message : "lỗi");
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Lỗi máy chủ thanh toán" }));
      }
    }
  })();
}
