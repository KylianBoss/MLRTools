import net from "net";

/**
 * Plages IP officielles Cloudflare (cloudflare.com/ips-v4, /ips-v6).
 * Incident sécurité 2026-10-07 : le tunnel cloudflared expose tout le
 * serveur Express sans filtrage de chemin. Ce middleware distingue le
 * trafic venu du tunnel (IP source Cloudflare) du trafic réseau local
 * légitime, et bloque le premier sur tout ce qui n'est pas explicitement
 * whitelisté.
 *
 * Décision délibérée : on ne fait JAMAIS confiance aux en-têtes
 * CF-Connecting-IP / CF-Ray pour la classification — rien ne garantit
 * qu'ils ont été injectés exclusivement par Cloudflare avant d'atteindre
 * Express, donc un appelant externe pourrait les forger lui-même sur une
 * requête qui n'a jamais transité par le tunnel. Seule l'IP TCP source
 * (non falsifiable au niveau applicatif) sert de signal de décision.
 */
const CLOUDFLARE_IPV4_RANGES = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
];

const CLOUDFLARE_IPV6_RANGES = [
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

function ipv4ToLong(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isIpv4InCidr(ip, cidr) {
  const [range, bitsStr] = cidr.split("/");
  const bits = parseInt(bitsStr, 10);
  const ipLong = ipv4ToLong(ip);
  const rangeLong = ipv4ToLong(range);
  if (ipLong === null || rangeLong === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipLong & mask) === (rangeLong & mask);
}

function ipv6ToBigInt(ip) {
  const full = net.isIPv6(ip) ? normalizeIpv6(ip) : null;
  if (!full) return null;
  return full.reduce((acc, part) => (acc << 16n) | BigInt(part), 0n);
}

function normalizeIpv6(ip) {
  const [head, tail] = ip.split("::");
  const headParts = head ? head.split(":").filter(Boolean).map((p) => parseInt(p, 16)) : [];
  const tailParts = tail ? tail.split(":").filter(Boolean).map((p) => parseInt(p, 16)) : [];
  if (!ip.includes("::")) {
    const parts = ip.split(":").map((p) => parseInt(p, 16));
    return parts.length === 8 ? parts : null;
  }
  const missing = 8 - headParts.length - tailParts.length;
  if (missing < 0) return null;
  return [...headParts, ...new Array(missing).fill(0), ...tailParts];
}

function isIpv6InCidr(ip, cidr) {
  const [range, bitsStr] = cidr.split("/");
  const bits = BigInt(parseInt(bitsStr, 10));
  const ipBig = ipv6ToBigInt(ip);
  const rangeBig = ipv6ToBigInt(range);
  if (ipBig === null || rangeBig === null) return false;
  const mask = bits === 0n ? 0n : (~0n << (128n - bits)) & ((1n << 128n) - 1n);
  return (ipBig & mask) === (rangeBig & mask);
}

/**
 * Normalise une IP de connexion (gère le préfixe IPv4-mapped IPv6 "::ffff:").
 */
function normalizeRemoteAddress(address) {
  if (!address) return null;
  if (address.startsWith("::ffff:")) {
    return address.slice("::ffff:".length);
  }
  return address;
}

/**
 * Vrai si l'IP correspond à une plage officielle Cloudflare (IPv4 ou IPv6).
 * Toute IP non résolvable/invalide est traitée comme Cloudflare par défaut
 * (fail-safe) — en cas de doute, on classe le trafic comme externe plutôt
 * que de risquer un contournement.
 */
export function isCloudflareIp(rawAddress) {
  const address = normalizeRemoteAddress(rawAddress);
  if (!address) return true; // fail-safe : IP absente/non résolvable → externe

  if (net.isIPv4(address)) {
    return CLOUDFLARE_IPV4_RANGES.some((cidr) => isIpv4InCidr(address, cidr));
  }
  if (net.isIPv6(address)) {
    return CLOUDFLARE_IPV6_RANGES.some((cidr) => isIpv6InCidr(address, cidr));
  }
  return true; // fail-safe : format inattendu → externe
}

/**
 * Chemins autorisés à être atteints depuis l'extérieur (via le tunnel
 * Cloudflare). Tout le reste est bloqué pour les requêtes classées
 * externes.
 *
 * ATTENTION : routes/index.js monte chaque routeur SANS préfixe /api
 * (router.use("/case-crashes", CaseCrashesRouter), pas "/api/case-crashes").
 * Erreur corrigée le 2026-10-07 après un test curl réel qui a révélé que
 * ni cette whitelist ni la règle de path Cloudflare ne matchaient le vrai
 * chemin — toujours vérifier le chemin RÉEL monté, jamais le supposer.
 */
const EXTERNAL_WHITELIST = [{ method: "POST", path: "/case-crashes/bot" }];

function isWhitelisted(req) {
  return EXTERNAL_WHITELIST.some(
    (entry) => entry.method === req.method && req.path === entry.path
  );
}

/**
 * Middleware fail-closed : à monter tout en haut de server.js, avant
 * app.use(routes). Bloque (403) toute requête dont l'IP source est dans
 * une plage Cloudflare ET qui ne figure pas dans EXTERNAL_WHITELIST.
 * Les en-têtes CF-Connecting-IP/CF-Ray sont loggés à titre informatif
 * uniquement — jamais utilisés pour la décision (voir commentaire en tête
 * de fichier).
 */
export function externalGuard(req, res, next) {
  const remoteAddress = req.socket?.remoteAddress;
  const external = isCloudflareIp(remoteAddress);

  if (external && !isWhitelisted(req)) {
    console.warn(
      `[externalGuard] Requête externe bloquée: ${req.method} ${req.path} ` +
        `(ip=${remoteAddress}, cf-connecting-ip=${req.headers["cf-connecting-ip"] || "-"}, cf-ray=${req.headers["cf-ray"] || "-"})`
    );
    return res.status(403).json({
      error: "Accès refusé depuis l'extérieur pour cette route.",
    });
  }

  next();
}

export const __internal = {
  isIpv4InCidr,
  isIpv6InCidr,
  normalizeRemoteAddress,
  isWhitelisted,
  EXTERNAL_WHITELIST,
};
