/**
 * This file is used specifically for security reasons.
 * Here you can access Nodejs stuff and inject functionality into
 * the renderer thread (accessible there through the "window" object)
 *
 * WARNING!
 * If you import anything from node_modules, then make sure that the package is specified
 * in package.json > dependencies and NOT in devDependencies
 *
 * Example (injects window.myAPI.doAThing() into renderer thread):
 *
 *   import { contextBridge } from 'electron'
 *
 *   contextBridge.exposeInMainWorld('myAPI', {
 *     doAThing: () => {}
 *   })
 *
 * WARNING!
 * If accessing Node functionality (like importing @electron/remote) then in your
 * electron-main.js you will need to set the following when you instantiate BrowserWindow:
 *
 * mainWindow = new BrowserWindow({
 *   // ...
 *   webPreferences: {
 *     // ...
 *     sandbox: false // <-- to be able to import @electron/remote in preload script
 *   }
 * }
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  restartApp: () => ipcRenderer.invoke("restart-app"),
  minimizeApp: () => ipcRenderer.invoke("minimize-app"),
  maximizeApp: () => ipcRenderer.invoke("maximize-restore-app"),
  toggleFullscreenApp: () => ipcRenderer.invoke("toggle-fullscreen-app"),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on("update-available", (_event, value) => callback(value));
  },
  removeUpdateListener: () => {
    ipcRenderer.removeAllListeners("update-available");
  },
  onRouter: (callback) => {
    ipcRenderer.on("router", (_event, value) => callback(value));
  },
});
