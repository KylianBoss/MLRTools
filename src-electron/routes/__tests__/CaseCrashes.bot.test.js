import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs";
import path from "path";

const getValueMock = vi.fn();
const findByPkMock = vi.fn();
const createPhotoMock = vi.fn();
const usersFindOneMock = vi.fn();
const axiosGetMock = vi.fn();

vi.mock("../../database.js", () => ({
  getDB: () => ({
    models: {
      Settings: { getValue: getValueMock },
      CaseCrash: { findByPk: findByPkMock },
      CaseCrashPhoto: { create: createPhotoMock },
      Users: { findOne: usersFindOneMock },
    },
  }),
}));

vi.mock("axios", () => ({
  default: { get: axiosGetMock },
}));

let app;
let CASE_CRASHES_PHOTOS_DIR;

beforeAll(async () => {
  const routerModule = await import("../CaseCrashes.routes.js");
  CASE_CRASHES_PHOTOS_DIR = routerModule.__internal.CASE_CRASHES_PHOTOS_DIR;

  app = express();
  app.use(express.json());
  app.use("/case-crashes", routerModule.default);
});

describe("POST /case-crashes/bot/:id/photo — upload d'une photo pour un crash existant", () => {
  const testCrashId = 999999;
  let testDir;

  beforeEach(() => {
    testDir = path.join(CASE_CRASHES_PHOTOS_DIR, String(testCrashId));
    getValueMock.mockReset();
    findByPkMock.mockReset();
    createPhotoMock.mockReset();
    getValueMock.mockResolvedValue("le-bon-secret");
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("rejette (401) une requête sans x-api-key", async () => {
    const res = await request(app)
      .post(`/case-crashes/bot/${testCrashId}/photo`)
      .send({ photo: "abc" });

    expect(res.status).toBe(401);
  });

  it("rejette (400) si aucun champ photo n'est fourni", async () => {
    findByPkMock.mockResolvedValue({ id: testCrashId });

    const res = await request(app)
      .post(`/case-crashes/bot/${testCrashId}/photo`)
      .set("x-api-key", "le-bon-secret")
      .send({});

    expect(res.status).toBe(400);
  });

  it("rejette (404) si le crash n'existe pas", async () => {
    findByPkMock.mockResolvedValue(null);

    const res = await request(app)
      .post(`/case-crashes/bot/${testCrashId}/photo`)
      .set("x-api-key", "le-bon-secret")
      .send({ photo: Buffer.from("x").toString("base64") });

    expect(res.status).toBe(404);
  });

  it("écrit la photo sur disque et crée la ligne CaseCrashPhoto (201)", async () => {
    findByPkMock.mockResolvedValue({ id: testCrashId });
    createPhotoMock.mockResolvedValue({});

    const res = await request(app)
      .post(`/case-crashes/bot/${testCrashId}/photo`)
      .set("x-api-key", "le-bon-secret")
      .send({ photo: Buffer.from("contenu-photo").toString("base64") });

    expect(res.status).toBe(201);
    expect(res.body.filename).toMatch(/^[0-9a-f-]+\.jpg$/);
    expect(createPhotoMock).toHaveBeenCalledWith({
      caseCrashId: String(testCrashId),
      filename: res.body.filename,
    });

    const written = fs.readFileSync(
      path.join(testDir, res.body.filename),
      "utf-8"
    );
    expect(written).toBe("contenu-photo");
  });

  it("permet plusieurs requêtes successives pour le même crash (une par photo)", async () => {
    findByPkMock.mockResolvedValue({ id: testCrashId });
    createPhotoMock.mockResolvedValue({});

    const res1 = await request(app)
      .post(`/case-crashes/bot/${testCrashId}/photo`)
      .set("x-api-key", "le-bon-secret")
      .send({ photo: Buffer.from("photo-1").toString("base64") });
    const res2 = await request(app)
      .post(`/case-crashes/bot/${testCrashId}/photo`)
      .set("x-api-key", "le-bon-secret")
      .send({ photo: Buffer.from("photo-2").toString("base64") });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.filename).not.toBe(res2.body.filename);
    expect(createPhotoMock).toHaveBeenCalledTimes(2);
  });
});

describe("GET /case-crashes/:id/photos/:filename — lecture (régression 2026-10-07)", () => {
  const testCrashId = 888888;
  const testFilename = "abc12345-0000-0000-0000-000000000000.jpg";
  let testDir;

  beforeEach(() => {
    testDir = path.join(CASE_CRASHES_PHOTOS_DIR, String(testCrashId));
    getValueMock.mockReset();
    usersFindOneMock.mockReset();
    axiosGetMock.mockReset();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it(
    "BUG RÉEL (2026-10-07) : x-api-key valide suffit, requirePermission n'est jamais appelé " +
      "— avant le fix, cette requête recevait 400 'Username is required for permission check'",
    async () => {
      getValueMock.mockImplementation((key) => {
        if (key === "botApiKey") return Promise.resolve("le-bon-secret");
        if (key === "cloudflareTunnelPublicUrl")
          return Promise.resolve("https://crashes.example.test");
        return Promise.resolve(null);
      });
      axiosGetMock.mockResolvedValue({
        status: 200,
        headers: { "content-type": "image/jpeg" },
        data: Buffer.from("contenu-image"),
      });

      const res = await request(app)
        .get(`/case-crashes/${testCrashId}/photos/${testFilename}`)
        .set("x-api-key", "le-bon-secret");

      expect(res.status).toBe(200);
      // requirePermission exigerait x-username / body.username / query.username —
      // aucun fourni ici. S'il avait été appelé, on aurait un 400, pas 200.
      expect(usersFindOneMock).not.toHaveBeenCalled();
    }
  );

  it(
    "BUG RÉEL (2026-10-07) : passe un httpsAgent non-strict pour tolérer un proxy " +
      "d'inspection SSL d'entreprise — avant le fix, cet appel échouait en " +
      "SELF_SIGNED_CERT_IN_CHAIN sur certains réseaux (502 côté machine appelante)",
    async () => {
      getValueMock.mockImplementation((key) => {
        if (key === "botApiKey") return Promise.resolve("le-bon-secret");
        if (key === "cloudflareTunnelPublicUrl")
          return Promise.resolve("https://crashes.example.test");
        return Promise.resolve(null);
      });
      axiosGetMock.mockResolvedValue({
        status: 200,
        headers: { "content-type": "image/jpeg" },
        data: Buffer.from("contenu-image"),
      });

      await request(app)
        .get(`/case-crashes/${testCrashId}/photos/${testFilename}`)
        .set("x-api-key", "le-bon-secret");

      const callOptions = axiosGetMock.mock.calls[0][1];
      expect(callOptions.httpsAgent).toBeDefined();
      expect(callOptions.httpsAgent.options.rejectUnauthorized).toBe(false);
    }
  );

  it("rejette (401) une x-api-key invalide", async () => {
    getValueMock.mockResolvedValue("le-bon-secret");

    const res = await request(app)
      .get(`/case-crashes/${testCrashId}/photos/${testFilename}`)
      .set("x-api-key", "mauvaise-cle");

    expect(res.status).toBe(401);
  });

  it("sans x-api-key, retombe sur requirePermission (401/400 selon le username fourni)", async () => {
    const res = await request(app).get(
      `/case-crashes/${testCrashId}/photos/${testFilename}`
    );

    // Pas de x-api-key et pas de x-username : requirePermission répond
    // directement, sans jamais toucher à Settings.getValue.
    expect(res.status).toBe(400);
    expect(getValueMock).not.toHaveBeenCalled();
  });

  it("lit le fichier local directement si présent, sans jamais appeler axios (cas machine bot)", async () => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, testFilename), "contenu-local");
    getValueMock.mockResolvedValue("le-bon-secret");

    const res = await request(app)
      .get(`/case-crashes/${testCrashId}/photos/${testFilename}`)
      .set("x-api-key", "le-bon-secret");

    expect(res.status).toBe(200);
    expect(axiosGetMock).not.toHaveBeenCalled();
  });

  it("rejette (400) un nom de fichier non sûr (path traversal)", async () => {
    getValueMock.mockResolvedValue("le-bon-secret");

    const res = await request(app)
      .get(`/case-crashes/${testCrashId}/photos/..%2F..%2Fsettings`)
      .set("x-api-key", "le-bon-secret");

    expect(res.status).toBe(400);
  });
});
