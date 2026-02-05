import { ipcMain, app } from "electron";
import axios from "axios";
import semver from "semver";
import fs from "fs";
import path from "path";
import cron from "node-cron";
import { createRequire } from "module";
import https from "https";
import { spawn } from "child_process";

const require = createRequire(import.meta.url);

export class AutoUpdater {
  constructor(mainWindow, githubOwner, githubRepo) {
    this.mainWindow = mainWindow;
    this.githubOwner = githubOwner;
    this.githubRepo = githubRepo;
    this.console = {
      info: (...messages) => {
        if (!this.mainWindow || this.mainWindow.isDestroyed())
          return console.info(...messages);
        const processedMessages = messages.map((msg) => {
          if (typeof msg === "object" && msg !== null) {
            return {
              __isObject: true,
              type: "info",
              value: JSON.parse(JSON.stringify(msg)),
            };
          }
          return msg;
        });
        console.log(...processedMessages);
        this.mainWindow.webContents.send("console-log", processedMessages);
      },
      warn: (...messages) => {
        if (!this.mainWindow || this.mainWindow.isDestroyed())
          return console.warn(...messages);
        const processedMessages = messages.map((msg) => {
          if (typeof msg === "object" && msg !== null) {
            return {
              __isObject: true,
              type: "warn",
              value: JSON.parse(JSON.stringify(msg)),
            };
          }
          return msg;
        });
        console.log(...processedMessages);
        this.mainWindow.webContents.send("console-log", processedMessages);
      },
      error: (...messages) => {
        if (!this.mainWindow || this.mainWindow.isDestroyed())
          return console.error(...messages);
        const processedMessages = messages.map((msg) => {
          if (typeof msg === "object" && msg !== null) {
            return {
              __isObject: true,
              type: "error",
              value: JSON.parse(JSON.stringify(msg)),
            };
          }
          return msg;
        });
        console.log(...processedMessages);
        this.mainWindow.webContents.send("console-log", processedMessages);
      },
      log: (...messages) => {
        if (!this.mainWindow || this.mainWindow.isDestroyed())
          return console.log(...messages);
        const processedMessages = messages.map((msg) => {
          if (typeof msg === "object" && msg !== null) {
            return {
              __isObject: true,
              type: "log",
              value: JSON.parse(JSON.stringify(msg)),
            };
          }
          return msg;
        });
        console.log(...processedMessages);
        this.mainWindow.webContents.send("console-log", processedMessages);
      },
    };

    let version;
    try {
      const packageJson = require("../package.json");
      version = packageJson.version;
    } catch (error) {
      // Fallback to app.getVersion() if package.json is not available (in production)
      version = app.getVersion();
    }
    this.console.log("App version:", version); // Debug log
    this.currentVersion = version;
    this.setupIPC();
    this.setupCron();
    this.console.log("AutoUpdater initialized");
  }

