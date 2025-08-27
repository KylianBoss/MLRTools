import { app, BrowserWindow, ipcMain, Notification } from "electron";
import path from "path";
import { startServer, closeServer } from "./server";
import os from "os";
import fs from "fs";
import { AutoUpdater } from "./auto-updater.js";
import { EventSource } from "eventsource";

// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

app.setName("MLR Tools");

let mainWindow;
let httpServer;
let eventSource;

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

        connectToServer();

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

  // Initialize auto-updater only if not in development mode
  if (process.env.NODE_ENV !== "development") {
    try {
      new AutoUpdater(mainWindow, "KylianBoss", "MLRTools");
    } catch (error) {
      console.error("Error initializing auto-updater:", error);
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
// Function to connect to WebSocket server
function connectToServer() {
  eventSource = new EventSource("http://localhost:3000/sse");

  eventSource.onopen = () => {
    console.log("SSE connection opened");
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("SSE message recieved:", data);

      if (data.type === "notification") {
        showNotification(data.title, data.body);
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

// IPC communication
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
