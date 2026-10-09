import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import https from "https";
import axios from "axios";
import { getDB } from "../database.js";
import { requirePermission } from "../middlewares/permissions.js";
import { checkApiKey } from "../middlewares/apiKey.js";

const router = Router();

// Sur certains réseaux d'entreprise (observé 2026-10-07 : même réseau local
// que la machine bot), un proxy d'inspection SSL re-signe le trafic HTTPS
// sortant avec un certificat interne — le navigateur/OS lui fait confiance
// (installé par politique d'entreprise), mais le magasin de certificats de
// Node ne le connaît pas, d'où un échec SELF_SIGNED_CERT_IN_CHAIN sur l'appel
// axios ci-dessous. On ne peut pas déposer ce certificat dans le repo (public)
// ni injecter NODE_EXTRA_CA_CERTS (pas d'accès aux variables d'environnement
// du poste) — on désactive donc la vérification TLS UNIQUEMENT pour cet appel
// précis (proxy serveur-à-serveur vers le bot, sur un réseau déjà considéré
// de confiance), jamais globalement. L'authenticité du bot reste garantie
// par botApiKey, pas par TLS, pour cet appel.
const insecureAgentForCorporateProxy = new https.Agent({
  rejectUnauthorized: false,
});

const STORAGE_PATH = path.join(process.cwd(), "storage");
const CASE_CRASHES_PHOTOS_DIR = path.join(STORAGE_PATH, "case-crashes");

// Un nom de fichier généré par nous (uuid + extension), jamais un chemin —
// bloque tout ".." ou séparateur de répertoire fourni par un appelant.
const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/;

function isSafeFilename(filename) {
  return typeof filename === "string" && SAFE_FILENAME_PATTERN.test(filename);
}

/**
 * Décode un payload base64 (brut ou en data URL "data:image/...;base64,...")
 * et l'écrit sur disque sous un nom de fichier généré côté serveur (jamais
 * celui fourni par l'appelant). Retourne le nom de fichier écrit.
 */
function savePhotoToDisk(caseCrashId, base64Payload) {
  const dirPath = path.join(CASE_CRASHES_PHOTOS_DIR, String(caseCrashId));
  fs.mkdirSync(dirPath, { recursive: true });

  const match = /^data:image\/(\w+);base64,(.+)$/.exec(base64Payload);
  const extension = match ? match[1].replace("jpeg", "jpg") : "jpg";
  const rawBase64 = match ? match[2] : base64Payload;

  const filename = `${uuidv4()}.${extension}`;
  const filePath = path.join(dirPath, filename);
  fs.writeFileSync(filePath, Buffer.from(rawBase64, "base64"));

  return filename;
}

const ZONES = ["F013", "X001", "X002", "X003", "X101", "X102", "X103", "X104"];

const CASE_TYPES = ["A", "B", "C", "E", "H", "U"];

function validateCaseCrashPayload({ crashDate, zone, caseTypes }) {
  if (!crashDate) {
    return "crashDate is required";
  }
  if (!zone || !ZONES.includes(zone)) {
    return "A valid zone is required";
  }
  if (!Array.isArray(caseTypes) || caseTypes.length === 0) {
    return "At least one case type is required";
  }
  const invalidTypes = caseTypes.filter((t) => !CASE_TYPES.includes(t));
  if (invalidTypes.length > 0) {
    return `Invalid case types: ${invalidTypes.join(", ")}`;
  }
  return null;
}

async function createCaseCrash(db, { crashDate, zone, caseTypes, createdBy }) {
  const t = await db.transaction();
  let crash;
  try {
    crash = await db.models.CaseCrash.create(
      {
        crashDate,
        zone,
        createdBy,
      },
      { transaction: t }
    );

    await db.models.CaseCrashType.bulkCreate(
      [...new Set(caseTypes)].map((caseType) => ({
        caseCrashId: crash.id,
        caseType,
      })),
      { transaction: t }
    );

    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }

  const created = await db.models.CaseCrash.findByPk(crash.id, {
    include: [
      {
        model: db.models.CaseCrashType,
        as: "caseTypes",
        attributes: ["caseType"],
      },
    ],
  });

  const data = created.toJSON();
  return {
    ...data,
    caseTypes: data.caseTypes.map((ct) => ct.caseType),
  };
}

