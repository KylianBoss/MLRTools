import { useAppStore } from "stores/app";

const routes = [
  {
    path: "/",
    component: () => import("layouts/MainLayout.vue"),
    children: [
      { path: "", name: "home", component: () => import("pages/KPI.vue") },
      {
        path: "search",
        name: "search",
        component: () => import("pages/SearchMessages.vue"),
      },
      {
        path: "import",
        name: "import",
        component: () => import("src/pages/ImportData.vue"),
      },
      {
        path: "excluded-alarms",
        name: "excluded-alarms",
        component: () => import("src/pages/ExcludedAlarms.vue"),
      },
      {
        path: "suspicious-places",
        name: "suspicious_places",
        component: () => import("src/pages/SuspiciousPlaces.vue"),
      },
      {
        path: "charts",
        name: "charts",
        component: () => import("src/pages/ChartsPage.vue"),
      },
      {
        path: "admin",
        beforeEnter: (to, from, next) => {
          const App = useAppStore();
          if (App.user && App.user.UserAccesses.includes("admin")) {
            next();
          } else {
            App.feedBackNotification(
              "Vous n'avez pas les droits pour accéder à cette page",
              "negative"
            );
            next({ name: "home" });
          }
        },
        children: [
          {
            path: "db",
            name: "admin-db",
            component: () => import("src/pages/admin/DatabaseSettings.vue"),
          },
        ],
      },
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: "/:catchAll(.*)*",
    component: () => import("pages/ErrorNotFound.vue"),
  },
];

export default routes;
