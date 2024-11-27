import { defineStore } from "pinia";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(duration);
dayjs.extend(customParseFormat);

const monthNames = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
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
    excludedAlarms: [],
    alarms: [],
    dates: [],
    lastObjectTreated: null,
  }),
  getters: {},
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
          .then((data) => {
            resolve(data.data);
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
          .then((data) => {
            resolve(data.data);
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
      return new Promise((resolve, reject) => {
        try {
          console.log("Initializing data log store");
          window.electron.serverRequest("GET", "/alarms/day").then((data) => {
            this.dates = data.data;
          });
          window.electron
            .serverRequest("GET", "/alarms/unique?excluded=false")
            .then((data) => {
              this.alarms = data.data;
            });
          window.electron
            .serverRequest("GET", "/alarms/exclude")
            .then((data) => {
              this.excludedAlarms = data.data;
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

      for (const data of newData) {
        this.lastObjectTreated = data;

        await window.electron.serverRequest("POST", "/alarms", data);

        this.importedLines++;
        if (this.importedLines % 20 === 0)
          this.progression = this.progress.update(this.importedLines);
      }
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
          const parseTimeRegex =
            /(\d{1,2}) ([a-z]{3})[a-z]*\. (\d{4}) à (\d{2}:\d{2}:\d{2})/g;
          const startDate = rawData[1].match(parseTimeRegex);
          const endDate = rawData[2].match(parseTimeRegex);
          if (!startDate || !endDate) return null;
          if (!dayjs(startDate).isValid() || !dayjs(endDate).isValid())
            return null;
          return {
            dbId: rawData[0],
            timeOfOccurence: dayjs(startDate[0]).format("YYYY-MM-DD HH:mm:ss"),
            timeOfAcknowledge: dayjs(endDate[0]).format("YYYY-MM-DD HH:mm:ss"),
            duration: dayjs
              .duration(dayjs(endDate[0]).diff(dayjs(startDate[0])))
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
    finishImport() {
      this.loading = false;
    },
    clearDataLog() {
      this.dataLog = [];
    },
    async excludeAlarm(alarmId) {
      window.electron
        .serverRequest("POST", "/alarms/exclude", alarmId)
        .then(() => {
          this.excludedAlarms.push(alarmId);
          this.alarms = this.alarms.filter((a) => a.alarmId !== alarmId);
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
    this.alpha = 0.1; // EMA smoothing factor (0.1 = more stable, 0.3 = more reactive)
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
      estimatedTimeLeft: estimatedTimeLeft
        ? dayjs.duration(estimatedTimeLeft, "seconds").format("HH:mm:ss")
        : "--:--:--",
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
