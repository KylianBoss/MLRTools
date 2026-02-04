import { defineStore } from "pinia";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration.js";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import "dayjs/locale/fr";
import { api } from "boot/axios";
import { Loading, QSpinnerFacebook } from "quasar";

dayjs.extend(duration);
dayjs.extend(customParseFormat);
dayjs.locale("fr");

const monthNames = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc",
];

export const useDataLogStore = defineStore("datalog", {
  state: () => ({
    dataLog: [],
    importDatalog: [],
    progress: new ProgressTracker(),
    progression: null,
    loading: false,
    importError: [],
    file: null,
    day: null,
    filename: null,
    linesToWrite: [],
    columns: [
      {
        name: "timeOfOccurence",
        label: "Time of Occurence",
        sortable: true,
      },
      {
        name: "timeOfAcknowledge",
        label: "Time of Acknowledge",
        sortable: true,
      },
      {
        name: "duration",
        label: "Duration",
        sortable: true,
      },
      {
        name: "dataSource",
        label: "Data Source",
        sortable: true,
      },
      {
        name: "alarmArea",
        label: "Alarm Area",
        sortable: true,
      },
      {
        name: "alarmCode",
        label: "Alarm Code",
        sortable: true,
      },
      {
        name: "alarmText",
        label: "Alarm Text",
      },
      {
        name: "severity",
        label: "Severity",
        sortable: true,
      },
      {
        name: "classification",
        label: "Classification",
        sortable: true,
      },
      {
        name: "alarmId",
        label: "Alarm ID",
      },
    ],
    kpiColumns: [
      {
        name: "alarmId",
        label: "Alarm ID",
        field: (row) => row.alarmId,
        value: (row) => row.alarmId,
        align: "left",
      },
      {
        name: "alarmText",
        label: "Alarm Text",
        field: (row) => row.alarmText,
        value: (row) => row.alarmText,
        sortable: true,
        align: "left",
      },
      {
        name: "count",
        label: "Count",
        field: (row) => row.count,
        value: (row) => row.count,
        sortable: true,
        align: "left",
      },
      {
        name: "duration",
        label: "Duration",
        field: (row) =>
          dayjs.duration(row.totalDuration, "seconds").format("HH:mm:ss"),
        value: (row) =>
          dayjs.duration(row.totalDuration, "seconds").asSeconds(),
        sortable: true,
        align: "left",
      },
    ],
    alarms: [],
    dates: [],
    lastObjectTreated: null,
    productionData: [],
    importing: false,
  }),
  getters: {
    isMissingProductionData() {
      return (date) => {
        return !this.productionData.some(
          (p) => p.date === dayjs(date).format("YYYY-MM-DD")
        );
      };
    },
    isDayOff() {
      return (date) => {
        const dates = this.productionData.filter(
          (p) => p.date === dayjs(date).format("YYYY-MM-DD")
        );
        if (dates.length === 0) return false;
        if (dates[0].dayOff === 1) return true;
        return false;
      };
    },
  },
  actions: {
    async getData(startRow, count, filter, sortBy, descending, sum) {
      return new Promise((resolve, reject) => {
        api
          .get("/alarms", {
            params: {
              startRow,
              count,
              filter: { ...filter },
              sortBy,
              descending,
              sum,
            },
          })
          .then((data) => {
            resolve(data.data);
          });
      });
    },
    async getNumberOfRows(filter) {
      console.log(filter);
      return new Promise((resolve, reject) => {
        api.get("/alarms/count", { params: filter }).then((data) => {
          resolve(data.data);
        });
      });
    },
    getMessages(from, to, includesExcluded = false) {
      return new Promise((resolve, reject) => {
        api
          .get("/alarms/messages", {
            params: {
              from: dayjs(from).format("YYYY-MM-DD HH:mm:ss"),
              to: dayjs(to).format("YYYY-MM-DD HH:mm:ss"),
              includesExcluded,
            },
          })
          .then((data) => {
            console.log(data);
            resolve(data.data);
          });
      });
    },
    async getKPItop3Count(filter) {
      return api
        .get("/kpi/count", { params: filter })
        .then((response) => response.data);
    },
    getKPItop3CountPerZone(filter) {
      return new Promise((resolve) => {
        api.get("/kpi/count/zone", { params: filter }).then((data) => {
          resolve(data.data);
        });
      });
    },
    getKPItop3Duration(filter) {
      return new Promise((resolve) => {
        api.get("/kpi/duration", { params: filter }).then((data) => {
          resolve(data.data);
        });
      });
    },
    getDayResume(filter) {
      return new Promise((resolve) => {
        api.get("/kpi/resume", { params: filter }).then((response) => {
          resolve(response.data);
        });
      });
    },
    translateAlarm(alarmId, translation) {
      return new Promise((resolve, reject) => {
        api.post("/alarms/translate", { alarmId, translation }).then((data) => {
          console.log(data);
          resolve(data.data);
        });
      });
    },
    initialize() {
      return new Promise(async (resolve, reject) => {
        Loading.show({
          spinner: QSpinnerFacebook,
          spinnerColor: "primary",
          spinnerSize: 160,
          backgroundColor: "dark",
          message: "Chargement...",
          messageColor: "white",
        });
        try {
          console.log("Initializing data log store");
          await api.get("/alarms/day").then((response) => {
            this.dates = response.data;
          });
          await api.get("/alarms/unique").then((response) => {
            this.alarms = response.data;
          });
          await api.get("/production/data").then((response) => {
            this.productionData = response.data;
          });
          Loading.hide();
          resolve();
        } catch (error) {
          console.error("Error initializing data log store:", error);
          reject(error);
        }
      });
    },
    startImport(totalLines) {
      this.loading = true;
      this.importError = [];
      this.importedLines = 0;
      this.progression = this.progress.initialize(totalLines);
      this.importing = true;
    },
    async importDataChunk(lines, fileType) {
      console.log("Importing data chunk from file", fileType);
      let newData = [];
      if (fileType === "txt") newData = this.importTXT(lines);
      else if (fileType === "csv") newData = this.importCSV(lines);
      else {
        this.importError.push("Invalid file type");
        return;
      }

      // for (const data of newData) {
      //   this.lastObjectTreated = data;

      //   await window.electron.serverRequest("POST", "/alarms", data);

      //   this.importedLines++;
      //   if (this.importedLines % 20 === 0)
      //     this.progression = this.progress.update(this.importedLines);
      // }
      // Send by bulk
      this.lastObjectTreated = newData[newData.length - 1];
      await api.post("/alarms", {
        data: newData.filter((l) => l !== null),
      });
      this.importedLines += newData.length;
      this.progression = this.progress.update(this.importedLines);
    },
    importTXT(lines) {
      return lines
        .filter((l) => l.length > 5)
        .map((line) => {
          const rawData = line.split("\t");
          const parseTimeRegex =
            /(\d{1,2}) ([a-z]{3})[a-z]*\. (\d{4}) à (\d{2}:\d{2}:\d{2})/g;
          const start = [...rawData[1].matchAll(parseTimeRegex)];
          const end = [...rawData[2].matchAll(parseTimeRegex)];
          if (
            rawData[1].length < 3 ||
            rawData[2].length < 3 ||
            !start[0] ||
            !end[0] ||
            start[0].length != 5 ||
            end[0].length != 5
          )
            return null;
          const startDate = `${start[0][3]}-${
            monthNames.indexOf(start[0][2]) + 1
          }-${start[0][1]} ${start[0][4]}`;
          const endDate = `${end[0][3]}-${monthNames.indexOf(end[0][2]) + 1}-${
            end[0][1]
          } ${end[0][4]}`;
          if (!dayjs(startDate).isValid() || !dayjs(endDate).isValid())
            return null;
          return {
            dbId: rawData[0],
            timeOfOccurence: dayjs(startDate).format("YYYY-MM-DD HH:mm:ss"),
            timeOfAcknowledge: dayjs(endDate).format("YYYY-MM-DD HH:mm:ss"),
            duration: dayjs
              .duration(dayjs(endDate).diff(dayjs(startDate)))
              .asSeconds(),
            dataSource: rawData[5],
            alarmArea: rawData[6],
            alarmCode: rawData[7],
            alarmText: rawData[8],
            severity: rawData[9],
            classification: rawData[10],
            alarmId: `${rawData[5]}.${rawData[6]}.${rawData[7]}`.toLowerCase(),
          };
        })
        .filter((l) => l !== null);
    },
    importCSV(lines) {
      return lines
        .filter((l) => l.length > 5)
        .map((line) => {
          const rawData = line.replaceAll('"', "").split(";");
          if (rawData.length < 11) return null;
          if (!!!rawData[0].match(/\d/)) return null;
          const startDate = dayjs(rawData[1], "D MMM YYYY à HH:mm:ss", "fr");
          const endDate = dayjs(rawData[2], "D MMM YYYY à HH:mm:ss", "fr");
          if (!startDate.isValid() || !endDate.isValid()) return null;
          if (rawData[7] === "M6009.0306") return null; // Don't put in DB the warning from the shuttle
          if (rawData[7] === "M6130.0201") return null; // Don't put in DB the warning from the shuttle
          if (rawData[7] === "M6130.0203") return null; // Don't put in DB the warning from the shuttle
          if (rawData[7] === "M6130.0202") return null; // Don't put in DB the warning from the shuttle
          return {
            dbId: rawData[0],
            timeOfOccurence: startDate.format("YYYY-MM-DD HH:mm:ss"),
            timeOfAcknowledge: endDate.format("YYYY-MM-DD HH:mm:ss"),
            duration: dayjs.duration(endDate.diff(startDate)).asSeconds(),
            dataSource: rawData[5],
            alarmArea: rawData[6],
            alarmCode: rawData[7],
            alarmText: rawData[8],
            severity: rawData[9],
            classification: rawData[10],
            assignedUser: rawData[12],
            alarmId: `${rawData[5]}.${rawData[6]}.${rawData[7]}`.toLowerCase(),
          };
        });
    },
    finishImport() {
      this.loading = false;
      this.importing = false;
    },
    clearDataLog() {
      this.dataLog = [];
    },
    async setPrimary(alarmId) {
      return new Promise((resolve, reject) => {
        api.post("/alarms/primary", { alarmId }).then((res) => {
          // Update the alarm in the store
          const alarm = this.alarms.find((a) => a.alarmId === alarmId);
          if (alarm) {
            alarm.type = "primary";
          }
          resolve(res.data);
        });
      });
    },
    async setSecondary(alarmId) {
      return new Promise((resolve, reject) => {
        api.post("/alarms/secondary", { alarmId }).then((res) => {
          // Update the alarm in the store
          const alarm = this.alarms.find((a) => a.alarmId === alarmId);
          if (alarm) {
            alarm.type = "secondary";
          }
          resolve(res.data);
        });
      });
    },
    async setHuman(alarmId) {
      return new Promise((resolve, reject) => {
        api.post("/alarms/human", { alarmId }).then((res) => {
          // Update the alarm in the store
          const alarm = this.alarms.find((a) => a.alarmId === alarmId);
          if (alarm) {
            alarm.type = "human";
          }
          resolve(res.data);
        });
      });
    },
    async setOther(alarmId) {
      return new Promise((resolve, reject) => {
        api.post("/alarms/other", { alarmId }).then((res) => {
          // Update the alarm in the store
          const alarm = this.alarms.find((a) => a.alarmId === alarmId);
          if (alarm) {
            alarm.type = "other";
          }
          resolve(res.data);
        });
      });
    },
    getAlarm(alarmIdCode) {
      return new Promise((resolve, reject) => {
        api.get(`/alarms/${alarmIdCode}`).then((res) => {
          resolve(res.data);
        });
      });
    },
    getAlarmsByUsers(from, to) {
      return new Promise((resolve, reject) => {
        api.get(`/alarms/by-users/${from}/${to}`).then((res) => {
          resolve(res.data);
        });
      });
    },
    updateAlarmZone(data) {
      return new Promise((resolve, reject) => {
        this.alarms.find((a) => a.alarmId == data.alarmId).TGWzone = {
          zones: data.zones,
        };
        api
          .post(`/alarms/zone/${data.alarmId}`, {
            zones: data.zones,
          })
          .then((result) => {
            this.alarms.find((a) => a.alarmId == data.alarmId).TGWzone = {
              zones: data.zones,
            };
            resolve(true);
          });
      });
    },
    setProductionData(data) {
      return new Promise((resolve, reject) => {
        api.post("/production/data", { ...data }).then((response) => {
          // Replace if exist else add
          const index = this.productionData.findIndex(
            (p) => p.date === data.date
          );
          if (index >= 0) this.productionData[index] = data;
          else this.productionData.push(data);
          resolve(response.data);
        });
      });
    },
  },
  persist: false,
});

