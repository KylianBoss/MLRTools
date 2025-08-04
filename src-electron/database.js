import { Sequelize, DataTypes } from "sequelize";
import dotenv from "dotenv";
import dayjs from "dayjs";

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
          type: DataTypes.STRING(30),
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
        zoneTransportType: {
          type: DataTypes.ENUM("tray", "box", "pallet"),
          allowNull: false,
          defaultValue: "tray",
          comment:
            "Type of transport for the group, e.g. 'tray', 'box', 'pallet'",
        },
        order: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          comment: "Order of the group in the list, used for sorting",
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
        email: {
          type: DataTypes.STRING,
          allowNull: true,
          validate: {
            isEmail: true,
          },
          comment: "Email address of the user",
        },
        recieveDailyReport: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          comment: "If true, the user will receive daily reports",
        },
        autorised: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          comment: "If true, the user is authorized to access the system",
        },
        isTechnician: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          comment: "If true, the user is a technician with special permissions",
        },
        isAdmin: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          comment: "If true, the user is an admin with full permissions",
        },
        isBot: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          comment: "If true, the user is a bot and not a real user",
        },
        isBotActive: {
          type: DataTypes.DATE,
          allowNull: true,
          comment:
            "If isBot is true, this field indicates the last active time of the bot",
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

    // const ignoredAlarms = db.define("ignoredAlarms", {
    //   id: {
    //     type: DataTypes.INTEGER.UNSIGNED,
    //     primaryKey: true,
    //     autoIncrement: true,
    //   },
    //   alarmDbId: {
    //     type: DataTypes.INTEGER,
    //     references: {
    //       model: Datalog,
    //       key: "dbId",
    //     },
    //     allowNull: false,
    //   },
    //   reason: {
    //     type: DataTypes.STRING,
    //     allowNull: false,
    //   },
    //   ignoredBy: {
    //     type: DataTypes.INTEGER.UNSIGNED,
    //     references: {
    //       model: Users,
    //       key: "id",
    //     },
    //     allowNull: false,
    //   },
    // });

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

    // Maintenance
    const MaintenancePlan = db.define(
      "MaintenancePlan",
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        location: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "Location of the maintenance",
        },
        type: {
          type: DataTypes.ENUM("A", "B", "C"),
          allowNull: false,
          comment:
            "Type of maintenance, can be 'A', 'B', 'C'. A = Every 2 months, B = Every 4 months, C = Every 8 months",
        },
        description: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "Description of the maintenance plan",
        },
        lastMaintenance: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
          comment: "Last time the maintenance was performed",
        },
        nextMaintenance: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
          comment: "Next scheduled maintenance time",
        },
      },
      {
        timestamps: false,
        indexes: [
          {
            unique: true,
            fields: ["location", "type"],
          },
        ],
        hooks: {
          // If the lastMaintenance is updated, update the nextMaintenance
          afterUpdate: (maintenance) => {
            if (maintenance.changed("lastMaintenance")) {
              const now = dayjs(maintenance.lastMaintenance);
              switch (maintenance.type) {
                case "A":
                  maintenance.nextMaintenance = now.add(2, "month").toDate();
                  break;
                case "B":
                  maintenance.nextMaintenance = now.add(4, "month").toDate();
                  break;
                case "C":
                  maintenance.nextMaintenance = now.add(8, "month").toDate();
                  break;
              }
            }
          },
        },
      }
    );

    const MaintenanceSchedule = db.define(
      "MaintenanceSchedule",
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        maintenancePlanId: {
          type: DataTypes.INTEGER.UNSIGNED,
          references: {
            model: MaintenancePlan,
            key: "id",
          },
          allowNull: false,
          comment: "ID of the maintenance plan",
        },
        scheduledTime: {
          type: DataTypes.DATE,
          allowNull: false,
          comment: "Scheduled time for the maintenance",
        },
        status: {
          type: DataTypes.ENUM(
            "scheduled",
            "assigned",
            "in_progress",
            "completed",
            "cancelled"
          ),
          allowNull: false,
          defaultValue: "scheduled",
          comment:
            "Status of the maintenance schedule, can be 'scheduled', 'assigned', 'completed', or 'cancelled'",
        },
        assignedTo: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: Users,
            key: "id",
          },
          comment: "User assigned to perform the maintenance",
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
          defaultValue: null,
          comment: "Notes about the maintenance schedule",
        },
        actualMaintenanceLogId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          comment: "ID of the actual maintenance log, if any",
        },
      },
      {
        timestamps: false,
        indexes: [
          {
            unique: true,
            fields: ["maintenancePlanId", "scheduledTime"],
          },
        ],
        hooks: {
          beforeCreate: (schedule) => {
            if (!schedule.scheduledTime) {
              schedule.scheduledTime = dayjs().add(1, "day").toDate();
            }
          },
        },
      }
    );

    const Maintenance = db.define(
      "Maintenance",
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        maintenancePlanId: {
          type: DataTypes.INTEGER.UNSIGNED,
          references: {
            model: MaintenancePlan,
            key: "id",
          },
          allowNull: false,
        },
        performedBy: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: Users,
            key: "id",
          },
          comment: "User who performed the maintenance",
        },
        startTime: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
          comment: "Start time of the maintenance",
        },
        endTime: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
          comment: "End time of the maintenance",
        },
        duration: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          defaultValue: null,
          comment: "Duration of the maintenance in seconds",
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
          defaultValue: null,
          comment: "Notes about the maintenance",
        },
        report: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: null,
          get() {
            return JSON.parse(this.getDataValue("report"));
          },
          set(value) {
            this.setDataValue("report", JSON.stringify(value));
          },
          comment:
            "Report of the maintenance, can contain details about the steps performed",
        },
      },
      {
        timestamps: false,
      }
    );

    const MaintenanceSteps = db.define(
      "MaintenanceSteps",
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        activityType: {
          type: DataTypes.ENUM("preventive", "corrective", "inspection"),
          allowNull: false,
          defaultValue: "preventive",
          comment:
            "Type of activity for the step, can be 'preventive', 'corrective', or 'inspection'",
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: false,
          comment: "Description of the maintenance step",
        },
        defect: {
          type: DataTypes.TEXT,
          allowNull: true,
          defaultValue: null,
          comment:
            "Explaination of things that means that the step has to be marked as defect",
        },
        process: {
          type: DataTypes.TEXT,
          allowNull: true,
          defaultValue: null,
          comment:
            "Explaination of the process when this is an inspection step",
        },
        fixing: {
          type: DataTypes.TEXT,
          allowNull: true,
          defaultValue: null,
          comment:
            "Explaination of things that means that the step has to be marked as fixing",
        },
        answerType: {
          type: DataTypes.ENUM("boolean", "value", "replace"),
          allowNull: false,
          defaultValue: "boolean",
          comment:
            "Type of answer for the step, can be 'boolean', 'value' or 'replace'",
        },
        goodAnswer: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null,
          comment:
            "Good answer for the step, can be 'yes', 'no', or a specific value",
        },
        notesPlaceholder: {
          type: DataTypes.TEXT,
          allowNull: true,
          defaultValue: null,
          comment:
            "Placeholder for notes in the step, can be used to provide additional information",
        },
        doneButton: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: "If true, the step has a done button to mark it as done",
        },
        linkedImage: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: "Images",
            key: "id",
          },
          comment: "ID of the linked image for the step",
        },
      },
      {
        timestamps: false,
      }
    );

    const MaintenancePlanSteps = db.define(
      "MaintenancePlanSteps",
      {
        maintenancePlanId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
          references: {
            model: MaintenancePlan,
            key: "id",
          },
          comment: "ID of the maintenance plan",
        },
        stepId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
          references: {
            model: MaintenanceSteps,
            key: "id",
          },
          comment: "ID of the maintenance step",
        },
        order: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          comment: "Order of the step in the plan",
        },
      },
      {
        timestamps: false,
        indexes: [
          {
            unique: true,
            fields: ["maintenancePlanId", "stepId"],
          },
        ],
      }
    );

    // Maintenance associations
    // MaintenancePlan.hasMany(Maintenance, {
    //   foreignKey: "maintenancePlanId",
    //   as: "maintenances",
    // });
    // Maintenance.belongsTo(MaintenancePlan, {
    //   foreignKey: "maintenancePlanId",
    //   as: "maintenancePlan",
    // });
    // MaintenanceSteps.belongsToMany(Maintenance, {
    //   through: "MaintenanceStepsMaintenance",
    //   foreignKey: "stepId",
    //   otherKey: "maintenanceId",
    //   as: "maintenances",
    // });

    const Images = db.define(
      "Images",
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "Name of the image file",
        },
        data: {
          type: DataTypes.BLOB("long"),
          allowNull: false,
          comment: "Image data in binary format",
        },
      },
      {
        timestamps: false,
        indexes: [
          {
            unique: true,
            fields: ["name"],
          },
        ],
      }
    );

    const stingrays = db.define(
      "Stingrays",
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        state: {
          type: DataTypes.ENUM("active", "broken", "ready", "testing"),
          allowNull: false,
          defaultValue: "ready",
          comment: "State of the stingray, can be 'active' or 'inactive'",
        },
        location: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null,
          comment:
            "Location of the stingray, e.g. 'W001-01', 'W001-02', 'Maintenance', etc.",
        },
        lastLocationChange: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
          comment: "Last time the stingray was moved to a new location",
        },
        lastStateChange: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
          comment: "Last time the state of the stingray was changed",
        },
        lastMaintenance: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
          comment: "Last time the stingray was maintained",
        },
        nextMaintenance: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
          comment: "Next scheduled maintenance time for the stingray",
        },
        lastUpdateBy: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: Users,
            key: "id",
          },
          comment: "User who last updated the stingray",
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
