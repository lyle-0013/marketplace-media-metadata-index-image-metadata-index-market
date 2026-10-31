import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiClient, InfraiError } from "./infrai_client";
import { buildHandoffIndex, indexRequestSchema } from "./marketplace_media_index";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const client = new InfraiClient({ apiKey });
const port = Number(process.env.PORT ?? 8787);

createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/index") {
    response.writeHead(404).end(JSON.stringify({ error: "route_not_found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = indexRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await buildHandoffIndex(client, input);
    response.writeHead(200).end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.writeHead(400).end(JSON.stringify({ error: "invalid_request" }));
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.writeHead(status).end(JSON.stringify({ error: error.code }));
      return;
    }
    response.writeHead(502).end(JSON.stringify({ error: "upstream_error" }));
  }
}).listen(port, () => console.log(`media index listening on http://localhost:${port}`));
