import { defineStore } from "pinia";
import { Notify } from "quasar";

export const useAppStore = defineStore("App", {
  state: () => ({
    notConfigured: true,
    user: null,
    users: [],
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
