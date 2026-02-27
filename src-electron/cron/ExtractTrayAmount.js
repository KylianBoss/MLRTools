import dayjs from "dayjs";
import { getDB } from "../database.js";
import fs, { readFileSync } from "fs";
import path from "path";
import puppeteer from "puppeteer";
import csv from "csv-parser";
import { updateJob } from "./utils.js";

const jobName = "extractTrayAmount";
const FILENAME = (date) => `Compteurs_${dayjs(date).format("YYYYMMDD")}.csv`;
const MAX_RETRY = 5;

export const extractTrayAmount = (date, headless = true, retryCount = 0) => {
  return new Promise(async (resolve, reject) => {
    const db = getDB();
    if (retryCount >= MAX_RETRY) {
      console.warn(
        `Maximum retry count reached (${MAX_RETRY}), aborting extraction for date ${date}`
      );
      global.sendNotificationToElectron(
        "Extract tray amount",
        `Maximum retry count reached (${MAX_RETRY}), aborting extraction for date ${date}`
      );
      await updateJob(
        {
          actualState: "error",
          lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          lastLog: `Maximum retry count reached (${MAX_RETRY}), aborting extraction for date ${date}`,
          endAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          cronExpression: "0 1 * * *",
          args: null,
        },
        jobName
      );
      return reject(
        new Error(
          `Maximum retry count reached (${MAX_RETRY}), aborting extraction for date ${date}`
        )
      );
    }

    try {
      await updateJob(
        {
          actualState: "running",
          lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          lastLog: `Starting extraction job`,
          startAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          endAt: null,
        },
        jobName
      );
      const zones = await db.models.ZoneReadPoints.findAll({
        raw: true,
      });

      const dateStart = dayjs(date).startOf("day");
      const dateEnd = dayjs(date).endOf("day");

      global.sendNotificationToElectron(
        "Extract tray amount",
        "Starting extraction..."
      );
      await updateJob(
        {
          actualState: "running",
          lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          lastLog: `Starting extraction for date ${date}`,
        },
        jobName
      );

      // Setup the storage
      if (fs.existsSync(path.join(process.cwd(), "storage", "downloads")))
        fs.rmdirSync(path.join(process.cwd(), "storage", "downloads"), {
          recursive: true,
        });
      fs.mkdirSync(path.join(process.cwd(), "storage", "downloads"), {
        recursive: true,
      });
      if (!fs.existsSync(path.join(process.cwd(), "storage", "achrives")))
        fs.mkdirSync(path.join(process.cwd(), "storage", "archives"), {
          recursive: true,
        });

      // Setup puppeteer
      const browser = await puppeteer.launch({
        headless: headless,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--ignore-certificate-errors",
          "--ignore-certificate-errors-spki-list",
          "--ignore-ssl-errors",
          "--allow-running-insecure-content",
          "--disable-web-security",
          "--ignore-ssl-errors-spki-list",
        ],
      });

      const page = await browser.newPage();

      const client = await page.createCDPSession();
      await client.send("Page.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: path.join(process.cwd(), "storage", "downloads"),
      });

      // Navigate to the page
      await page.goto("https://10.95.62.134:8443/infosystem/login.jspa");
      await page.type('input[name="j_username"]', "kylian");
      await page.type('input[name="j_password"]', "1024");

      await Promise.all([
        page.waitForNavigation(),
        page.click('input[name="Login"]'),
      ]);
      console.log("Logged in successfully");
      global.sendNotificationToElectron(
        "Extract tray amount",
        "Logged in successfully"
      );
      await updateJob(
        {
          actualState: "running",
          lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          lastLog: `Logged in successfully`,
        },
        jobName
      );
      await sleep(2000);

      console.log("Navigating to report page...");
      await updateJob(
        {
          actualState: "running",
          lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          lastLog: `Navigating to report page...`,
        },
        jobName
      );
      await page.goto(
        "https://10.95.62.134:8443/infosystem/protected/report.jspa?categorizeable=report.1746609396042&pageFlowSequence=54&category=category.myReports&reload=false&view=",
        {
          waitUntil: "networkidle0",
          timeout: 180000,
        }
      );

      await sleep(2000);

      // Get the CSV from the report
      const startDateInput = await page.$('input[id="inputTimestampPicker_1"]');
      const endDateInput = await page.$('input[id="inputTimestampPicker_2"]');
      if (!startDateInput || !endDateInput) {
        await updateJob(
          {
            lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            lastLog: `An error has occured, one of the input field was not found on the page`,
            endAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            actualState: "error",
          },
          jobName
        );
        throw new Error("One or more input fields not found on the page");
      }

      await clearInput(startDateInput, page);
      await startDateInput.type(dateStart.format("DD.MM.YYYY HH:mm:ss"));
      await clearInput(endDateInput, page);
      await endDateInput.type(dateEnd.format("DD.MM.YYYY HH:mm:ss"));

      console.log("Loading the report...");
      await updateJob(
        {
          actualState: "running",
          lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          lastLog: `Loading the report...`,
        },
        jobName
      );

      await Promise.all([
        page.waitForNavigation({
          waitUntil: "networkidle0",
          timeout: 2 * 60 * 1000,
        }),
        page.click('input[name="Search"]'),
      ]);

      console.log("Report loaded!");
      await updateJob(
        {
          actualState: "running",
          lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          lastLog: `Report loaded!`,
        },
        jobName
      );

      await page.waitForSelector('a[href*=".csv"]', { timeout: 120000 });
      const pageContent = await page.content();
      if (pageContent.includes("Aucun jeu de données")) {
        await updateJob(
          {
            lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            lastLog: `No data to extract for date ${date}`,
            endAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            actualState: "idle",
            args: null,
            cronExpression: "0 1 * * * ",
          },
          jobName
        );
        console.log(`No data to extract for date ${date}`);
        global.sendNotificationToElectron(
          "Extract tray amount",
          `No data to extract for date ${date}`
        );
        await browser.close();
        return;
      }

      function download() {
        return new Promise(async (resolve, reject) => {
          const downloadLink = await page.$('a[href*=".csv"]');
          if (downloadLink) {
            await downloadLink.click();
            console.log("Start downloading CSV file...");
            await updateJob(
              {
                actualState: "running",
                lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                lastLog: `Start downloading CSV file...`,
              },
              jobName
            );
          } else {
            console.warn(`No download link found!`);
            resolve();
          }

          let safe = 0;
          do {
            console.log("Downloading...");
            await sleep(3000);
            safe++;
            if (safe > 20) {
              console.warn(`Download took too long...`);
              await updateJob(
                {
                  actualState: "error",
                  lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                  lastLog: `Download took too long...`,
                },
                jobName
              );
              return reject(new Error("Download took too long"));
            }
          } while (
            !fs.existsSync(
              path.join(
                process.cwd(),
                "storage",
                "downloads",
                "Compteurs scanners.csv"
              )
            )
          );
          console.log("CSV file downloaded successfully");
          await updateJob(
            {
              actualState: "running",
              lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
              lastLog: `CSV file downloaded successfully!`,
            },
            jobName
          );

          fs.renameSync(
            path.join(
              process.cwd(),
              "storage",
              "downloads",
              "Compteurs scanners.csv"
            ),
            path.join(process.cwd(), "storage", "downloads", FILENAME(date))
          );
          return resolve();
        });
      }

      let downloaded = false;
      while (!downloaded) {
        await download()
          .then(() => (downloaded = true))
          .catch(() => (downloaded = false));
      }

      console.log("CSV file downloaded, starting processing...");
      global.sendNotificationToElectron(
        "Extract tray amount",
        "CSV file downloaded, starting processing..."
      );
      await updateJob(
        {
          actualState: "running",
          lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          lastLog: `CSV file downloaded, starting processing...`,
        },
        jobName
      );
      await browser.close();

      if (
        !fs.existsSync(
          path.join(process.cwd(), "storage", "downloads", FILENAME(date))
        )
      ) {
        throw new Error("Downloaded CSV file not found");
      }

      // The file look like this:
      // "LABEL";"VALUE"
      // "X001";"1234"
      // ...

      const file = fs.readFileSync(
        path.join(process.cwd(), "storage", "downloads", FILENAME(date)),
        "utf8"
      );
      const data = file
        .split("\n")
        .slice(1)
        .map((line) => {
          const [label, value] = line.replace(/"/g, "").split(";");
          return { LABEL: label, VALUE: parseInt(value) };
        });

      console.log("CSV file processed successfully");
      await updateJob(
        {
          actualState: "running",
          lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          lastLog: `CSV file processed successfully!`,
        },
        jobName
      );

      // Process data
      for (const zone of zones) {
        zone.total = 0;

        const zoneData = data.filter((d) => zone.readPoints.includes(d.LABEL));
        zone.total = zoneData.reduce((sum, record) => sum + record.VALUE, 0);
      }

      console.log("Extraction completed successfully");
      global.sendNotificationToElectron(
        "Extract tray amount",
        "Extraction completed successfully"
      );
      await updateJob(
        {
          actualState: "running",
          lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          lastLog: `Extraction completed successfully`,
        },
        jobName
      );

      sleep(2000);

      console.log("Saving data...");
      await updateJob(
        {
          actualState: "running",
          lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          lastLog: `Saving data...`,
        },
        jobName
      );

      // Save data in DB
      for (const zone of zones) {
        await db.models.ZoneData.upsert({
          zoneName: zone.zone,
          date: dayjs(date).format("YYYY-MM-DD"),
          total: zone.total,
        });
      }
      // Save data in archives
      fs.writeFileSync(
        path.join(
          process.cwd(),
          "storage",
          "archives",
          `${dayjs(date).format("YYYY_MM_DD")}_extract_result.json`
        ),
        JSON.stringify(zones, null, 2)
      );

      console.log("Data saved successfully");
      await updateJob(
        {
          actualState: "running",
          lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          lastLog: `Data saved successfully`,
        },
        jobName
      );

      // Remove data in cache to recalculate them
      await db.models.cache_DowntimeMinutesByThousand.destroy({
        where: {
          date: dayjs(date).format("YYYY-MM-DD"),
        }
      });
      await db.models.cache_ErrorsByThousand.destroy({
        where: {
          date: dayjs(date).format("YYYY-MM-DD"),
        }
      });

      sleep(2000);

      console.log("Checking for missing days...");
      await updateJob(
        {
          actualState: "running",
          lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          lastLog: `Checking for missing days...`,
        },
        jobName
      );

      // Check if all last days since the last extract have been extracted
      const lastExtract = await db.models.ZoneData.findAll({
        attributes: ["date"],
        order: [["date", "DESC"]],
        limit: 1,
        raw: true,
      });
      const daysDiff = dayjs().diff(dayjs(lastExtract[0].date), "day");
      if (daysDiff > 1) {
        console.log(
          `There are ${
            daysDiff - 1
          } days since the last extraction, starting extraction for missing days...`
        );

        // Créer un job dans la queue pour le jour manquant le plus ancien
        const dayToExtract = dayjs(lastExtract[0].date).add(1, "day");
        console.log(
          `Queuing extraction for date ${dayToExtract.format("YYYY-MM-DD")}`
        );

        // Trouver l'utilisateur bot
        const bot = await db.models.Users.findOne({
          where: { isBot: true },
        });

        await db.models.JobQueue.create({
          jobName: `Extract Tray Amount - ${dayToExtract.format("DD/MM/YYYY")}`,
          action: "extractTrayAmount",
          args: {
            date: dayToExtract.format("YYYY-MM-DD"),
            headless: true,
            retryCount: 0,
          },
          requestedBy: bot ? bot.id : null,
        });

        await updateJob(
          {
            actualState: "idle",
            lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            lastLog: `Queued extraction for date ${dayToExtract.format(
              "YYYY-MM-DD"
            )}`,
            endAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          },
          jobName
        );

        // send notification to admins
        const admins = await db.models.Users.findAll({
          where: { isAdmin: true },
        });

        for (const admin of admins) {
          await db.models.Notifications.create({
            userId: admin.id,
            message: `Tray amount extraction for ${dayToExtract.format(
              "DD.MM.YYYY"
            )} has been queued.`,
            type: "info",
          });
        }
      } else {
        await updateJob(
          {
            actualState: "idle",
            lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            lastLog: `Tray amount extration finished, no missing days found.`,
            endAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          },
          jobName
        );
        console.log("No missing days found.");
      }

      // Send notification to admins
      const admins = await db.models.Users.findAll({
        where: { isAdmin: true },
      });

      for (const admin of admins) {
        await db.models.Notifications.create({
          userId: admin.id,
          message: `Tray amount extraction for ${dayjs(date).format(
            "DD.MM.YYYY"
          )} has been completed.`,
          type: "success",
        });
      }

      resolve(zones);
    } catch (error) {
      console.error("Error extracting tray amount:", error);
      global.sendNotificationToElectron(
        "Extract tray amount",
        `Error extracting tray amount: ${error.message}`
      );
      await updateJob(
        {
          actualState: "error",
          lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          lastLog: `Error extracting tray amount: ${error.message}`,
          endAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        },
        jobName
      );
      // Send notification to admins
      const admins = await db.models.Users.findAll({
        where: { isAdmin: true },
      });

      for (const admin of admins) {
        await db.models.Notifications.create({
          userId: admin.id,
          message: `Tray amount extraction failed for date ${date}: ${
            error.message
          } (Retry ${retryCount + 1}/${MAX_RETRY})`,
          type: "error",
        });
      }

      // Ajout d'une tâche dans la JobQueue pour retenter l'extraction 10 minutes après, max 5 fois
      if (retryCount + 1 < MAX_RETRY) {
        // Trouver l'utilisateur bot
        const bot = await db.models.Users.findOne({ where: { isBot: true } });
        await db.models.JobQueue.create({
          jobName: `Extract Tray Amount Retry - ${dayjs(date).format(
            "DD/MM/YYYY"
          )}`,
          action: "extractTrayAmount",
          args: {
            date: dayjs(date).format("YYYY-MM-DD"),
            headless: true,
            retryCount: retryCount + 1,
          },
          requestedBy: bot ? bot.id : null,
          scheduledAt: dayjs().add(10, "minute").toDate(),
        });
        console.log(
          `Retry extraction scheduled in 10 minutes (attempt ${
            retryCount + 1
          }/${MAX_RETRY})`
        );
      }

      reject(error);
    }
  });
};

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const clearInput = (input, page) => {
  return new Promise(async (resolve) => {
    await input.focus();
    await page.keyboard.down("Control");
    await page.keyboard.press("A");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    resolve();
  });
};
