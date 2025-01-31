import { defineStore } from "pinia";
import { Notify } from "quasar";

export const useAppStore = defineStore("App", {
  state: () => ({
    notConfigured: true,
    user: null,
    users: [],
  }),
  getters: {
    userHasAccess: (state) => (menuId) => {
      return state.user.UserAccesses.includes(menuId);
    },
    userHaveAccessToOneOf: (state) => (menuIds) => {
      return state.user.UserAccesses.some((access) => menuIds.includes(access));
    },
  },
  actions: {
    init() {
      return new Promise((resolve, reject) => {
        console.log("Initializing app store");
        window.electron
          .serverRequest("GET", "/config", null)
          .then((response) => {
            console.log(response)
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
        console.info("Loading configuration file in server");
        const reader = new FileReader();
        reader.onload = (event) => {
          console.info("Sending file to server");
          const config = JSON.parse(event.target.result);
          window.electron
            .serverRequest("POST", "/config", config)
            .then((response) => {
              console.info("File sent to server");
              if (response.statusCode === 201) {
                console.info("Configuration loaded");
                this.notConfigured = false;
                this.user = response.data.user;
                this.user.UserAccesses = this.user.UserAccesses.map(
                  (access) => access.menuId
                );
                this.notConfigured = false;
                window.electron.restartApp();
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
        window.electron
          .serverRequest("GET", "/users", null)
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
        window.electron
          .serverRequest("PUT", "/users", JSON.parse(JSON.stringify(user)))
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
        window.electron
          .serverRequest("PUT", "/users", user)
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
        window.electron
          .serverRequest("POST", "/users/authorize", { username: username })
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
  },
  persist: false,
});

class User {
  constructor(data) {
    this.fullname = data.fullname;
    this.username = data.username;
    this.id = data.id;
    this.authorised = data.authorised;
  }
}
