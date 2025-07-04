import { Sequelize, DataTypes } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

let db;

function initDB(config) {
  return new Promise((resolve, reject) => {
    db = new Sequelize({
      dialect: "mariadb",
      host: config.db_host,
      port: config.db_port,
      username: config.db_user,
      password: config.db_password,
      database: config.db_name,
      logging: false,
      pool: {
        max: 10, // Maximum number of connection in pool (default: 5)
        min: 0, // Minimum number of connection in pool
        acquire: 60000, // The maximum time, in milliseconds, that pool will try to get connection before throwing error (default: 60000)
        idle: 10000, // The maximum time, in milliseconds, that a connection can be idle before being released (default: 10000)
      },
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
        assignedUser: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: "User that has acknowledged the alarm",
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
          comment: "Unique identifier for the alarm",
        },
        dataSource: {
          type: DataTypes.STRING,
          comment: "Data source of the alarm, e.g. 'F001', 'F002', etc.",
        },
        alarmArea: {
          type: DataTypes.STRING,
          comment: "Area of the alarm",
        },
        alarmCode: {
          type: DataTypes.STRING,
          comment: "Code of the alarm",
        },
        alarmText: {
          type: DataTypes.STRING,
          comment: "Text of the alarm, can be translated",
        },
        type: {
          type: DataTypes.ENUM("primary", "secondary"),
          defaultValue: null,
          allowNull: true,
          comment:
            "Type of alarm, can be 'primary' or 'secondary'. Is null at creation",
        },
      },
      {
        timestamps: false,
      }
    );

    const Zones = db.define(
      "Zones",
      {
        zone: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
          comment: "Zone identifier, e.g. 'F001', 'F002', etc.",
        },
        zoneDescription: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: "Description of the zone, e.g. 'Zone 1', 'Zone 2', etc.",
        },
        zoneTransportType: {
          type: DataTypes.ENUM("tray", "box", "pallet"),
          allowNull: false,
          defaultValue: "tray",
          comment:
            "Type of transport for the zone, e.g. 'tray', 'box', 'pallet'",
        },
      },
      {
        timestamps: false,
        indexes: [
          {
            unique: true,
            fields: ["zone"],
          },
        ],
      }
    );

    const ZoneGroups = db.define(
      "ZoneGroups",
      {
        zoneGroupName: {
          type: DataTypes.STRING,
          primaryKey: true,
          comment: "Name of the zone group",
        },
        zones: {
          type: DataTypes.JSON,
          allowNull: false,
          // get() {
          //   return JSON.parse(this.getDataValue("zones"));
          // },
          set(value) {
            this.setDataValue("zones", JSON.stringify(value));
          },
          comment: "Array of zones in the group, e.g. ['F001', 'F002', ...]",
        },
        messageType: {
          type: DataTypes.STRING(10),
          allowNull: false,
          defaultValue: "LREP",
          comment: "Type of message for the group, e.g. 'LREP', '26', etc.",
        },
      },
      {
        timestamps: false,
      }
    );

    const ZoneReadPoints = db.define(
      "ZoneReadPoints",
      {
        zone: {
          type: DataTypes.STRING,
          allowNull: false,
          primaryKey: true,
          references: {
            model: Zones,
            key: "zone",
          },
          comment: "Zone identifier, e.g. 'F001', 'F002', etc.",
        },
        readPoints: {
          type: DataTypes.JSON,
          allowNull: false,
          // get() {
          //   return JSON.parse(this.getDataValue("readPoints"));
          // },
          set(value) {
            this.setDataValue("readPoints", JSON.stringify(value));
          },
          comment:
            "Array of read points for the zone, e.g. ['RP1', 'RP2', ...]",
        },
      },
      {
        timestamps: false,
        indexes: [
          {
            unique: true,
            fields: ["zone"],
          },
        ],
      }
    );

    const ZoneGroupData = db.define(
      "ZoneGroupData",
      {
        zoneGroupName: {
          type: DataTypes.STRING,
          references: {
            model: ZoneGroups,
            key: "zoneGroupName",
          },
          allowNull: false,
          primaryKey: true,
        },
        date: {
          type: DataTypes.DATEONLY,
          allowNull: false,
          primaryKey: true,
        },
        total: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          comment: "Total number of trays for the group on the date",
        },
      },
      {
        timestamps: false,
        indexes: [
          {
            unique: true,
            fields: ["zoneGroupName", "date"],
          },
        ],
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
          comment: "If true, the user is authorized to access the system",
        },
        isBot: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          comment: "If true, the user is a bot and not a real user",
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
            "tgwReportZones",
            "productionData",
            "alarmList",
            "suspiciousPlaces",
            "admin",
            "admin-db",
            "admin-users"
          ),
        },
      },
      {
        timestamps: false,
      }
    );

    const ProductionData = db.define("ProductionData", {
      date: {
        type: DataTypes.DATEONLY,
        primaryKey: true,
        allowNull: false,
      },
      start: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      end: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      dayOff: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      boxTreated: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
    });

    const ignoredAlarms = db.define("ignoredAlarms", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      alarmDbId: {
        type: DataTypes.INTEGER,
        references: {
          model: Datalog,
          key: "dbId",
        },
        allowNull: false,
      },
      reason: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      ignoredBy: {
        type: DataTypes.INTEGER.UNSIGNED,
        references: {
          model: Users,
          key: "id",
        },
        allowNull: false,
      },
    });

    // const alarmZoneTGWReport = db.define(
    //   "alarmZoneTGWReport",
    //   {
    //     alarmId: {
    //       type: DataTypes.STRING,
    //       references: {
    //         model: Alarms,
    //         key: "alarmId",
    //       },
    //       allowNull: false,
    //       primaryKey: true,
    //     },
    //     zones: {
    //       type: DataTypes.JSON,
    //       allowNull: false,
    //       get() {
    //         return JSON.parse(this.getDataValue("zones"));
    //       },
    //     },
    //   },
    //   {
    //     timestamps: false,
    //     indexes: [
    //       {
    //         unique: true,
    //         fields: ["alarmId", "zone"],
    //       },
    //     ],
    //   }
    // );

    const DayResume = db.define(
      "DayResume",
      {
        // id: {
        //   type: DataTypes.INTEGER.UNSIGNED,
        //   primaryKey: true,
        //   autoIncrement: true,
        // },
        dataSource: {
          type: DataTypes.STRING,
          allowNull: false,
          primaryKey: true,
        },
        from: {
          type: DataTypes.DATE,
          allowNull: false,
          primaryKey: true,
        },
        to: {
          type: DataTypes.DATE,
          allowNull: false,
          primaryKey: true,
        },
        data: {
          type: DataTypes.JSON,
          allowNull: false,
          get() {
            return JSON.parse(this.getDataValue("data"));
          },
          set(value) {
            this.setDataValue("data", JSON.stringify(value));
          },
        },
        TTL: {
          type: DataTypes.DATEONLY,
          allowNull: false,
        },
      },
      {
        timestamps: false,
        // indexes: [
        //   {
        //     unique: true,
        //     fields: ["dataSource", "from", "to"],
        //   },
        // ],
      }
    );

    const CronJobs = db.define(
      "CronJobs",
      {
        jobName: {
          type: DataTypes.STRING,
          primaryKey: true,
          comment: "Name of the cron job",
        },
        action: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "Action to be performed by the cron job",
        },
        cronExpression: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "Cron expression for the job, e.g. '0 0 * * *' for daily",
        },
        lastRun: {
          type: DataTypes.DATE,
          allowNull: true,
          comment: "Last time the job was run",
        },
        actualState: {
          type: DataTypes.ENUM("running", "idle", "error"),
          allowNull: false,
          defaultValue: "idle",
          comment:
            "Current state of the job, can be 'running', 'idle', or 'error'",
        },
        lastLog: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: "Last log message of the job",
        },
        enabled: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment:
            "If true, the job is enabled and will run according to its schedule",
        },
      },
      {
        timestamps: false,
      }
    );

    Users.hasMany(UserAccess, {
      foreignKey: "userId",
    });

    // Alarms.hasOne(alarmZoneTGWReport, {
    //   as: "TGWzone",
    //   foreignKey: "alarmId",
    // });

    console.log("Database initialized");
    resolve(db);
  });
}

export { initDB, db };
