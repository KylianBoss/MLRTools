const fs = require("fs");
const path = require("path");
const mariadb = require("mariadb");

// Lire la configuration depuis mlrtools-config.json
const configPath = path.join(process.cwd(), "storage", "mlrtools-config.json");
let config = {};

try {
  if (fs.existsSync(configPath)) {
    const configFile = fs.readFileSync(configPath, "utf8");
    config = JSON.parse(configFile);
  } else {
    throw new Error("mlrtools-config.json not found");
  }
} catch (error) {
  console.error("Error loading mlrtools-config.json:", error.message);
  process.exit(1);
}

module.exports = {
  development: {
    username: config.db_user,
    password: config.db_password,
    database: config.db_name,
    host: config.db_host || "localhost",
    port: parseInt(config.db_port) || 3306,
    dialect: "mysql",
    dialectOptions: {
      timezone: "Etc/GMT-1",
    },
    logging: false,
  },
  production: {
    username: config.db_user,
    password: config.db_password,
    database: config.db_name,
    host: config.db_host || "localhost",
    port: parseInt(config.db_port) || 3306,
    dialect: "mariadb",
    dialectOptions: {
      timezone: "Etc/GMT-1",
    },
    logging: false,
  },
};
