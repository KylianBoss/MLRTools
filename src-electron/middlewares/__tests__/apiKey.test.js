import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const getValueMock = vi.fn();

vi.mock("../../database.js", () => ({
  getDB: () => ({
    models: {
      Settings: { getValue: getValueMock },
    },
  }),
}));

let checkApiKey;
beforeAll(async () => {
  ({ checkApiKey } = await import("../apiKey.js"));
});

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

describe("checkApiKey — régression (middleware existant, non modifié par l'incident)", () => {
  beforeEach(() => {
    getValueMock.mockReset();
  });

  it("rejette (401) une requête sans header x-api-key", async () => {
    const req = { headers: {} };
    const res = buildRes();
    const next = vi.fn();

    await checkApiKey(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejette (401) une clé API incorrecte", async () => {
    getValueMock.mockResolvedValue("le-vrai-secret");
    const req = { headers: { "x-api-key": "mauvaise-cle" } };
    const res = buildRes();
    const next = vi.fn();

    await checkApiKey(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepte la bonne clé API et appelle next()", async () => {
    getValueMock.mockResolvedValue("le-vrai-secret");
    const req = { headers: { "x-api-key": "le-vrai-secret" } };
    const res = buildRes();
    const next = vi.fn();

    await checkApiKey(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeNull();
  });

  it("rejette (401) si aucun botApiKey n'est configuré en DB (jamais de fail-open)", async () => {
    getValueMock.mockResolvedValue(null);
    const req = { headers: { "x-api-key": "n-importe-quoi" } };
    const res = buildRes();
    const next = vi.fn();

    await checkApiKey(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("sert de preuve de non-régression après rotation du secret (T1) : seule la nouvelle valeur passe", async () => {
    getValueMock.mockResolvedValue("nouveau-secret-apres-rotation");
    const reqOld = { headers: { "x-api-key": "ancien-secret" } };
    const reqNew = { headers: { "x-api-key": "nouveau-secret-apres-rotation" } };
    const resOld = buildRes();
    const resNew = buildRes();
    const nextOld = vi.fn();
    const nextNew = vi.fn();

    await checkApiKey(reqOld, resOld, nextOld);
    await checkApiKey(reqNew, resNew, nextNew);

    expect(resOld.statusCode).toBe(401);
    expect(nextOld).not.toHaveBeenCalled();
    expect(nextNew).toHaveBeenCalledOnce();
    expect(resNew.statusCode).toBeNull();
  });
});
