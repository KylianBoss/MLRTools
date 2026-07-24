import { bin as packagedBin, install, use, Tunnel } from "cloudflared";
import fs from "fs";
import path from "path";
import { getDB } from "./database.js";

// electron-packager keeps the app source inside an .asar archive, which can't
// execute binaries directly - cloudflared.exe must be unpacked (see quasar.config.js
// asar.unpack) and resolved from app.asar.unpacked instead of app.asar.
const bin = packagedBin.includes(`${path.sep}app.asar${path.sep}`)
  ? packagedBin.replace(
      `${path.sep}app.asar${path.sep}`,
      `${path.sep}app.asar.unpacked${path.sep}`
    )
  : packagedBin;
use(bin);

let tunnel = null;
let status = {
  state: "stopped", // "stopped" | "not_configured" | "starting" | "connected" | "error"
  connection: null,
  error: null,
  updatedAt: new Date(),
};

function setStatus(partial) {
  status = { ...status, ...partial, updatedAt: new Date() };
}

export function getTunnelStatus() {
  return status;
}

async function readTunnelToken() {
  const db = getDB();
  return db.models.Settings.getValue("cloudflareTunnelToken");
}

export async function startTunnel() {
  const token = await readTunnelToken();

  if (!token) {
    console.log("No Cloudflare tunnel token configured, skipping tunnel start");
    setStatus({ state: "not_configured", connection: null, error: null });
    return;
  }

  setStatus({ state: "starting", connection: null, error: null });

  if (!fs.existsSync(bin)) {
    console.log("Installing cloudflared binary...");
    await install(bin);
  }

  tunnel = Tunnel.withToken(token);

  tunnel.on("connected", (conn) => {
    console.log("Cloudflare tunnel connected:", conn);
    setStatus({ state: "connected", connection: conn, error: null });
  });
  tunnel.on("error", (error) => {
    console.error("Cloudflare tunnel error:", error);
    setStatus({ state: "error", error: error.message || String(error) });
  });
  tunnel.on("exit", (code) => {
    console.log(`Cloudflare tunnel process exited with code ${code}`);
    tunnel = null;
    setStatus({ state: "stopped", connection: null });
  });

  console.log("Cloudflare tunnel started");
}

export function stopTunnel() {
  if (tunnel) {
    tunnel.stop();
    tunnel = null;
    setStatus({ state: "stopped", connection: null, error: null });
    console.log("Cloudflare tunnel stopped");
  }
}
