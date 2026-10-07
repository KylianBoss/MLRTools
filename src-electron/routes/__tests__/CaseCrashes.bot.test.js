import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs";
import path from "path";

const getValueMock = vi.fn();
const findByPkMock = vi.fn();
const createPhotoMock = vi.fn();

vi.mock("../../database.js", () => ({
  getDB: () => ({
    models: {
      Settings: { getValue: getValueMock },
      CaseCrash: { findByPk: findByPkMock },
      CaseCrashPhoto: { create: createPhotoMock },
    },
  }),
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
