import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { updateElectronApp } from "update-electron-app";
import path from "path";
import express from "express";
import { setupServer } from "./server";
import { syncDatabase } from "./database";
import os from "os";
import fs from "fs";
import fsPromises from "fs/promises";
import readline from "readline";
import dotenv from "dotenv";

dotenv.config();

// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

// Auto-updates
if (process.env.NODE_ENV === "production") {
  updateElectronApp({
    repo: "KylianBoss/MLRTools",
  });
}

let mainWindow;
let printWindow;
let expressApp;

function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    icon: path.resolve(__dirname, "icons/icon.png"), // tray icon
    width: 1000,
    height: 600,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      // More info: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/electron-preload-script
      preload: path.resolve(__dirname, process.env.QUASAR_ELECTRON_PRELOAD),
    },
  });

  printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(process.env.APP_URL);

  if (process.env.DEBUGGING) {
    // if on DEV or Production with debug enabled
    mainWindow.webContents.openDevTools();
  } else {
    // we're on production; no access to devtools pls
    // mainWindow.webContents.on('devtools-opened', () => {
    //   mainWindow.webContents.closeDevTools()
    // })
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function setupStorage() {
  // For development, use the current directory
  // For production, use the directory containing the .exe
  storagePath = app.isPackaged
    ? path.join(path.dirname(app.getPath("exe")), "storage")
    : path.join(__dirname, "storage");

  try {
    await fsPromises.mkdir(storagePath, { recursive: true });
    console.log("Storage directories created successfully");
  } catch (error) {
    console.error("Error creating storage directories:", error);
  }
}

app.commandLine.appendSwitch("js-flags", "--max-old-space-size=4096");
app.whenReady().then(async () => {
  await syncDatabase();
  await setupStorage();
  createWindow();

  // Setup embedded express server
  expressApp = express();
  expressApp.use(express.json());
  setupServer(expressApp);

  // Handle IPC messages
  ipcMain.handle("server-request", async (event, { method, path, body }) => {
    // Simulate an HTTP request to the express server
    return new Promise((resolve) => {
      const req = {
        method,
        url: path,
        body,
        headers: {},
      };
      const res = {
        statusCode: 200,
        headers: {},
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
          resolve({
            statusCode: this.statusCode,
            headers: this.headers,
            data: this.body,
          });
        },
        send(data) {
          this.body = data;
          resolve({
            statusCode: this.statusCode,
            headers: this.headers,
            data: this.body,
          });
        },
        setHeader(key, value) {
          this.headers[key] = value;
        },
      };
      expressApp(req, res, () => {
        // This is the "next" function, called if no route handles the request
        resolve({
          statusCode: 404,
          headers: res.headers,
          data: { error: "Not Found" },
        });
      });
    });
  });
  ipcMain.handle("selectFile", async (event, filter) => {
    console.log("selectFile", filter);
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [filter],
    });
    return result;
  });
  ipcMain.handle("readLargeFile", async (event, filePath) => {
    return new Promise((resolve, reject) => {
      const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity,
      });

      let chunk = [];
      rl.on("line", (line) => {
        chunk.push(line);
        if (chunk.length >= 1000) {
          event.sender.send("fileChunk", chunk);
          chunk = [];
        }
      });

      rl.on("close", () => {
        if (chunk.length > 0) {
          event.sender.send("fileChunk", chunk);
        }
        resolve();
      });

      rl.on("error", (err) => {
        reject(err);
      });
    });
  });
});

// Handle IPC messages for printing
ipcMain.handle("print-pdf", async (event, pdfUrl) => {
  return new Promise((resolve, reject) => {
    try {
      // Load the PDF in the hidden window
      printWindow.loadURL(pdfUrl);

      // Wait for the PDF to load
      printWindow.webContents.on("did-finish-load", () => {
        // Open print dialog
        printWindow.webContents.print(
          {
            silent: false,
            printBackground: true,
            deviceName: "",
          },
          (success, errorType) => {
            if (success) {
              resolve({ success: true });
            } else {
              if (errorType === "Print job canceled") {
                resolve({ success: false, canceled: true });
              }
              reject(new Error(`Print failed: ${errorType}`));
            }
          }
        );
      });
    } catch (error) {
      reject(error);
    }
  });
});

app.on("window-all-closed", () => {
  if (platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
