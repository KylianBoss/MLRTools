import { useAppStore } from "stores/app";

const routes = [
  {
    path: "/",
    component: () => import("layouts/MainLayout.vue"),
    children: [
      // === HOME === //
      {
        path: "",
        name: "home",
        component: () => import("pages/HomePage.vue"),
      },
      // === KPI === //
      { path: "kpi", name: "kpi", component: () => import("pages/KPI.vue") },
      {
        path: "search",
        name: "search",
        component: () => import("pages/SearchMessages.vue"),
      },
      // === CHARTS === //
      {
        path: "charts",
        children: [
          {
            path: "general",
            name: "general-charts",
            component: () => import("src/pages/ChartsPage.vue"),
          },
          {
            path: "faillure",
            name: "faillures-charts",
            component: () => import("src/pages/charts/FailluresChartsPage.vue"),
          },
          {
            path: "custom-charts",
            name: "custom-charts",
            component: () => import("src/pages/charts/CustomChartsPage.vue"),
          },
        ],
      },
      // === ALARMS === //
      {
        path: "alarms",
        children: [
          {
            path: "import",
            name: "import",
            component: () => import("src/pages/alarms/ImportData.vue"),
          },
          {
            path: "alarm-list",
            name: "alarm-list",
            component: () => import("src/pages/alarms/AlarmList.vue"),
          },
          {
            path: "production-data",
            name: "production-data",
            component: () => import("src/pages/alarms/ProductionData.vue"),
          },
          {
            path: "tgw-report-zones",
            name: "tgw-report-zones",
            component: () => import("src/pages/alarms/TGWReportZones.vue"),
          },
        ],
      },
      // === TOOLS === //
      {
        path: "tools",
        children: [
          {
            path: "suspicious-places",
            name: "suspicious_places",
            component: () => import("src/pages/tools/SuspiciousPlaces.vue"),
          },
        ],
      },
      // === MAINTENANCE === //
      {
        path: "maintenance",
        children: [
          {
            path: "scheduled",
            name: "maintenances-scheduled",
            component: () =>
              import("src/pages/maintenance/MaintenancesScheduled.vue"),
          },
          {
            path: "actual/:maintenanceId",
            name: "maintenance-actual",
            beforeEnter: (to, from, next) => {
              if (to.params.maintenanceId) {
                next();
              }
            },
            component: () =>
              import("src/pages/maintenance/MaintenanceView.vue"),
          },
          // === MAINTENANCE PLANS === //
          {
            path: "plans",
            children: [
              {
                path: "",
                name: "maintenance-plans",
                component: () =>
                  import("src/pages/maintenance/MaintenancePlans.vue"),
              },
              {
                path: ":planId",
                name: "maintenance-plan-details",
                beforeEnter: (to, from, next) => {
                  if (to.params.planId) {
                    next();
                  }
                },
                component: () =>
                  import("src/pages/maintenance/MaintenancePlanDetails.vue"),
              },
            ],
          },
          // === MAINTENANCE REPORTS === //
          {
            path: "reports",
            children: [
              {
                path: "",
                name: "maintenance-reports",
                component: () =>
                  import("src/pages/maintenance/MaintenanceReports.vue"),
              },
              {
                path: ":reportId",
                name: "maintenance-report-details",
                beforeEnter: (to, from, next) => {
                  if (to.params.reportId) {
                    return next();
                  }
                },
                component: () =>
                  import("src/pages/maintenance/MaintenanceReportDetails.vue"),
              },
            ],
          },
        ],
      },
      // === ADMINISTRATION === //
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
          {
            path: "users",
            name: "admin-users",
            component: () => import("src/pages/admin/UsersSettings.vue"),
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
