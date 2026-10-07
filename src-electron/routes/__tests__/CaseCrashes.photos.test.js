import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { __internal } from "../CaseCrashes.routes.js";

const { isSafeFilename, savePhotoToDisk, CASE_CRASHES_PHOTOS_DIR } = __internal;

describe("isSafeFilename — jamais un chemin, jamais de traversal", () => {
  it("accepte un nom de fichier uuid + extension image valide", () => {
    expect(isSafeFilename("550e8400-e29b-41d4-a716-446655440000.jpg")).toBe(true);
    expect(isSafeFilename("abc123.png")).toBe(true);
    expect(isSafeFilename("abc123.webp")).toBe(true);
  });

  it("rejette un chemin contenant un séparateur de répertoire", () => {
    expect(isSafeFilename("../../etc/passwd")).toBe(false);
    expect(isSafeFilename("sub/dir/file.jpg")).toBe(false);
    expect(isSafeFilename("..\\windows\\system32")).toBe(false);
  });

  it("rejette une extension non image", () => {
    expect(isSafeFilename("script.js")).toBe(false);
    expect(isSafeFilename("archive.zip")).toBe(false);
    expect(isSafeFilename("noextension")).toBe(false);
  });

  it("rejette un type non-string", () => {
    expect(isSafeFilename(null)).toBe(false);
    expect(isSafeFilename(undefined)).toBe(false);
    expect(isSafeFilename(42)).toBe(false);
  });
});

describe("savePhotoToDisk — décodage base64 et écriture sur disque", () => {
  const testCrashId = "test-photos-vitest";
  const testDir = path.join(CASE_CRASHES_PHOTOS_DIR, testCrashId);

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("décode une data URL et écrit le fichier avec la bonne extension", () => {
    // 1x1 pixel PNG transparent, en base64
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

    const filename = savePhotoToDisk(testCrashId, dataUrl);

    expect(filename).toMatch(/^[0-9a-f-]+\.png$/);
    expect(isSafeFilename(filename)).toBe(true);
    const written = fs.readFileSync(path.join(testDir, filename));
    expect(written.length).toBeGreaterThan(0);
  });

  it("décode un base64 brut (sans préfixe data URL) et utilise .jpg par défaut", () => {
    const rawBase64 = Buffer.from("test-content").toString("base64");

    const filename = savePhotoToDisk(testCrashId, rawBase64);

    expect(filename).toMatch(/^[0-9a-f-]+\.jpg$/);
    const written = fs.readFileSync(path.join(testDir, filename), "utf-8");
    expect(written).toBe("test-content");
  });

  it("génère un nom de fichier différent à chaque appel, jamais celui fourni par l'appelant", () => {
    const rawBase64 = Buffer.from("x").toString("base64");

    const filename1 = savePhotoToDisk(testCrashId, rawBase64);
    const filename2 = savePhotoToDisk(testCrashId, rawBase64);

    expect(filename1).not.toBe(filename2);
  });

  it("crée le répertoire du crash s'il n'existe pas encore", () => {
    expect(fs.existsSync(testDir)).toBe(false);

    savePhotoToDisk(testCrashId, Buffer.from("x").toString("base64"));

    expect(fs.existsSync(testDir)).toBe(true);
  });
});