// Get all case crashes (with their case types)
router.get("/", requirePermission("canAccessCaseCrashes"), async (req, res) => {
  const db = getDB();

  try {
    const crashes = await db.models.CaseCrash.findAll({
      include: [
        {
          model: db.models.CaseCrashType,
          as: "caseTypes",
          attributes: ["caseType"],
        },
        {
          model: db.models.Users,
          as: "creator",
          attributes: ["fullname"],
        },
        {
          model: db.models.CaseCrashPhoto,
          as: "photos",
          attributes: ["filename"],
        },
      ],
      order: [
        ["crashDate", "DESC"],
        ["id", "DESC"],
      ],
    });

    const formatted = crashes.map((crash) => {
      const data = crash.toJSON();
      return {
        ...data,
        caseTypes: data.caseTypes.map((t) => t.caseType),
        creatorFullname: data.creator?.fullname || data.createdBy,
        creator: undefined,
        photos: data.photos.map((p) => p.filename),
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching case crashes:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get the pivot table (dates x zones -> count)
router.get(
  "/pivot",
  requirePermission("canAccessCaseCrashes"),
  async (req, res) => {
    const db = getDB();

    try {
      const crashes = await db.models.CaseCrash.findAll({
        attributes: ["crashDate", "zone"],
        order: [["crashDate", "DESC"]],
      });

      const rows = new Map();

      for (const crash of crashes) {
        const date = crash.crashDate;
        if (!rows.has(date)) {
          const emptyRow = { date };
          ZONES.forEach((zone) => (emptyRow[zone] = 0));
          rows.set(date, emptyRow);
        }
        rows.get(date)[crash.zone] += 1;
      }

      res.json({
        zones: ZONES,
        rows: [...rows.values()],
      });
    } catch (error) {
      console.error("Error building case crashes pivot:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Create a new case crash
router.post(
  "/",
  requirePermission("canAccessCaseCrashes"),
  async (req, res) => {
    const db = getDB();
    const { crashDate, zone, caseTypes } = req.body;

    const validationError = validateCaseCrashPayload({
      crashDate,
      zone,
      caseTypes,
    });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    try {
      const result = await createCaseCrash(db, {
        crashDate,
        zone,
        caseTypes,
        createdBy: req.userId,
      });
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating case crash:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Create a new case crash from an external system (e.g. Power Automate), via API key
router.post("/bot", checkApiKey, async (req, res) => {
  const db = getDB();
  const { crashDate, zone, caseTypes, reporterEmail, reporterDisplayName } =
    req.body;

  const validationError = validateCaseCrashPayload({
    crashDate,
    zone,
    caseTypes,
  });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    let createdBy = null;

    if (reporterEmail) {
      let reporter = await db.models.Users.findOne({
        where: { email: reporterEmail },
      });

      if (!reporter) {
        reporter = await db.models.Users.create({
          username: uuidv4(),
          fullname: reporterDisplayName || reporterEmail,
          email: reporterEmail,
          autorised: false,
        });
      }

      createdBy = reporter.id;
    }

    if (!createdBy) {
      const bot = await db.models.Users.findOne({ where: { isBot: true } });
      if (!bot) {
        return res.status(404).json({ error: "No bot user found" });
      }
      createdBy = bot.id;
    }

    const result = await createCaseCrash(db, {
      crashDate,
      zone,
      caseTypes,
      createdBy,
    });
    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating case crash via bot:", error);
    res.status(500).json({ error: error.message });
  }
});

// Upload d'une photo pour une chute déjà créée, depuis Power Automate.
// Le flow fait une requête PAR photo (payload { photo: "<base64>" }),
// après avoir créé le crash via POST /bot ci-dessus.
router.post("/bot/:id/photo", checkApiKey, async (req, res) => {
  const db = getDB();
  const { id } = req.params;
  const { photo } = req.body;

  if (!photo || typeof photo !== "string") {
    return res.status(400).json({ error: "photo (base64 string) is required" });
  }

  try {
    const crash = await db.models.CaseCrash.findByPk(id);
    if (!crash) {
      return res.status(404).json({ error: "Case crash not found" });
    }

    const filename = savePhotoToDisk(id, photo);
    await db.models.CaseCrashPhoto.create({
      caseCrashId: id,
      filename,
    });

    const publicBaseUrl = await db.models.Settings.getValue(
      "cloudflareTunnelPublicUrl"
    );
    const publicUrl = publicBaseUrl
      ? `${publicBaseUrl}/case-crashes/public/photos/${filename}`
      : null;

    res.status(201).json({ filename, publicUrl });
  } catch (error) {
    console.error("Error uploading case crash photo:", error);
    res.status(500).json({ error: error.message });
  }
});

// Lecture PUBLIQUE d'une photo, sans aucune authentification (ni session,
// ni x-api-key) — n'existe QUE sur la machine bot, qui détient les fichiers.
// Le seul contrôle d'accès est l'imprévisibilité du nom de fichier (UUID v4
// généré côté serveur dans savePhotoToDisk, jamais fourni par l'appelant) :
// quiconque connaît le lien exact accède à la photo. Risque accepté
// explicitement (2026-10-09) pour permettre de réutiliser le lien dans
// d'autres systèmes (ex: inséré par le flow Power Automate dans un rapport,
// un message) — le public concerné (collaborateurs et partenaires de
// l'entreprise) rend ce compromis acceptable pour ce cas d'usage précis.
// Ne PAS réutiliser ce pattern pour des données plus sensibles.
router.get("/public/photos/:filename", async (req, res) => {
  const { filename } = req.params;

  if (!isSafeFilename(filename)) {
    return res.status(400).json({ error: "Invalid filename" });
  }

  // Le filename seul ne suffit pas à retrouver le dossier (storage/case-crashes/<id>/<filename>)
  // — on cherche parmi les sous-dossiers plutôt que d'exiger l'id dans l'URL,
  // pour garder le lien aussi court/simple que possible.
  if (!fs.existsSync(CASE_CRASHES_PHOTOS_DIR)) {
    return res.status(404).json({ error: "Photo not found" });
  }

  const crashDirs = fs.readdirSync(CASE_CRASHES_PHOTOS_DIR);
  for (const crashDir of crashDirs) {
    const candidatePath = path.join(
      CASE_CRASHES_PHOTOS_DIR,
      crashDir,
      filename
    );
    if (fs.existsSync(candidatePath)) {
      return res.sendFile(candidatePath);
    }
  }

  return res.status(404).json({ error: "Photo not found" });
});

// Garde combinée pour la lecture d'une photo : deux appelants légitimes
// très différents utilisent la même route.
// - Un utilisateur humain, via le frontend de SA machine (session normale,
//   requirePermission).
// - Le serveur d'une AUTRE machine qui relaie la requête vers le bot (proxy
//   serveur-à-serveur, voir plus bas) — pas de session utilisateur, juste
//   x-api-key. Bug corrigé le 2026-10-07 : la route n'acceptait QUE
//   requirePermission, donc le proxy recevait "Username is required" au
//   lieu de la photo — observé en prod via un 502 côté machine appelante.
// Si x-api-key est présent et correct, on fait confiance directement (c'est
// le proxy) sans jamais appeler requirePermission. Sinon on retombe sur
// l'authentification normale par permission utilisateur.
async function photoReadGuard(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey) {
    const db = getDB();
    const botApiKey = await db.models.Settings.getValue("botApiKey");
    if (botApiKey && apiKey === botApiKey) {
      return next();
    }
    return res.status(401).json({ error: "Invalid API key" });
  }
  return requirePermission("canAccessCaseCrashes")(req, res, next);
}

// Lecture d'une photo de chute. Deux cas :
// - cette machine EST le bot (le fichier est sur son propre disque) : on le
//   lit directement ;
// - toute autre machine : on relaie la requête vers le bot (son URL publique
//   Cloudflare, en Settings) avec le botApiKey lu côté serveur — jamais
//   exposé au frontend. Voir plan de sécurisation 2026-10-07 (proxy
//   serveur-à-serveur, pas de secret côté client).
router.get("/:id/photos/:filename", photoReadGuard, async (req, res) => {
  const db = getDB();
  const { id, filename } = req.params;

  if (!isSafeFilename(filename)) {
    return res.status(400).json({ error: "Invalid filename" });
  }

  const localFilePath = path.join(
    CASE_CRASHES_PHOTOS_DIR,
    String(id),
    filename
  );

  if (fs.existsSync(localFilePath)) {
    return res.sendFile(localFilePath);
  }

  try {
    const publicUrl = await db.models.Settings.getValue(
      "cloudflareTunnelPublicUrl"
    );
    const botApiKey = await db.models.Settings.getValue("botApiKey");

    if (!publicUrl || !botApiKey) {
      return res.status(404).json({ error: "Photo not found on this machine" });
    }

    const upstreamResponse = await axios.get(
      `${publicUrl}/case-crashes/${id}/photos/${filename}`,
      {
        headers: { "x-api-key": botApiKey },
        responseType: "arraybuffer",
        validateStatus: () => true,
        httpsAgent: insecureAgentForCorporateProxy,
      }
    );

    if (upstreamResponse.status !== 200) {
      return res.status(upstreamResponse.status).json({
        error: "Photo not found on the bot machine",
      });
    }

    res.set(
      "Content-Type",
      upstreamResponse.headers["content-type"] || "image/jpeg"
    );
    res.send(Buffer.from(upstreamResponse.data));
  } catch (error) {
    console.error("Error proxying case crash photo:", error);
    res.status(502).json({ error: "Error fetching photo from bot machine" });
  }
});

// Update a case crash (only by its creator, or an admin)
router.patch(
  "/:id",
  requirePermission("canAccessCaseCrashes"),
  async (req, res) => {
    const db = getDB();
    const { id } = req.params;
    const { crashDate, zone, caseTypes } = req.body;

    if (zone && !ZONES.includes(zone)) {
      return res.status(400).json({ error: "A valid zone is required" });
    }

    if (caseTypes !== undefined) {
      if (!Array.isArray(caseTypes) || caseTypes.length === 0) {
        return res
          .status(400)
          .json({ error: "At least one case type is required" });
      }
      const invalidTypes = caseTypes.filter((t) => !CASE_TYPES.includes(t));
      if (invalidTypes.length > 0) {
        return res
          .status(400)
          .json({ error: `Invalid case types: ${invalidTypes.join(", ")}` });
      }
    }

    try {
      const crash = await db.models.CaseCrash.findByPk(id);

      if (!crash) {
        return res.status(404).json({ error: "Case crash not found" });
      }

      if (crash.createdBy !== req.userId && !req.user.isAdmin) {
        return res.status(403).json({
          error: "Only the creator or an admin can modify this entry",
        });
      }

      const t = await db.transaction();
      try {
        await crash.update(
          {
            ...(crashDate && { crashDate }),
            ...(zone && { zone }),
          },
          { transaction: t }
        );

        if (caseTypes !== undefined) {
          await db.models.CaseCrashType.destroy({
            where: { caseCrashId: crash.id },
            transaction: t,
          });
          await db.models.CaseCrashType.bulkCreate(
            [...new Set(caseTypes)].map((caseType) => ({
              caseCrashId: crash.id,
              caseType,
            })),
            { transaction: t }
          );
        }

        await t.commit();
      } catch (error) {
        await t.rollback();
        throw error;
      }

      const updated = await db.models.CaseCrash.findByPk(id, {
        include: [
          {
            model: db.models.CaseCrashType,
            as: "caseTypes",
            attributes: ["caseType"],
          },
        ],
      });

      const data = updated.toJSON();
      res.json({
        ...data,
        caseTypes: data.caseTypes.map((ct) => ct.caseType),
      });
    } catch (error) {
      console.error("Error updating case crash:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Delete a case crash (only by its creator, or an admin)
router.delete(
  "/:id",
  requirePermission("canAccessCaseCrashes"),
  async (req, res) => {
    const db = getDB();
    const { id } = req.params;

    try {
      const crash = await db.models.CaseCrash.findByPk(id);

      if (!crash) {
        return res.status(404).json({ error: "Case crash not found" });
      }

      if (crash.createdBy !== req.userId && !req.user.isAdmin) {
        return res.status(403).json({
          error: "Only the creator or an admin can delete this entry",
        });
      }

      await crash.destroy();

      // Les lignes CaseCrashPhoto sont déjà supprimées par la contrainte
      // onDelete: CASCADE (voir migration 025). Reste à nettoyer les
      // fichiers physiques — Sequelize ne touche jamais au disque. Sur une
      // machine qui n'est pas le bot, ce dossier n'existe simplement pas
      // (rm avec force: true ne lève pas d'erreur dans ce cas).
      const crashPhotosDir = path.join(CASE_CRASHES_PHOTOS_DIR, String(id));
      fs.rmSync(crashPhotosDir, { recursive: true, force: true });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting case crash:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
export const __internal = {
  isSafeFilename,
  savePhotoToDisk,
  CASE_CRASHES_PHOTOS_DIR,
};
