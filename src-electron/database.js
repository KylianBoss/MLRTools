import { Sequelize, DataTypes } from "sequelize";
import path from "path";
import { app } from "electron";
import dotenv from "dotenv";

dotenv.config();

const storagePath = app.isPackaged
  // ? path.join(path.dirname(app.getPath("exe")), "storage")
  ? process.env.DB_PATH
  : path.join(__dirname, "storage");
const db = new Sequelize({
  dialect: "sqlite",
  storage: path.join(storagePath, "database.sqlite"),
  logging: false,
});

const Datalog = db.define(
  "Datalog",
  {
    dbId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    timeOfOccurence: {
      type: DataTypes.DATE,
    },
    timeOfAcknowledge: {
      type: DataTypes.DATE,
    },
    duration: {
      type: DataTypes.INTEGER,
    },
    dataSource: {
      type: DataTypes.STRING,
    },
    alarmArea: {
      type: DataTypes.STRING,
    },
    alarmCode: {
      type: DataTypes.STRING,
    },
    alarmText: {
      type: DataTypes.STRING,
    },
    severity: {
      type: DataTypes.STRING,
    },
    classification: {
      type: DataTypes.STRING,
    },
    alarmId: {
      type: DataTypes.STRING,
    },
  },
  {
    timestamps: false,
  }
);

const Alarms = db.define(
  "Alarms",
  {
    alarmId: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    dataSource: {
      type: DataTypes.STRING,
    },
    alarmArea: {
      type: DataTypes.STRING,
    },
    alarmCode: {
      type: DataTypes.STRING,
    },
    alarmText: {
      type: DataTypes.STRING,
    },
  },
  {
    timestamps: false,
  }
);

const ExcludedAlarms = db.define(
  "ExcludedAlarms",
  {
    alarmId: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
  },
  {
    timestamps: false,
  }
);

const AlarmTranslations = db.define(
  "AlarmTranslations",
  {
    alarmId: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    translation: {
      type: DataTypes.STRING,
    },
  },
  {
    timestamps: false,
  }
);

async function syncDatabase() {
  try {
    await db.sync();
    console.log("Database synchronized");
  } catch (error) {
    console.error("Error synchronizing database:", error);
  }
}

export { db, Datalog, Alarms, ExcludedAlarms, AlarmTranslations, syncDatabase };
