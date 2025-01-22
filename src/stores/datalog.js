import { defineStore } from "pinia";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import customParseFormat from "dayjs/plugin/customParseFormat";
import "dayjs/locale/fr";

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
    excludedAlarmIds: [],
    excludedAlarmCodes: [],
    alarms: [],
    dates: [],
    lastObjectTreated: null,
    productionTimes: [],
    importing: false,
  }),
  getters: {
    isMissingProductionTimes() {
      return (date) => {
        return !this.productionTimes.some(
          (p) => p.date === dayjs(date).format("YYYY-MM-DD")
        );
      };
    },
    isDayOff() {
      return (date) => {
        const dates = this.productionTimes.filter(
          (p) => p.date === dayjs(date).format("YYYY-MM-DD")
        );
        if (dates.length === 0) return false;
        if (dates[0].dayOff === 1) return true;
        return false;
      };
    },
    productionTime() {
      return (date) => {
        const productionTime = this.productionTimes.find(
          (p) => p.date === dayjs(date).format("YYYY-MM-DD")
        );
        return productionTime
          ? { from: productionTime.start, to: productionTime.end }
          : { from: "00:00", to: "23:59" };
      };
    },
  },
  actions: {
    async getData(startRow, count, filter, sortBy, descending, sum) {
      return new Promise((resolve, reject) => {
        window.electron
          .serverRequest("GET", "/alarms", {
            startRow,
            count,
            filter: { ...filter },
            sortBy,
            descending,
            sum,
          })
          .then((data) => {
            resolve(data.data);
          });
      });
    },
    async getNumberOfRows(filter) {
      console.log(filter);
      return new Promise((resolve, reject) => {
        window.electron
          .serverRequest("GET", "/alarms/count", filter)
          .then((data) => {
            resolve(data.data);
          });
      });
    },
    getMessages(from, to, includesExcluded = false) {
      return new Promise((resolve, reject) => {
        window.electron
          .serverRequest("GET", "/alarms/messages", {
            from,
            to,
            includesExcluded,
          })
          .then((data) => {
            console.log(data);
            resolve(data.data);
          });
      });
    },
    getKPItop3Count(filter) {
      return new Promise((resolve) => {
        window.electron
          .serverRequest("GET", "/alarms/kpi/count", filter)
          .then((response) => {
            resolve(response.data);
          });
      });
    },
    getKPItop3CountPerZone(filter) {
      return new Promise((resolve) => {
        window.electron
          .serverRequest(
            "GET",
            `/alarms/kpi/count/${filter.dataSource}`,
            filter
          )
          .then((data) => {
            resolve(data.data);
          });
      });
    },
    getKPItop3Duration(filter) {
      return new Promise((resolve) => {
        window.electron
          .serverRequest("GET", "/alarms/kpi/duration", filter)
          .then((data) => {
            resolve(data.data);
          });
      });
    },
    getDayResume(filter) {
      return new Promise((resolve) => {
        window.electron
          .serverRequest(
            "GET",
            `/alarms/kpi/resume/${filter.dataSource}`,
            filter
          )
          .then((response) => {
            resolve(response.data);
          });
      });
    },
    translateAlarm(alarmId, translation) {
      return new Promise((resolve, reject) => {
        window.electron
          .serverRequest("POST", "/alarms/translate", { alarmId, translation })
          .then((data) => {
            console.log(data);
            resolve(data.data);
          });
      });
    },
    initialize() {
      return new Promise(async (resolve, reject) => {
        try {
          console.log("Initializing data log store");
          await window.electron
            .serverRequest("GET", "/alarms/day")
            .then((data) => {
              this.dates = data.data;
            });
          await window.electron
            .serverRequest("GET", "/alarms/unique?excluded=false")
            .then((data) => {
              this.alarms = data.data;
            });
          await window.electron
            .serverRequest("GET", "/alarms/exclude/id")
            .then((data) => {
              this.excludedAlarmIds = data.data;
            });
          await window.electron
            .serverRequest("GET", "/alarms/exclude/code")
            .then((data) => {
              this.excludedAlarmCodes = data.data;
            });
          await window.electron
            .serverRequest("GET", "/production/times")
            .then((response) => {
              this.productionTimes = response.data;
            });
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
      await window.electron.serverRequest("POST", "/alarms", newData);
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
          // const parseTimeRegex =
          //   /(\d{1,2})\s+([\wéû]+\.?)\s+(\d{4})\s+à\s+(\d{2}:\d{2}:\d{2})/gi;
          // const start = [...rawData[1].matchAll(parseTimeRegex)];
          // const end = [...rawData[2].matchAll(parseTimeRegex)];
          const startDate = dayjs(rawData[1], "D MMM YYYY à HH:mm:ss", "fr");
          const endDate = dayjs(rawData[2], "D MMM YYYY à HH:mm:ss", "fr");
          // const startDate = `${start[0][3]}-${
          //   monthNames.indexOf(start[0][2])
          // }-${start[0][1]} ${start[0][4]}`;
          // const endDate = `${end[0][3]}-${monthNames.indexOf(end[0][2]) + 1}-${
          //   end[0][1]
          // } ${end[0][4]}`;
          // if (!startDate || !endDate) return null;
          if (!startDate.isValid() || !endDate.isValid()) return null;
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
        })
        .filter((l) => l !== null);
    },
    finishImport() {
      this.loading = false;
      this.importing = false;
    },
    clearDataLog() {
      this.dataLog = [];
    },
    async excludeAlarmId(alarmId) {
      window.electron
        .serverRequest("POST", "/alarms/exclude/id", alarmId)
        .then(() => {
          this.excludedAlarmIds.push(alarmId);
          this.alarms = this.alarms.filter((a) => a.alarmId !== alarmId);
        });
    },
    async excludeAlarmCode(alarmCode) {
      window.electron
        .serverRequest("POST", "/alarms/exclude/code", alarmCode)
        .then(() => {
          this.excludedAlarmCodes.push(alarmCode);
          this.alarms = this.alarms.filter((a) => a.alarmCode !== alarmCode);
        });
    },
    async includeAlarm(alarmId) {
      window.electron
        .serverRequest("POST", "/alarms/include", alarmId)
        .then(() => {
          this.excludedAlarms = this.excludedAlarms.filter(
            (a) => a !== alarmId
          );
          this.alarms.push(this.alarms.find((a) => a.alarmId === alarmId));
        });
    },
    getAlarm(alarmId) {
      return new Promise((resolve, reject) => {
        window.electron
          .serverRequest("GET", `/alarms/${alarmId}`)
          .then((data) => {
            resolve(data.data);
          });
      });
    },
    updateAlarmZone(data) {
      return new Promise((resolve, reject) => {
        window.electron
          .serverRequest("POST", `/alarms/zone/${data.alarmId}`, {
            zone: data.zone,
            zone2: data.zone2,
            zone3: data.zone3,
            zone4: data.zone4,
            zone5: data.zone5,
          })
          .then((result) => {
            this.alarms.find((a) => a.alarmId == data.alarmId).TGWzone =
              result.data;
            resolve(true);
          });
      });
    },
    getProductionTimes() {
      return new Promise((resolve, reject) => {
        window.electron
          .serverRequest("GET", "/production/times")
          .then((response) => {
            this.productionTimes = response.data;
            resolve(response.data);
          });
      });
    },
    getProductionTime(date) {
      return new Promise((resolve, reject) => {
        window.electron
          .serverRequest("GET", `/production/times/${date}`)
          .then((response) => {
            resolve(response.data);
          });
      });
    },
    setProductionTime(data) {
      return new Promise((resolve, reject) => {
        window.electron
          .serverRequest("POST", `/production/times`, { ...data })
          .then((response) => {
            this.productionTimes.push(response.data);
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
