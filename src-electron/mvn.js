import fs from "fs";
import path from "path";
import Sequelize from "sequelize";

const MVN_CONFIG_PATH = path.join(
  process.cwd(),
  "storage",
  "mlrtools-config.json"
);

// Ouvre une connexion Sequelize/Oracle vers la base MVN à la demande.
// L'appelant est responsable de fermer la connexion (close()) une fois la
// requête terminée, comme dans cron/ExtractWMS.js.
async function openMvnConnection() {
  const config = JSON.parse(fs.readFileSync(MVN_CONFIG_PATH, "utf-8"));
  const MVNDB = new Sequelize(
    config.mvnDatabase,
    config.mvnUsername,
    config.mvnPassword,
    {
      host: config.mvnHost,
      dialect: "oracle",
      dialectOptions: {
        connectString: config.mvnConnectString,
        connectTimeout: 60000,
      },
      pool: {
        max: 5,
        min: 0,
        acquire: 60000,
        idle: 10000,
      },
      logging: false,
      retry: {
        max: 3,
      },
    }
  );
  await MVNDB.authenticate();
  return MVNDB;
}

// Exécute un SELECT brut sur MVN et retourne les lignes. Seule l'instance
// connectée au réseau MVN (le PC BOT) peut appeler ceci avec succès — voir
// JobQueue / action "executeMvnQuery" dans Cron.routes.js.
export async function executeMvnSelect(sql) {
  if (typeof sql !== "string" || !/^\s*select/i.test(sql)) {
    throw new Error(
      "executeMvnSelect: seules les requêtes SELECT sont autorisées."
    );
  }

  const MVNDB = await openMvnConnection();
  try {
    return await MVNDB.query(sql, { type: Sequelize.QueryTypes.SELECT });
  } finally {
    try {
      await MVNDB.close();
    } catch (closeError) {
      console.error("Error closing MVN connection:", closeError);
    }
  }
}
