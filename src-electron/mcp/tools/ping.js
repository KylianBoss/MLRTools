import { z } from "zod";

/**
 * Trivial tool to validate the full chain:
 * agent -> Cloudflare Access -> tunnel -> Express /mcp -> McpServer -> tool.
 */
export function registerPing(server) {
  server.registerTool(
    "ping",
    {
      title: "Ping",
      description:
        "Health check. Returns 'pong' plus the server time. Use to verify the MCP connection works.",
      inputSchema: {
        message: z
          .string()
          .optional()
          .describe("Optional text echoed back in the response"),
      },
    },
    async ({ message }) => {
      const payload = {
        pong: true,
        serverTime: new Date().toISOString(),
        echo: message ?? null,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      };
    }
  );
}
