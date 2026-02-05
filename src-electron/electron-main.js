import { app, BrowserWindow, ipcMain, Notification, dialog } from "electron";
import path from "path";
import { startServer, closeServer } from "./server";
import os from "os";
import fs from "fs";
import { AutoUpdater } from "./auto-updater.js";
import { EventSource } from "eventsource";
import { fileURLToPath } from "url";

// ESM compatibility: define __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Preload path - in dev mode, Quasar compiles to preload/electron-preload.cjs
const preloadPath = path.join(__dirname, "preload", "electron-preload.cjs");

console.log("Preload path:", preloadPath);
console.log("Preload exists:", fs.existsSync(preloadPath));

// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

app.setName("MLR Tools");

let mainWindow;
let httpServer;
let eventSource;
let autoUpdater;
let isRecoveryMode = false;

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
      enableRemoteModule: false,
      preload: preloadPath,
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

        connectToServer();

        // En mode dev, utiliser APP_URL, en production utiliser loadFile
        if (process.env.APP_URL) {
          mainWindow.loadURL(process.env.APP_URL);
          console.log("Main window URL loaded:", process.env.APP_URL);
        } else {
          // Production: charger le fichier index.html depuis le même dossier
          mainWindow.loadFile(path.join(__dirname, "index.html"));
          console.log("Main window file loaded: index.html");
        }
      })
      .catch((error) => {
        console.error("Error while starting HTTP server:", error);
        // Activer le mode recovery uniquement en production
        if (process.env.NODE_ENV !== "development") {
          activateRecoveryMode(error);
        } else {
          console.error(
            "Development mode: Recovery mode disabled. Full error:"
          );
          console.error(error.stack);
        }
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
  // ÉTAPE 1: Vérifier les updates AVANT tout démarrage (sauf en dev)
  if (process.env.NODE_ENV !== "development") {
    try {
      console.log("Checking for updates before startup...");
      // Créer une fenêtre minimale pour l'auto-updater
      const checkWindow = new BrowserWindow({
        width: 400,
        height: 200,
        show: false,
        frame: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      autoUpdater = new AutoUpdater(checkWindow, "KylianBoss", "MLRTools");

      // Attendre la vérification (avec timeout de 10s)
      await Promise.race([
        new Promise((resolve) => {
          // Écouter les événements de l'auto-updater
          ipcMain.once("update-downloaded", () => {
            console.log("Update downloaded, will install and restart");
            resolve();
          });
          ipcMain.once("update-not-available", () => {
            console.log("No update available, continuing startup");
            resolve();
          });
          ipcMain.once("update-error", () => {
            console.log("Update check failed, continuing startup");
            resolve();
          });
        }),
        new Promise((resolve) => setTimeout(resolve, 10000)), // Timeout 10s
      ]);

      checkWindow.close();
    } catch (error) {
      console.error("Error checking for updates:", error);
      // Continuer quand même le démarrage
    }
  }

  // ÉTAPE 2: Démarrer l'application normalement
  try {
    createWindow();
  } catch (error) {
    console.error("Critical error during startup:", error);
    // Activer le mode recovery uniquement en production
    if (process.env.NODE_ENV !== "development") {
      activateRecoveryMode(error);
    } else {
      // En mode dev, juste logger l'erreur et laisser le dev voir l'erreur complète
      console.error("Development mode: Recovery mode disabled");
      console.error(error.stack);
    }
  }

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
  if (eventSource) {
    eventSource.close();
  }
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

// Functions
// Function to show notifications
function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({
      title: title,
      body: body,
      silent: true, // Set to true to avoid sound
    }).show();
  }
}

// Function to activate recovery mode
function activateRecoveryMode(error) {
  console.error("=== RECOVERY MODE ACTIVATED ===");
  console.error("Error:", error);

  isRecoveryMode = true;

  // Créer une fenêtre de recovery simple
  const recoveryWindow = new BrowserWindow({
    width: 500,
    height: 400,
    resizable: false,
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Charger une page HTML simple avec le message d'erreur
  const recoveryHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>MLR Tools - Recovery Mode</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          margin: 0;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          color: white;
        }
        .container {
          background: rgba(255, 255, 255, 0.95);
          color: #333;
          border-radius: 12px;
          padding: 30px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.3);
          max-width: 450px;
          text-align: center;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          margin: 0 0 15px 0;
          font-size: 24px;
          color: #e74c3c;
        }
        p {
          margin: 10px 0;
          line-height: 1.6;
          color: #555;
        }
        .error-box {
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 6px;
          padding: 15px;
          margin: 20px 0;
          text-align: left;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          color: #856404;
          max-height: 100px;
          overflow-y: auto;
        }
        .spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #667eea;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 20px auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .status {
          font-weight: bold;
          color: #667eea;
          margin: 15px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">⚠️</div>
        <h1>Mode Récupération</h1>
        <p>MLR Tools a rencontré une erreur critique au démarrage.</p>
        <div class="error-box">${error.message || error.toString()}</div>
        <div class="spinner"></div>
        <div class="status">Vérification des mises à jour...</div>
        <p style="font-size: 12px; color: #999; margin-top: 20px;">
          Si une mise à jour est disponible, elle sera téléchargée et installée automatiquement.
        </p>
      </div>
    </body>
    </html>
  `;

  recoveryWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(recoveryHTML)}`
  );

  // Forcer la vérification des mises à jour
  if (process.env.NODE_ENV !== "development") {
    try {
      console.log("Forcing update check in recovery mode...");
      autoUpdater = new AutoUpdater(recoveryWindow, "KylianBoss", "MLRTools");

      // Attendre un peu pour laisser l'updater se déclencher
      setTimeout(() => {
        // Si après 30s aucune update n'est disponible, afficher un message
        dialog
          .showMessageBox(recoveryWindow, {
            type: "error",
            title: "Erreur Critique",
            message: "L'application ne peut pas démarrer",
            detail: `Erreur: ${error.message}\n\nAucune mise à jour disponible. Veuillez:\n1. Réinstaller l'application manuellement\n2. Ou contacter le support technique\n\nUtilisez le script ForceUpdate-MLRTools.ps1 pour forcer la mise à jour.`,
            buttons: ["Quitter"],
          })
          .then(() => {
            app.quit();
          });
      }, 30000);
    } catch (updateError) {
      console.error("Error in recovery mode auto-updater:", updateError);
      dialog
        .showMessageBox(recoveryWindow, {
          type: "error",
          title: "Erreur Critique",
          message: "Impossible de vérifier les mises à jour",
          detail: `Erreur de démarrage: ${error.message}\nErreur de mise à jour: ${updateError.message}\n\nVeuillez réinstaller l'application manuellement.`,
          buttons: ["Quitter"],
        })
        .then(() => {
          app.quit();
        });
    }
  } else {
    // En mode dev, juste afficher l'erreur
    dialog
      .showMessageBox(recoveryWindow, {
        type: "error",
        title: "Erreur de Développement",
        message: "Erreur au démarrage (Mode Dev)",
        detail: error.stack || error.message || error.toString(),
        buttons: ["Quitter"],
      })
      .then(() => {
        app.quit();
      });
  }
}
// Function to connect to WebSocket server
function connectToServer() {
  eventSource = new EventSource("http://localhost:3000/sse");

  eventSource.onopen = () => {
    console.log("SSE connection opened");
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "notification") {
        showNotification(data.title, data.body);
      }
      if (data.type === "router") {
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send("router", data);
        }
      }
    } catch (error) {
      console.error("Error parsing SSE:", error);
    }
  };

  eventSource.onerror = (error) => {
    console.error("Error SSE:", error);

    setTimeout(() => {
      if (eventSource.readyState === EventSource.CLOSED) {
        connectToServer();
      }
    }, 5000);
  };
}
// Function to send command to the frontend
function sendCommandToFrontend(command, payload = {}) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(command, payload || {});
  }
}

// IPC communication
// Handle IPC to show notifications
ipcMain.handle("show-notification", (event, { title, body }) => {
  showNotification(title, body);
});
// Minimize app
ipcMain.handle("minimize-app", () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});
// Maximize app
ipcMain.handle("maximize-app", () => {
  if (mainWindow) {
    if (!mainWindow.isMaximized()) {
      mainWindow.maximize();
    }
  }
});
// Restore app
ipcMain.handle("restore-app", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    }
  }
});
// Fullscreen app
ipcMain.handle("toggle-fullscreen-app", () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
});
// Restart app
ipcMain.handle("restart-app", () => {
  app.relaunch();
  app.exit(0);
});

// Gestion des erreurs non capturées
process.on("uncaughtException", (error) => {
  console.error("Erreur non capturée:", error);

  app.exit();
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Promesse rejetée non gérée:", reason);
});

export { sendCommandToFrontend };
