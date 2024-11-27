import { defineStore } from "pinia";
import { Notify } from "quasar";

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
    feedBackNotification(message, type) {
      Notify.create({
        message: message,
        type: type,
        position: "top",
        timeout: 3000,
      });
    },
  },
  persist: false,
});
