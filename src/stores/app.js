import { defineStore } from "pinia";
import { Notify } from "quasar";
import { api } from "boot/axios";
import { useConfigurationDialog } from "src/plugins/useConfigurationDialog.js";
import { Loading } from "quasar";

export const useAppStore = defineStore("App", {
  state: () => ({
    notConfigured: true,
    user: null,
    users: [],
    cronJobsInitialized: false,
    loading: false,
  }),
  getters: {
    userHasAccess: (state) => (menuId) => {
      if (menuId === "*") return true;
      return state.user.UserAccesses.includes(menuId);
    },
    userHaveAccessToOneOf: (state) => (menuIds) => {
      return state.user.UserAccesses.some((access) => menuIds.includes(access));
    },
    userId: (state) => {
      return state.user ? state.user.id : null;
    },
    isBot: (state) => {
      return state.user && state.user.isBot;
    },
    isAdmin: (state) => {
      return state.user && state.user.isAdmin;
    },
    isTechnician: (state) => {
      return state.user && state.user.isTechnician;
    },
  },
  actions: {
    init() {
      return new Promise((resolve, reject) => {
        console.log("Initializing app store");
        api
          .get("/config")
          .then((response) => {
            if (response.data && response.data.config === true) {
              this.notConfigured = false;
              this.user = response.data.user;
              this.user.UserAccesses = this.user.UserAccesses.map(
                (access) => access.menuId
              );
              if (this.isBot)
                api
                  .post("/cron/initialize", {
                    user: this.user.username,
                  })
                  .then(() => {
                    this.cronJobsInitialized = true;
                  });
              resolve(true);
            }
          })
          .catch((error) => {
            if (error.response && error.response.status === 404) {
              this.notConfigured = true;
              const { askForConfigFile } = useConfigurationDialog();
              askForConfigFile()
                .then((file) => {
                  this.loadConfig(file)
                    .then((result) => {
                      if (result) {
                        resolve(true);
                      } else {
                        reject(new Error("Failed to load configuration"));
                      }
                    })
                    .catch((error) => {
                      console.error("Error loading configuration:", error);
                      reject(error);
                    });
                })
                .catch((error) => {
                  console.error("Configuration dialog cancelled:", error);
                  reject(error);
                });
            }
          });
      });
    },
    loadConfig(file) {
      return new Promise((resolve, reject) => {
        console.info("Loading configuration file in server");
        const reader = new FileReader();
        reader.onload = (event) => {
          console.info("Sending file to server");
          const config = JSON.parse(event.target.result);
          api
            .post("/config", config)
            .then((response) => {
              console.info("File sent to server");
              if (response.status === 201) {
                console.info("Configuration loaded");
                this.notConfigured = false;
                this.user = response.data.user;
                this.user.UserAccesses = this.user.UserAccesses.map(
                  (access) => access.menuId
                );
                this.notConfigured = false;
                resolve(true);
              } else {
                console.error("Error loading configuration:", response);
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
    getUsers() {
      return new Promise((resolve, reject) => {
        api
          .get("/users")
          .then((response) => {
            this.users = response.data;
            resolve(response.data);
          })
          .catch((error) => {
            console.error("Error getting users:", error);
            reject(error);
          });
      });
    },
    updateUser(user) {
      return new Promise((resolve, reject) => {
        api
          .put("/users", user)
          .then((response) => {
            resolve(response);
          })
          .catch((error) => {
            console.error("Error updating user:", error);
            reject(error);
          });
      });
    },
    editUser(user) {
      return new Promise((resolve, reject) => {
        api
          .put("/users", user)
          .then((response) => {
            resolve(response);
          })
          .catch((error) => {
            console.error("Error editing user:", error);
            reject(error);
          });
      });
    },
    authorizeUser(username) {
      return new Promise((resolve, reject) => {
        api
          .post("/users/authorize", { username: username })
          .then((response) => {
            if (response.statusCode === 200) {
              this.user = response.data.user;
              this.user.UserAccesses = this.user.UserAccesses.map(
                (access) => access.menuId
              );
              resolve(true);
            } else {
              resolve(false);
            }
          })
          .catch((error) => {
            console.error("Error authorizing user:", error);
            reject(error);
          });
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
    notify(message, type = "info") {
      Notify.create({
        message: message,
        type: type,
        position: "top",
        timeout: 3000,
      });
    }
  },
  persist: false,
});
