const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('pages/KPI.vue') },
      { path: 'search', name: 'search', component: () => import('pages/SearchMessages.vue') },
      { path: 'import', name: 'import', component: () => import('src/pages/ImportData.vue') },
      { path: 'excluded-alarms', name: 'excluded-alarms', component: () => import('src/pages/ExcludedAlarms.vue') },
      { path: 'suspicious-places', name: 'suspicious_places', component: () => import('src/pages/SuspiciousPlaces.vue') },
      { path: 'charts', name: 'charts', component: () => import('src/pages/ChartsPage.vue') },
    ]
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
]

export default routes
