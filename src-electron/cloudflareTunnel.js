import { bin, install, Tunnel } from "cloudflared";
import fs from "fs";
import { getDB } from "./database.js";

let tunnel = null;

async function readTunnelToken() {
  const db = getDB();
  return db.models.Settings.getValue("cloudflareTunnelToken");
}

export async function startTunnel() {
  const token = await readTunnelToken();

  if (!token) {
    console.log("No Cloudflare tunnel token configured, skipping tunnel start");
    return;
  }

  if (!fs.existsSync(bin)) {
    console.log("Installing cloudflared binary...");
    await install(bin);
  }

  tunnel = Tunnel.withToken(token);

  tunnel.on("connected", (conn) => {
    console.log("Cloudflare tunnel connected:", conn);
  });
  tunnel.on("error", (error) => {
    console.error("Cloudflare tunnel error:", error);
  });
  tunnel.on("exit", (code) => {
    console.log(`Cloudflare tunnel process exited with code ${code}`);
    tunnel = null;
  });

  console.log("Cloudflare tunnel started");
}

export function stopTunnel() {
  if (tunnel) {
    tunnel.stop();
    tunnel = null;
    console.log("Cloudflare tunnel stopped");
  }
}
