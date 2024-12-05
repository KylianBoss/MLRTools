import { ipcMain, app } from "electron";
import axios from "axios";
import semver from "semver";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import cron from "node-cron";

export class AutoUpdater {
  constructor(mainWindow, githubOwner, githubRepo) {
    this.mainWindow = mainWindow;
    this.githubOwner = githubOwner;
    this.githubRepo = githubRepo;

    let version;
    try {
      const packageJson = require("../package.json");
      version = packageJson.version;
    } catch (error) {
      // Fallback to app.getVersion() if package.json is not available (in production)
      version = app.getVersion();
    }
    console.log("App version:", version); // Debug log
    this.currentVersion = version;
    this.setupIPC();
    this.setupCron();
    console.log("AutoUpdater initialized");
  }

  setupCron() {
    // Check for updates every 10 minutes
    cron.schedule("*/10 * * * *", () => {
      this.checkForUpdates()
        .then((result) => {
          if (result.updateAvailable)
            this.mainWindow.webContents.send("update-available", result);
        })
        .catch((error) => {
          console.error("Cron job update check failed:", error);
        });
    });
  }

  setupIPC() {
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

      console.log("Version comparison:", {
        current: currentVersion,
        latest: latestVersion,
        updateAvailable: semver.gt(latestVersion, currentVersion),
      });

      const updateAvailable = semver.gt(latestVersion, currentVersion);
      const windowsAsset = response.data.assets.find((asset) =>
        asset.name.endsWith(".zip")
      );

      return {
        currentVersion: this.currentVersion,
        latestVersion,
        updateAvailable,
        downloadUrl: updateAvailable && windowsAsset ? windowsAsset.browser_download_url : null,
      };
    } catch (error) {
      console.error("Error checking for updates:", error);
      throw new Error("Failed to check for updates");
    }
  }

  async downloadUpdate() {
    try {
      const { downloadUrl } = await this.checkForUpdates();
      if (!downloadUrl) {
        throw new Error("No update available");
      }

      console.log("Downloading update from:", downloadUrl);

      const response = await axios({
        method: "get",
        url: downloadUrl,
        responseType: "arraybuffer",
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
      });

      const downloadPath = path.join(app.getPath("temp"), "update.zip");
      fs.writeFileSync(downloadPath, response.data);

      console.log("Update downloaded to:", downloadPath);

      return { success: true, downloadPath };
    } catch (error) {
      console.error("Error downloading update:", error);
      throw new Error("Failed to download update");
    }
  }

  async installUpdate() {
    try {
      const downloadPath = path.join(app.getPath('temp'), 'update.zip');
      const zip = new AdmZip(downloadPath);
      const appPath = path.dirname(app.getPath('exe'));

      // Extract update to temporary directory
      const tempExtractPath = path.join(app.getPath('temp'), 'update-extract');
      zip.extractAllTo(tempExtractPath, true);

      // Navigate to the correct directory structure
      const updateSource = path.join(tempExtractPath, 'MLR Tools-win32-x64');

      if (!fs.existsSync(updateSource)) {
        throw new Error('Update package structure is invalid');
      }

      // Copy new files to app directory
      this.copyRecursive(updateSource, appPath);

      // Clean up
      fs.rmSync(downloadPath);
      fs.rmSync(tempExtractPath, { recursive: true });

      return { success: true };
    } catch (error) {
      console.error('Error installing update:', error);
      throw new Error('Failed to install update');
    }
  }

  copyRecursive(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();

    if (isDirectory) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest);
      }
      fs.readdirSync(src).forEach((childItemName) => {
        this.copyRecursive(
          path.join(src, childItemName),
          path.join(dest, childItemName)
        );
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}
