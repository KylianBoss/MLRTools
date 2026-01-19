import { Router } from "express";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { db } from "../database.js";

const router = Router();

// Générer le QR code pour la configuration initiale
router.get("/2fa/setup", async (req, res) => {
  try {
    // Utiliser le secret partagé depuis les Settings de la base de données
    let secret = await db.models.Settings.getValue("APP_2FA_SECRET");

    // Si le secret n'existe pas encore, en générer un et le sauvegarder
    if (!secret) {
      const generated = speakeasy.generateSecret({
        name: "MLR Actions Sensibles",
        issuer: "MLR SA",
      });
      secret = generated.base32;
      console.log(
        "⚠️  IMPORTANT: Nouvelle clé 2FA générée et sauvegardée dans la base de données:"
      );
      console.log(`APP_2FA_SECRET=${secret}`);
    }

    // Générer l'URL OTPAUTH
    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret,
      label: "MLR Actions Sensibles",
      issuer: "MLR SA",
      encoding: "base32",
    });

    // Générer le QR code
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    res.json({
      qrCode: qrCodeDataUrl,
      secret: secret,
      manualEntry: secret, // Pour entrée manuelle si le scan ne fonctionne pas
    });
  } catch (error) {
    console.error("Error generating 2FA setup:", error);
    res.status(500).json({ error: error.message });
  }
});

// Middleware pour vérifier le code 2FA
export const require2FA = async (req, res, next) => {
  const totpCode = req.body.totpCode || req.headers["x-totp-code"];

  // Si pas de code fourni, demander l'authentification
  if (!totpCode) {
    return res.status(403).json({
      requires2FA: true,
      message: "Code 2FA requis pour cette action",
    });
  }

  // Vérifier le code
  const secret = await db.models.Settings.getValue("APP_2FA_SECRET");

  if (!secret) {
    return res.status(500).json({
      error: "2FA non configuré sur le serveur. Contactez l'administrateur.",
    });
  }

  const verified = speakeasy.totp.verify({
    secret: secret,
    encoding: "base32",
    token: totpCode,
    window: 2, // Tolérer 2 périodes (60s) de décalage
  });

  if (!verified) {
    return res.status(401).json({
      error: "Code 2FA invalide",
    });
  }

  // Code valide, continuer
  next();
};

export default router;