class ProgressTracker {
  constructor() {
    this.startTime = dayjs();
    this.lastUpdateTime = this.startTime;
    this.importedLines = 0;
    this.totalLines = 0;
    this.timePerLineEMA = null;
    this.alpha = 0.01; // EMA smoothing factor (0.1 = more stable, 0.3 = more reactive)
    this.updateCount = 0;
  }

  initialize(totalLines) {
    this.totalLines = totalLines;
    this.startTime = dayjs();
    this.lastUpdateTime = this.startTime;
    this.importedLines = 0;
    this.timePerLineEMA = null;
    this.updateCount = 0;

    return this.getProgress();
  }

  update(currentLines) {
    this.updateCount++;
    const currentTime = dayjs();
    const deltaLines = currentLines - this.importedLines;
    const deltaTime = currentTime.diff(this.lastUpdateTime, "milliseconds");

    // Only update estimates if we have processed some lines
    if (deltaLines > 0 || deltaTime > 0) {
      const currentTimePerLine = deltaTime / deltaLines;

      // Initialize EMA on first update
      if (this.timePerLineEMA === null) {
        this.timePerLineEMA = currentTimePerLine;
      } else {
        // Update EMA
        this.timePerLineEMA =
          currentTimePerLine * this.alpha +
          this.timePerLineEMA * (1 - this.alpha);
      }
    }

    this.importedLines = currentLines;
    this.lastUpdateTime = currentTime;

    return this.getProgress();
  }

  getProgress() {
    const currentTime = dayjs();
    const elapsedTime = currentTime.diff(this.startTime, "seconds");
    const percentComplete = (this.importedLines / this.totalLines) * 100;

    let estimatedTimeLeft = null;
    let speed = null;

    if (this.timePerLineEMA !== null) {
      estimatedTimeLeft =
        ((this.totalLines - this.importedLines) * this.timePerLineEMA) / 1000; // seconds
      speed = 1 / this.timePerLineEMA; // lines per second
    }

    return {
      elapsedTime: dayjs.duration(elapsedTime, "seconds").format("HH:mm:ss"),
      estimatedTimeLeft: estimatedTimeLeft,
      percentComplete: percentComplete.toFixed(2),
      linesProcessed: this.importedLines,
      totalLines: this.totalLines,
      speed: speed
        ? `${(speed * 60).toFixed(0)} lines/minute`
        : "calculating...",
      isComplete: this.importedLines >= this.totalLines,
    };
  }
}
