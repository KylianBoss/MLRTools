import { defineStore } from "pinia";

export const useAppStore = defineStore("App", {
  state: () => ({
    notConfigured: true,
    user: null,
  }),
  getters: {},
  actions: {
    init() {
      return new Promise((resolve, reject) => {
        window.electron
          .serverRequest("GET", "/config", null)
          .then((response) => {
            if (response.data && response.data.config === true) {
              this.notConfigured = false;
              this.user = response.data.user;
              this.user.UserAccesses = this.user.UserAccesses.map(
                (access) => access.menuId
              );
              resolve(true);
            } else {
              this.notConfigured = true;
              resolve(false);
            }
          })
          .catch((error) => {
            if (error.response.status === 404) {
              this.notConfigured = true;
              resolve(null);
            }
            console.error("Error getting configuration:", error);
          });
      });
    },
    loadConfig(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const config = JSON.parse(event.target.result);
          window.electron
            .serverRequest("POST", "/config", config)
            .then((response) => {
              if (response.statusCode === 201) {
                this.notConfigured = false;
                this.user = response.data.user;
                this.user.UserAccesses = this.user.UserAccesses.map(
                  (access) => access.menuId
                );
                resolve(true);
              } else {
                this.notConfigured = true;
                resolve(false);
              }
            })
            .catch((error) => {
              console.error("Error loading configuration:", error);
              reject(error);
            });
        };
        reader.onerror = (error) => {
          console.error("Error reading file:", error);
          reject(error);
        };
        reader.readAsText(file[0]);
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
