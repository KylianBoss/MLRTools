import { Sequelize, DataTypes } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

function initDB(config) {
  return new Promise((resolve, reject) => {
    const db = new Sequelize({
      dialect: "mariadb",
      host: config.db_host,
      port: config.db_port,
      username: config.db_user,
      password: config.db_password,
      database: config.db_name,
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

    const Users = db.define(
      "Users",
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        username: {
          type: DataTypes.STRING,
        },
        fullname: {
          type: DataTypes.STRING,
          defaultValue: "Unknown",
        },
        autorised: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
      },
      {
        timestamps: false,
      }
    );

    const UserAccess = db.define(
      "UserAccess",
      {
        userId: {
          type: DataTypes.INTEGER.UNSIGNED,
        },
        menuId: {
          type: DataTypes.ENUM(
            "kpi",
            "searchMessages",
            "charts",
            "importMessages",
            "excludedAlarms",
            "suspiciousPlaces",
            "admin"
          ),
        },
      },
      {
        timestamps: false,
      }
    );

    Users.hasMany(UserAccess, {
      foreignKey: "userId",
    });

    console.log("Database initialized");
    resolve(db);
  });
}

export { initDB };
