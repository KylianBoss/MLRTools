import { defineStore } from "pinia";
import { useAppStore } from "./app.js";

export const useDBStore = defineStore("DB", {
  state: () => ({
    loadingState: false,
  }),
  getters: {},
  actions: {
    syncModels() {
      return new Promise((resolve, reject) => {
        const App = useAppStore();
        this.loadingState = true;
        window.electron
          .serverRequest("POST", "/db/sync-models", {
            user: App.user.username,
          })
          .then((response) => {
            this.loadingState = false;
            if (response.statusCode === 201) {
              App.feedBackNotification("Models synced", "positive");
            } else {
              App.feedBackNotification("Error syncing models", "negative");
            }
            resolve(response);
          })
          .catch((error) => {
            this.loadingState = false;
            console.error("Error syncing models:", error);
            reject(error);
          });
      });
    },
    emptyDayResume() {
      return new Promise((resolve, reject) => {
        const App = useAppStore();
        this.loadingState = true;
        window.electron
          .serverRequest("POST", "/db/empty-day-resume", {
            user: App.user.username,
          })
          .then((response) => {
            this.loadingState = false;
            if (response.statusCode === 201) {
              App.feedBackNotification("Day resume emptied", "positive");
            } else {
              App.feedBackNotification("Error emptying day resume", "negative");
            }
            resolve(response);
          })
          .catch((error) => {
            this.loadingState = false;
            console.error("Error emptying day resume:", error);
            reject(error);
          });
      });
    },
    emptyDayResumeAtDate(date) {
      return new Promise((resolve, reject) => {
        const App = useAppStore();
        this.loadingState = true;
        window.electron
          .serverRequest("POST", "/db/empty-day-resume-at-date", {
            user: App.user.username,
            date,
          })
          .then((response) => {
            this.loadingState = false;
            if (response.statusCode === 201) {
              App.feedBackNotification("Day resume emptied", "positive");
            } else {
              App.feedBackNotification("Error emptying day resume", "negative");
            }
            resolve(response);
          })
          .catch((error) => {
            this.loadingState = false;
            console.error("Error emptying day resume:", error);
            reject(error);
          });
      });
    },
  },
  persist: false,
});
