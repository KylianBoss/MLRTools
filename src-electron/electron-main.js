import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import express from "express";
import { startServer, closeServer } from "./server";
import os from "os";
import fs from "fs";
import fsPromises from "fs/promises";
import readline from "readline";
import { AutoUpdater } from "./auto-updater.js";

// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

let mainWindow;
let httpServer;

function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    icon: path.resolve(__dirname, "icons/icon.png"), // tray icon
    width: 1200,
    height: 800,
    useContentSize: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      nodeIntegration: true,
      enableRemoteModule: false,
      preload: path.resolve(__dirname, process.env.QUASAR_ELECTRON_PRELOAD),
    },
  });

  // Contrôle du stockage
  const storagePath = path.join(process.cwd(), "storage");

  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
    console.log("Storage directory created at:", storagePath);
  } else {
    console.log("Storage directory already exists at:", storagePath);
  }

  // Démarrage du serveur HTTP
  if (!httpServer && startServer && typeof startServer === "function") {
    startServer()
      .then((server) => {
        httpServer = server;
        console.log("HTTP server started successfully");

        mainWindow.loadURL(process.env.APP_URL);
        console.log("Main window URL loaded:", process.env.APP_URL);
      })
      .catch((error) => {
        console.error("Error while starting HTTP server:", error);
      });
  } else {
    console.log("Server not available or already running");
  }

  if (process.env.DEBUGGING) {
    // if on DEV or Production with debug enabled
    mainWindow.webContents.openDevTools();
  } else {
    // we're on production; no access to devtools pls
    // mainWindow.webContents.on('devtools-opened', () => {
    //   mainWindow.webContents.closeDevTools()
    // })
  }

  // enable(mainWindow.webContents);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  createWindow();

  // Initialize auto-updater
  new AutoUpdater(mainWindow, "KylianBoss", "MLRTools");

  app.on("activate", () => {
    if (mainWindow === null) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", async () => {
  // Arrêter le serveur si la mainWindow est fermée
  if (httpServer) {
    console.log("Stopping HTTP server...");
    await closeServer(httpServer)
      .then(() => {
        console.log("HTTP server stopped successfully");
      })
      .catch((error) => {
        console.error("Error while stopping HTTP server:", error);
      });
  }
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

// Gestion des erreurs non capturées
process.on("uncaughtException", (error) => {
  console.error("Erreur non capturée:", error);
  // En mode kiosque, redémarrer l'application
  if (isKioskMode) {
    app.relaunch();
    app.exit();
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Promesse rejetée non gérée:", reason);
});
