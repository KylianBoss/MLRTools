import { createRemoteJWKSet, jwtVerify } from "jose";
import { getDB } from "../database.js";

/**
 * Cloudflare Access authentication middleware.
 *
 * The MCP endpoint sits behind a Cloudflare Access application on
 * mcp.mlr-tool.buzz. Cloudflare already rejects anything without a valid
 * identity (our email) or Service Token (the agent) before it reaches us.
 * This middleware is defense in depth: it re-validates the signed JWT that
 * Cloudflare injects, so a direct hit on localhost:3000/mcp still gets 403.
 *
 * Config lives in the Settings table (same place as cloudflareTunnelToken):
 *   - mcpAccessTeamDomain : e.g. "myteam" for myteam.cloudflareaccess.com
 *   - mcpAccessAud        : the Application Audience (AUD) tag from the
 *                           Access app "Overview" page
 */

let jwksCache = null;
let jwksTeamDomain = null;

async function getConfig() {
  const db = getDB();
  const [teamDomain, aud] = await Promise.all([
    db.models.Settings.getValue("mcpAccessTeamDomain"),
    db.models.Settings.getValue("mcpAccessAud"),
  ]);
  return { teamDomain, aud };
}

function getJWKS(teamDomain) {
  // Rebuild the remote key set only if the team domain changed.
  if (!jwksCache || jwksTeamDomain !== teamDomain) {
    jwksCache = createRemoteJWKSet(
      new URL(
        `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`
      )
    );
    jwksTeamDomain = teamDomain;
  }
  return jwksCache;
}

export const cfAccessAuth = async (req, res, next) => {
  try {
    const { teamDomain, aud } = await getConfig();

    if (!teamDomain || !aud) {
      console.error(
        "[mcp/auth] mcpAccessTeamDomain / mcpAccessAud not configured in Settings"
      );
      return res
        .status(503)
        .json({ error: "MCP access not configured on the server" });
    }

    // Cloudflare Access puts the assertion in this header. For service tokens
    // it is the same header, signed by the same team keys.
    const token =
      req.headers["cf-access-jwt-assertion"] ||
      (req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");

    if (!token) {
      return res
        .status(403)
        .json({ error: "Missing Cloudflare Access assertion" });
    }

    const issuer = `https://${teamDomain}.cloudflareaccess.com`;
    const { payload } = await jwtVerify(token, getJWKS(teamDomain), {
      issuer,
      audience: aud,
    });

    // Expose identity to downstream handlers / tool logging.
    req.mcpIdentity = {
      email: payload.email || null,
      sub: payload.sub || null,
      // Service tokens carry "common_name" instead of an email.
      commonName: payload.common_name || null,
      isServiceToken: Boolean(payload.common_name && !payload.email),
    };

    next();
  } catch (err) {
    console.error("[mcp/auth] JWT validation failed:", err.message);
    return res.status(403).json({ error: "Invalid Cloudflare Access token" });
  }
};
