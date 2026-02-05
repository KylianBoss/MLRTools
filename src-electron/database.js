import { Sequelize, DataTypes } from "sequelize";
import dotenv from "dotenv";
import dayjs from "dayjs";

dotenv.config();

let db;

// Créer un proxy pour toujours avoir accès à la dernière valeur de db
const dbProxy = new Proxy(
  {},
  {
    get(target, prop) {
      if (!db) {
        throw new Error("Database not initialized. Call initDB() first.");
      }
      // Retourner la propriété directement depuis db, pas depuis target
      return Reflect.get(db, prop);
    },
    set(target, prop, value) {
      if (!db) {
        throw new Error("Database not initialized. Call initDB() first.");
      }
      return Reflect.set(db, prop, value);
    },
  }
);

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

    const Audit = db.define(
      "Audit",
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          comment: "Unique identifier for the audit log entry",
        },
        user: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "Username of the user who performed the action",
        },
        type: {
          type: DataTypes.STRING,
          allowNull: false,
          comment:
            "Type of action performed, e.g. 'create', 'update', 'delete'",
        },
        table: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "Name of the table where the action was performed",
        },
        old: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        new_: {
          type: DataTypes.JSON,
          allowNull: false,
        },
        data_id: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: "ID of the data record that was affected",
        },
        timestamp: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          comment: "Timestamp when the action was performed",
        },
      },
      {
        timestamps: false,
      }
    );

    const RequestLogs = db.define(
      "RequestLogs",
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        method: {
          type: DataTypes.STRING,
        },
        path: {
          type: DataTypes.STRING,
        },
        timestamp: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          comment: "Timestamp when the request was made",
        },
      },
      {
        timestamps: false,
        indexes: [
          {
            fields: ["timestamp"],
          },
        ],
      }
    );

    const Element = db.define(
      "Element",
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          comment: "Unique identifier for the element",
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "Name of the element, e.g. 'Element 1', 'Element 2', etc.",
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

    const Location = db.define(
      "Location",
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          comment: "Unique identifier for the location",
        },
        dataSource: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "Data source of the location, e.g. 'F001', 'F002', etc.",
        },
        module: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          comment: "Module of the location, e.g. '1131', '1132', etc.",
        },
        complement: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          defaultValue: 0,
          comment: "Complement of the location, e.g. '01', '02', etc.",
        },
        element: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: Element,
            key: "id",
          },
          comment: "ID of the element associated with the location",
        },
      },
      {
        timestamps: false,
        indexes: [
          {
            unique: true,
            fields: ["dataSource", "module", "complement"],
          },
        ],
      }
    );

    const Datalog = db.define(
      "Datalog",
      {
        dbId: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          allowNull: false,
        },
        timeOfOccurence: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        timeOfAcknowledge: {
          type: DataTypes.DATE,
        },
        duration: {
          type: DataTypes.INTEGER,
        },
        dataSource: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        alarmArea: {
          type: DataTypes.STRING,
        },
        alarmCode: {
          type: DataTypes.STRING,
        },
        alarmText: {
          type: DataTypes.STRING,
          allowNull: false,
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
          allowNull: false,
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
          type: DataTypes.ENUM("primary", "secondary", "human", "other"),
          defaultValue: null,
          allowNull: true,
          comment:
            "Type of alarm, can be 'primary', 'secondary', 'human' or 'other'. Default is 'other'",
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
        order: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          comment: "Order of the group in the list, used for sorting",
        },
        display: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: "If true, the group will be displayed in the charts page",
        },
      },
      {
        timestamps: false,
      }
    );

    const ScheduleProduction = db.define(
      "ScheduleProduction",
      {
        day: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          allowNull: false,
          comment: "Day of the week",
        },
        startTime: {
          type: DataTypes.TIME,
          allowNull: false,
          comment: "Scheduled start time for production on this day",
        },
        endTime: {
          type: DataTypes.TIME,
          allowNull: false,
          comment: "Scheduled end time for production on this day",
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
        messageType: {
          type: DataTypes.STRING(10),
          allowNull: false,
          defaultValue: "LREP",
          comment: "Type of message for the group, e.g. 'LREP', '26', etc.",
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

    const ZoneData = db.define(
      "ZoneData",
      {
        zoneName: {
          type: DataTypes.STRING,
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
            fields: ["zoneName", "date"],
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
        needsRestart: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          comment:
            "If true, the bot needs to be restarted. Set to true by the system, and set to false by the bot when it restarts",
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
          type: DataTypes.STRING(255),
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
        startAt: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
          comment: "Time when the job last started",
        },
        endAt: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
          comment: "Time when the job last ended",
        },
        args: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null,
          comment:
            "Optional arguments for the job, can be a JSON string or comma-separated values",
        },
        enabled: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment:
            "If true, the job is enabled and will run according to its schedule",
        },
        options: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: null,
          comment:
            "Job-specific options stored as JSON, e.g. {sendEmail: true} for SendKPI",
        },
      },
      {
        timestamps: false,
      }
    );

    const JobQueue = db.define(
      "JobQueue",
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          comment: "Unique identifier for the job queue entry",
        },
        jobName: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "Name of the job to execute",
        },
        action: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "Action to be performed",
        },
        args: {
          type: DataTypes.JSON,
          allowNull: true,
          comment: "Arguments to pass to the job",
        },
        requestedBy: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: "Users",
            key: "id",
          },
          comment: "User ID who requested the job",
        },
        status: {
          type: DataTypes.ENUM("pending", "running", "completed", "failed"),
          allowNull: false,
          defaultValue: "pending",
          comment: "Current status of the job",
        },
        error: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: "Error message if job failed",
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          comment: "Timestamp when the job was requested",
        },
        scheduledFor: {
          type: DataTypes.DATE,
          allowNull: true,
          comment:
            "Timestamp when the job should be executed (NULL for immediate execution)",
        },
        startedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          comment: "Timestamp when the job started executing",
        },
        completedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          comment: "Timestamp when the job completed",
        },
      },
      {
        timestamps: false,
        indexes: [
          {
            fields: ["status", "createdAt"],
          },
        ],
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
          type: DataTypes.ENUM("A", "B", "C", "D"),
          allowNull: false,
          comment:
            "Type of maintenance, can be 'A', 'B', 'C'. A = Every 3 months, B = Every 6 months, C = Every 9 months, D = Every year",
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
        linkedTo: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null,
          comment:
            "If the maintenance plan is linked to a specific device or system, this field contains the identifier",
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
                  maintenance.nextMaintenance = now.add(3, "month").toDate();
                  break;
                case "B":
                  maintenance.nextMaintenance = now.add(6, "month").toDate();
                  break;
                case "C":
                  maintenance.nextMaintenance = now.add(9, "month").toDate();
                  break;
                default:
                  maintenance.nextMaintenance = now.add(1, "year").toDate();
                  break;
              }
              maintenance.save();
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
        locationId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: Location,
            key: "id",
          },
          defaultValue: null,
          comment: "ID of the location where the maintenance is scheduled",
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

    const Stingrays = db.define(
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

    const cache_ErrorsByThousand = db.define(
      "cache_ErrorsByThousand",
      {
        groupName: {
          type: DataTypes.STRING,
          allowNull: false,
          primaryKey: true,
          comment: "Name of the zone group, e.g. 'Group 1', 'Group 2', etc.",
        },
        transportType: {
          type: DataTypes.ENUM("tray", "box", "pallet"),
          allowNull: false,
          defaultValue: "tray",
          comment:
            "Type of transport for the group, e.g. 'tray', 'box', 'pallet'",
        },
        result: {
          type: DataTypes.FLOAT,
          allowNull: false,
          defaultValue: 0,
          comment: "Number of errors per thousand",
        },
        trayAmount: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          comment: "Number of trays processed",
        },
        date: {
          type: DataTypes.DATEONLY,
          allowNull: false,
          primaryKey: true,
        },
        calculatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          comment: "Time when the result was calculated",
        },
      },
      {
        timestamps: false,
      }
    );

    const cache_DowntimeMinutesByThousand = db.define(
      "cache_DowntimeMinutesByThousand",
      {
        groupName: {
          type: DataTypes.STRING,
          allowNull: false,
          primaryKey: true,
          comment: "Name of the zone group, e.g. 'Group 1', 'Group 2', etc.",
        },
        transportType: {
          type: DataTypes.ENUM("tray", "box", "pallet"),
          allowNull: false,
          defaultValue: "tray",
          comment:
            "Type of transport for the group, e.g. 'tray', 'box', 'pallet'",
        },
        result: {
          type: DataTypes.FLOAT,
          allowNull: false,
          defaultValue: 0,
          comment: "Number of errors per thousand",
        },
        trayAmount: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          comment: "Number of trays processed",
        },
        date: {
          type: DataTypes.DATEONLY,
          allowNull: false,
          primaryKey: true,
        },
        calculatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          comment: "Time when the result was calculated",
        },
      },
      {
        timestamps: false,
      }
    );

    const cache_CustomCharts = db.define(
      "cache_CustomCharts",
      {
        chartId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
          references: {
            model: "CustomCharts",
            key: "id",
          },
          comment: "ID of the custom chart",
        },
        date: {
          type: DataTypes.DATEONLY,
          allowNull: false,
          primaryKey: true,
        },
        data: {
          type: DataTypes.FLOAT,
          allowNull: false,
          defaultValue: 0,
          comment: "Cached data value for the chart on the date",
        },
        calculatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          comment: "Time when the data was calculated",
        },
      },
      {
        timestamps: false,
      }
    );

    const AlarmDataLast7DaysSaved = db.define(
      "AlarmDataLast7DaysSaved",
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        alarmIds: {
          type: DataTypes.JSON,
          allowNull: false,
          // get() {
          //   return JSON.parse(this.getDataValue("alarmIds"));
          // },
          set(value) {
            this.setDataValue("alarmIds", JSON.stringify(value));
          },
          comment: "Array of alarm IDs, e.g. ['A001', 'A002', ...]",
        },
        totalOccurrences: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          comment: "Total number of occurrences of the alarms",
        },
        dailyBreakdown: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment:
            'JSON string representing the daily breakdown of occurrences, e.g. \'{"2023-10-01": 5, "2023-10-02": 3, ...}\'',
        },
        from: {
          type: DataTypes.DATE,
          allowNull: false,
          comment: "Start date of the 7-day period",
        },
        to: {
          type: DataTypes.DATE,
          allowNull: false,
          comment: "End date of the 7-day period",
        },
        calculatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          comment: "Time when the data was calculated",
        },
      },
      {
        timestamps: false,
      }
    );

    const CustomChart = db.define(
      "CustomChart",
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        chartName: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "Name of the custom chart",
        },
        alarms: {
          type: DataTypes.JSON,
          allowNull: false,
          // get() {
          //   return JSON.parse(this.getDataValue("alarms"));
          // },
          set(value) {
            this.setDataValue("alarms", JSON.stringify(value));
          },
          comment: "Array of alarm IDs included in the chart",
        },
        createdBy: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: Users,
            key: "id",
          },
          comment: "ID of the user who created the chart",
        },
      },
      {
        timestamps: false,
      }
    );

    const Target = db.define(
      "Target",
      {
        chartId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          comment: "ID of the custom chart",
          primaryKey: true,
        },
        groupName: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 0,
          comment: "Name of the zone group, e.g. 'Group 1', 'Group 2', etc.",
          primaryKey: true,
        },
        value: {
          type: DataTypes.FLOAT,
          allowNull: false,
          defaultValue: 0,
          comment: "Target value, e.g. 99.5",
        },
        setAt: {
          type: DataTypes.DATEONLY,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          comment: "Date when the target was set",
          primaryKey: true,
        },
        setBy: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: Users,
            key: "id",
          },
          comment: "ID of the user who set the target",
        },
      },
      {
        timestamps: false,
      }
    );

    const Settings = db.define(
      "Settings",
      {
        key: {
          type: DataTypes.STRING,
          primaryKey: true,
          comment: "Key of the setting, e.g. 'siteName', 'timezone', etc.",
        },
        value: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "Value of the setting",
        },
        description: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: "Description of the setting",
        },
        updatedBy: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: Users,
            key: "id",
          },
          comment: "ID of the user who last updated the setting",
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          comment: "Last time the setting was updated",
        },
      },
      {
        timestamps: false,
      }
    );
    // Create a simple function to retrieve a value by key
    Settings.getValue = async (key) => {
      const setting = await Settings.findByPk(key);
      return setting ? setting.value : null;
    };

    // Notifications
    const Notifications = db.define(
      "Notifications",
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        type: {
          type: DataTypes.ENUM("info", "warning", "error", "success"),
          allowNull: false,
          defaultValue: "info",
          comment:
            "Type of notification, e.g. 'info', 'warning', 'error', 'success'",
        },
        message: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "Notification message",
        },
        read: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: "If true, the notification has been read",
        },
        userId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: Users,
            key: "id",
          },
          comment: "ID of the user to whom the notification is addressed",
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          comment: "Time when the notification was created",
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

function getDB() {
  if (!db) {
    throw new Error("Database not initialized. Call initDB() first.");
  }
  return db;
}

export { initDB, dbProxy as db, getDB };
