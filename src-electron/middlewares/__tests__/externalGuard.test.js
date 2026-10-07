import { describe, it, expect, vi, beforeEach } from "vitest";
import { isCloudflareIp, externalGuard, __internal } from "../externalGuard.js";

describe("isCloudflareIp — classification par IP TCP source uniquement", () => {
  it("reconnaît une IP IPv4 au début d'une plage Cloudflare", () => {
    expect(isCloudflareIp("173.245.48.0")).toBe(true);
  });

  it("reconnaît une IP IPv4 à la fin d'une plage Cloudflare (/20)", () => {
    expect(isCloudflareIp("173.245.63.255")).toBe(true);
  });

  it("rejette une IPv4 juste hors d'une plage Cloudflare", () => {
    expect(isCloudflareIp("173.245.64.0")).toBe(false);
  });

  it("rejette une IPv4 de réseau local privé (usage interne légitime)", () => {
    expect(isCloudflareIp("192.168.1.50")).toBe(false);
    expect(isCloudflareIp("10.0.0.5")).toBe(false);
  });

  it("rejette localhost", () => {
    expect(isCloudflareIp("127.0.0.1")).toBe(false);
  });

  it("reconnaît une IPv6 Cloudflare", () => {
    expect(isCloudflareIp("2606:4700::1")).toBe(true);
  });

  it("rejette une IPv6 hors plage Cloudflare", () => {
    expect(isCloudflareIp("2001:db8::1")).toBe(false);
  });

  it("gère le préfixe IPv4-mapped IPv6 (::ffff:) sur une IP Cloudflare", () => {
    expect(isCloudflareIp("::ffff:173.245.48.1")).toBe(true);
  });

  it("fail-safe: IP absente est traitée comme externe", () => {
    expect(isCloudflareIp(null)).toBe(true);
    expect(isCloudflareIp(undefined)).toBe(true);
  });

  it("fail-safe: IP invalide/non résolvable est traitée comme externe", () => {
    expect(isCloudflareIp("not-an-ip")).toBe(true);
  });

  it("ne se fie jamais à un en-tête CF forgé — seule l'IP TCP compte (D7)", () => {
    // Une IP locale avec un header CF-Connecting-IP forgé doit rester interne :
    // isCloudflareIp ne prend même pas les headers en paramètre, par construction.
    expect(isCloudflareIp("192.168.1.50")).toBe(false);
  });
});

function buildReq({ remoteAddress, method = "GET", path = "/", headers = {} }) {
  return {
    socket: { remoteAddress },
    method,
    path,
    headers,
  };
}

function buildRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("externalGuard — middleware fail-closed", () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("bloque (403) une requête externe sur une route NON whitelistée", () => {
    const req = buildReq({ remoteAddress: "173.245.48.1", path: "/settings/" });
    const res = buildRes();
    const next = vi.fn();

    externalGuard(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("route nommée explicitement (D6): GET /settings/ bloquée pour IP externe", () => {
    const req = buildReq({
      remoteAddress: "104.16.0.1",
      method: "GET",
      path: "/settings/",
    });
    const res = buildRes();
    const next = vi.fn();

    externalGuard(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("route nommée explicitement (D6): PUT /settings/:key bloquée pour IP externe", () => {
    const req = buildReq({
      remoteAddress: "104.16.0.1",
      method: "PUT",
      path: "/settings/botApiKey",
    });
    const res = buildRes();
    const next = vi.fn();

    externalGuard(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("laisse passer une requête externe sur la route whitelistée (POST /case-crashes/bot)", () => {
    const req = buildReq({
      remoteAddress: "173.245.48.1",
      method: "POST",
      path: "/case-crashes/bot",
    });
    const res = buildRes();
    const next = vi.fn();

    externalGuard(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeNull();
  });

  it("laisse passer une requête locale (réseau interne) sans restriction", () => {
    const req = buildReq({ remoteAddress: "192.168.1.50", path: "/settings/" });
    const res = buildRes();
    const next = vi.fn();

    externalGuard(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeNull();
  });

  it("ignore un en-tête CF-Connecting-IP forgé sur une requête dont l'IP TCP est locale (D7)", () => {
    const req = buildReq({
      remoteAddress: "192.168.1.50",
      path: "/settings/",
      headers: { "cf-connecting-ip": "173.245.48.1", "cf-ray": "fake-ray-id" },
    });
    const res = buildRes();
    const next = vi.fn();

    externalGuard(req, res, next);

    // L'IP TCP réelle (locale) doit l'emporter sur le header forgé : la requête passe.
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeNull();
  });

  it("fail-safe (D5): IP source non résolvable est bloquée sur une route non whitelistée", () => {
    const req = buildReq({ remoteAddress: undefined, path: "/settings/" });
    const res = buildRes();
    const next = vi.fn();

    externalGuard(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("__internal — helpers exposés pour les tests", () => {
  it("isWhitelisted reconnaît uniquement POST /case-crashes/bot", () => {
    expect(
      __internal.isWhitelisted({ method: "POST", path: "/case-crashes/bot" })
    ).toBe(true);
    expect(
      __internal.isWhitelisted({ method: "GET", path: "/case-crashes/bot" })
    ).toBe(false);
    expect(
      __internal.isWhitelisted({ method: "POST", path: "/settings/" })
    ).toBe(false);
  });

  it("normalizeRemoteAddress retire le préfixe IPv4-mapped IPv6", () => {
    expect(__internal.normalizeRemoteAddress("::ffff:10.0.0.1")).toBe("10.0.0.1");
    expect(__internal.normalizeRemoteAddress("10.0.0.1")).toBe("10.0.0.1");
    expect(__internal.normalizeRemoteAddress(null)).toBeNull();
  });
});