  setupCron() {
    // Check for updates every 10 minutes
    cron.schedule("*/10 * * * *", () => {
      this.checkForUpdates()
        .then((result) => {
          if (
            result.updateAvailable &&
            this.mainWindow &&
            !this.mainWindow.isDestroyed()
          )
            this.mainWindow.webContents.send("update-available", result);
        })
        .catch((error) => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(
              "console-log",
              `Cron job update check failed: ${error}`
            );
          } else {
            console.error(`Cron job update check failed: ${error}`);
          }
        });
    });
  }

  setupIPC() {
    // Remove existing handlers to prevent double registration
    ipcMain.removeHandler("check-for-updates");
    ipcMain.removeHandler("download-update");
    ipcMain.removeHandler("install-update");
    ipcMain.removeHandler("restart-app");

    // Handle check for updates request from renderer
    ipcMain.handle("check-for-updates", async () => {
      return await this.checkForUpdates();
    });

    // Handle update download request from renderer
    ipcMain.handle("download-update", async () => {
      return await this.downloadUpdate();
    });

    // Handle update installation request from renderer
    ipcMain.handle("install-update", async () => {
      return await this.installUpdate();
    });

    // Handle app restart
    ipcMain.handle("restart-app", () => {
      app.relaunch();
      app.exit();
    });
  }

  async checkForUpdates() {
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${this.githubOwner}/${this.githubRepo}/releases/latest`
      );

      // Clean up version strings
      const latestVersion = response.data.tag_name.replace(/^v/i, "").trim();
      const currentVersion = this.currentVersion.trim();

      const updateAvailable = semver.gt(latestVersion, currentVersion);
      const windowsAsset = response.data.assets.find((asset) =>
        asset.name.endsWith(".zip")
      );

      return {
        currentVersion: this.currentVersion,
        latestVersion,
        updateAvailable,
        downloadUrl:
          updateAvailable && windowsAsset
            ? windowsAsset.browser_download_url
            : null,
      };
    } catch (error) {
      this.console.error("Error checking for updates:", error);
      throw new Error("Failed to check for updates");
    }
  }

  async downloadUpdate() {
    try {
      const { downloadUrl } = await this.checkForUpdates();
      if (!downloadUrl) {
        throw new Error("No update available");
      }

      this.console.info("Downloading update from:", downloadUrl);
      const response = await axios({
        method: "get",
        url: downloadUrl,
        responseType: "arraybuffer",
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
      });
      this.console.info("Update downloaded successfully");
      const downloadPath = path.join(app.getPath("temp"), "update.zip");
      fs.writeFileSync(downloadPath, response.data);
      this.console.info("Update saved to:", downloadPath);

      return { success: true, downloadPath };
    } catch (error) {
      this.console.error("Error downloading update:", error);
      throw new Error("Failed to download update");
    }
  }

  async installUpdate() {
    try {
      const downloadPath = path.join(app.getPath("temp"), "update.zip");
      const tempExtractPath = path.join(app.getPath("temp"), "update-extract");
      const appPath = path.dirname(app.getPath("exe"));
      const appName = path.basename(app.getPath("exe"));

      // Create batch script to do everything
      const scriptContent = `
        @echo off
        echo ================ UPDATE PROCESS STARTING ================
        echo Current time: %TIME%

        echo.
        echo Step 1: Closing current application...
        taskkill /F /IM "${appName}" /T
        timeout /t 2 /nobreak >nul

        echo.
        echo Step 2: Cleaning extract directory...
        if exist "${tempExtractPath}" rmdir /S /Q "${tempExtractPath}"
        mkdir "${tempExtractPath}"

        echo.
        echo Step 3: Extracting update...
        powershell -command "Expand-Archive -Path '${downloadPath}' -DestinationPath '${tempExtractPath}' -Force"

        echo.
        echo Step 4: Copying files to application directory...
        xcopy "${path.join(
          tempExtractPath,
          "MLR Tools-win32-x64"
        )}" "${appPath}" /E /I /Y

        echo.
        echo Step 5: Cleanup...
        rmdir /S /Q "${tempExtractPath}"
        del "${downloadPath}"

        echo.
        echo Step 6: Starting updated application...
        start "" "${app.getPath("exe")}"

        echo.
        echo ================ UPDATE COMPLETE ================
        echo Update finished at: %TIME%
        echo.

        rem Self-delete and close window
        (goto) 2>nul & del "%~f0" & exit
      `;

      const scriptPath = path.join(app.getPath("temp"), "update.bat");
      fs.writeFileSync(scriptPath, scriptContent);

      spawn("cmd.exe", ["/c", "start", scriptPath], {
        detached: true,
        stdio: "ignore",
      }).unref();

      app.quit();
      return { success: true };
    } catch (error) {
      this.console.error("Error installing update:", error);
      // Clean up
      fs.rmSync(downloadPath);
      fs.rmSync(tempExtractPath, { recursive: true });
      throw new Error("Failed to install update");
    }
  }
}
