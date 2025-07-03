import { boot } from "quasar/wrappers";
import axios from "axios";

// Be careful when using SSR for cross-request state pollution
// due to creating a Singleton instance here;
// If any client changes this (global) instance, it might be a
// good idea to move this instance creation inside of the
// "export default () => {}" function below (which runs individually
// for each client)
const api = axios.create({
  baseURL: "http://localhost:3000",
  timeout: 60000,
});

// Configuration des intercepteurs pour la gestion des erreurs
api.interceptors.request.use(
  (config) => {
    // Ajouter des headers si nécessaire
    config.headers["Content-Type"] = "application/json";
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Gestion des erreurs communes
    if (error.response) {
      // Le serveur a répondu avec un code d'erreur
      const status = error.response.status;
      const message = error.response.data?.error || "Erreur serveur";

      switch (status) {
        case 404:
          console.error("Ressource non trouvée:", message);
          break;
        case 403:
          console.error("Accès refusé:", message);
          break;
        case 500:
          console.error("Erreur serveur interne:", message);
          break;
        default:
          console.error(`Erreur ${status}:`, message);
      }
    } else if (error.request) {
      // La requête a été faite mais pas de réponse
      console.error("Pas de réponse du serveur");
    } else {
      // Erreur lors de la configuration de la requête
      console.error("Erreur de configuration:", error.message);
    }

    return Promise.reject(error);
  }
);

export default boot(({ app }) => {
  // for use inside Vue files (Options API) through this.$axios and this.$api

  app.config.globalProperties.$axios = axios;
  // ^ ^ ^ this will allow you to use this.$axios (for Vue Options API form)
  //       so you won't necessarily have to import axios in each vue file

  app.config.globalProperties.$api = api;
  // ^ ^ ^ this will allow you to use this.$api (for Vue Options API form)
  //       so you can easily perform requests against your app's API
});

export { api };
