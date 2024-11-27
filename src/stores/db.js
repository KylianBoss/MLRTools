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
  },
  persist: false,
});
