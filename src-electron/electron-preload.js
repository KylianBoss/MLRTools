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
  selectFile: (filter) => ipcRenderer.invoke("selectFile", filter),
  readLargeFile: (filePath) => {
    return new Promise((resolve, reject) => {
      const chunks = [];
      ipcRenderer.on("fileChunk", (event, chunk) => {
        chunks.push(chunk);
      });

      ipcRenderer
        .invoke("readLargeFile", filePath)
        .then(() => resolve(chunks))
        .catch(reject);
    });
  },
  serverRequest: (method, path, body) =>
    ipcRenderer.invoke("server-request", { method, path, body }),
  printPDF: (pdfBuffer) => ipcRenderer.invoke('print-pdf', pdfBuffer)
});
