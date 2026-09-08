import { Router } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { cfAccessAuth } from "./auth.js";
import { registerPing } from "./tools/ping.js";

/**
 * MCP server for the MLR agent.
 *
 * Like the Cloudflare tunnel, this must only run on the "bot" instance of the
 * app. It is mounted at boot (in server.js) but stays inert until enableMcp()
 * is called from POST /cron/initialize, which only happens for a user whose
 * isBot flag is true. A normal instance never enables it.
 */

let mcpEnabled = false;

export function enableMcp() {
  if (!mcpEnabled) {
    mcpEnabled = true;
    console.log("[mcp] enabled (bot instance)");
  }
}

export function isMcpEnabled() {
  return mcpEnabled;
}

/**
 * Build a fresh McpServer with all tools registered.
 * A new instance is created per request (stateless Streamable HTTP).
 */
function buildServer() {
  const server = new McpServer({
    name: "mlr-mcp",
    version: "1.0.0",
  });

  registerPing(server);
  // Phase 4 tools get registered here.

  return server;
}

/**
 * Express router for the /mcp endpoint.
 *
 * - GET  /mcp/health : always responds, reports { enabled }
 * - ALL  /mcp        : Cloudflare Access auth + gate, then MCP over Streamable HTTP
 */
export function createMcpRouter() {
  const router = Router();

  router.get("/health", (req, res) => {
    res.json({ ok: true, enabled: mcpEnabled });
  });

  // Gate: inert until the bot instance enables it.
  router.use((req, res, next) => {
    if (!mcpEnabled) {
      return res
        .status(503)
        .json({ error: "MCP is not enabled on this instance" });
    }
    next();
  });

  // Defense-in-depth auth (Cloudflare Access already fronts this in prod).
  router.use(cfAccessAuth);

  // Stateless MCP: one server + transport per request, no session store.
  router.post("/", async (req, res) => {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("[mcp] request error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "MCP internal error" });
      }
    }
  });

  // GET / DELETE are not used in stateless mode.
  const methodNotAllowed = (req, res) =>
    res.status(405).json({ error: "Method not allowed" });
  router.get("/", methodNotAllowed);
  router.delete("/", methodNotAllowed);

  return router;
}
