import dayjs from "dayjs";
import { db } from "../database.js";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import csv from "csv-parser";
import { updateJob } from "./utils.js";

const jobName = "extractTrayAmount";

export const extractTrayAmount = (date, headless = true) => {
  return new Promise(async (resolve, reject) => {
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

      const splits = [
        {
          start: `${date} 00:00:00`,
          end: `${date} 02:00:00`,
        },
        {
          start: `${date} 02:00:00`,
          end: `${date} 04:00:00`,
        },
        {
          start: `${date} 04:00:00`,
          end: `${date} 06:00:00`,
        },
        {
          start: `${date} 06:00:00`,
          end: `${date} 08:00:00`,
        },
        {
          start: `${date} 08:00:00`,
          end: `${date} 10:00:00`,
        },
        {
          start: `${date} 10:00:00`,
          end: `${date} 12:00:00`,
        },
        {
          start: `${date} 12:00:00`,
          end: `${date} 14:00:00`,
        },
        {
          start: `${date} 14:00:00`,
          end: `${date} 16:00:00`,
        },
        {
          start: `${date} 16:00:00`,
          end: `${date} 18:00:00`,
        },
        {
          start: `${date} 18:00:00`,
          end: `${date} 20:00:00`,
        },
        {
          start: `${date} 20:00:00`,
          end: `${date} 22:00:00`,
        },
        {
          start: `${date} 22:00:00`,
          end: `${dayjs(date).add(1, "day").format("YYYY-MM-DD")} 00:00:00`,
        },
      ];

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

      await page.goto(
        "https://10.95.62.134:8443/infosystem/protected/report.jspa?method=GET&categorizeable=report.1676549483645&view=&mode=edit",
        {
          waitUntil: "networkidle0",
          timeout: 120000,
        }
      );

      await sleep(2000);

      for (const zone of zones) {
        for (const readPoint of zone.readPoints) {
          let i = 1;
          for (const split of splits) {
            await updateJob(
              {
                actualState: "running",
                lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                lastLog: `Processing : ${zone.zone} - ${readPoint} - Split: ${i}`,
              },
              jobName
            );
            const startDateInput = await page.$(
              'input[id="inputTimestampPicker_1"]'
            );
            const endDateInput = await page.$(
              'input[id="inputTimestampPicker_2"]'
            );
            const addressInput = await page.$('input[id="input_2"]');
            const messageTypeInput = await page.$('input[id="input_5"]');
            if (
              !startDateInput ||
              !endDateInput ||
              !addressInput ||
              !messageTypeInput
            ) {
              await updateJob(
              {
                actualState: "running",
                lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                lastLog: `An error has occured, one of the input field was not found on the page`,
                endAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                actualState: 'error'
              },
              jobName
            );
              throw new Error("One or more input fields not found on the page");
            }

            await updateJob(
              {
                actualState: "running",
                lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                lastLog: `Filling start date : ${dayjs(split.start).format("DD.MM.YYYY HH:mm:ss")}`,
              },
              jobName
            );
            await clearInput(startDateInput, page);
            await startDateInput.type(
              dayjs(split.start).format("DD.MM.YYYY HH:mm:ss")
            );
            await updateJob(
              {
                actualState: "running",
                lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                lastLog: `Filling end date : ${dayjs(split.end).format("DD.MM.YYYY HH:mm:ss")}`,
              },
              jobName
            );
            await clearInput(endDateInput, page);
            await endDateInput.type(
              dayjs(split.end).format("DD.MM.YYYY HH:mm:ss")
            );
            await updateJob(
              {
                actualState: "running",
                lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                lastLog: `Filling address : ${readPoint}`,
              },
              jobName
            );
            await clearInput(addressInput, page);
            await addressInput.type(readPoint);
            await updateJob(
              {
                actualState: "running",
                lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                lastLog: `Filling message type : ${zone.messageType}`,
              },
              jobName
            );
            await clearInput(messageTypeInput, page);
            await messageTypeInput.type(zone.messageType);

            console.log("Filling form...");
            await updateJob(
              {
                actualState: "running",
                lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                lastLog: `Sending form for : ${zone.zone} - ${readPoint} - Split: ${i}`,
              },
              jobName
            );
            await Promise.all([
              page.waitForNavigation({
                waitUntil: "networkidle0",
                timeout: 120000,
              }),
              page.click('input[name="Search"]'),
            ]);

            await updateJob(
              {
                actualState: "running",
                lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                lastLog: `Form loaded for : ${zone.zone} - ${readPoint} - Split: ${i}`,
              },
              jobName
            );

            await page.waitForSelector('a[href*=".csv"]', {
              timeout: 120000,
            });

            const pageContent = await page.content();
            if (pageContent.includes("Aucun jeu de données")) {
              await updateJob(
              {
                actualState: "running",
                lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                lastLog: `Nothing to import from : ${zone.zone} - ${readPoint} - Split: ${i}`,
              },
              jobName
            );
              i++;
              continue;
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
                      lastLog: `Start downloading CSV file for address ${readPoint} in group ${zone.zone} for split ${i}`,
                    },
                    jobName
                  );
                } else {
                  console.warn(
                    `No download link found for address ${readPoint} in group ${zone.zone} for split ${i}`
                  );
                  resolve();
                }

                let safe = 0;
                do {
                  console.log("Downloading...");
                  await sleep(3000);
                  safe++;
                  if (safe > 20) {
                    console.warn(
                      `Download took too long for address ${readPoint} in group ${zone.zone} for split ${i}`
                    );
                    return reject();
                  }
                } while (
                  !fs.existsSync(
                    path.join(
                      process.cwd(),
                      "storage",
                      "downloads",
                      "PLC Interface.csv"
                    )
                  )
                );
                console.log("CSV file downloaded successfully");
                await updateJob(
                  {
                    actualState: "running",
                    lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                    lastLog: `CSV file downloaded successfully for address ${readPoint} in group ${zone.zone} for split ${i}`,
                  },
                  jobName
                );

                fs.renameSync(
                  path.join(
                    process.cwd(),
                    "storage",
                    "downloads",
                    "PLC Interface.csv"
                  ),
                  path.join(
                    process.cwd(),
                    "storage",
                    "downloads",
                    `${readPoint}_${i}.csv`
                  )
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
            i++;
          }
        }
      }

      console.log(
        "All readPoints downloaded successfully, starting extraction..."
      );
      global.sendNotificationToElectron(
        "Extract tray amount",
        "All readPoints downloaded successfully, starting extraction..."
      );
      await updateJob(
        {
          actualState: "running",
          lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          lastLog: `All readPoints downloaded successfully, starting extraction...`,
        },
        jobName
      );
      await browser.close();

      for (const zone of zones) {
        console.log(`Extracting data for group: ${zone.zone}`);
        let zoneData = [];
        for (const readPoint of zone.readPoints) {
          console.log(`Processing address: ${readPoint}`);
          let i = 1;
          let splitGroup = [];
          for (const split_ of splits) {
            console.log(
              `Processing split ${i} for address ${readPoint} in group ${zone.zone}`
            );
            await updateJob(
              {
                actualState: "running",
                lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                lastLog: `Processing split ${i} for address ${readPoint} in group ${zone.zone}`,
              },
              jobName
            );
            let results = [];
            if (
              !fs.existsSync(
                path.join(
                  process.cwd(),
                  "storage",
                  "downloads",
                  `${readPoint}_${i}.csv`
                )
              )
            ) {
              i++;
              console.warn(
                `File not found for address ${readPoint} in group ${zone.zone} for split ${i}`
              );
              continue;
            }
            await new Promise((resolve, reject) => {
              fs.createReadStream(
                path.join(
                  process.cwd(),
                  "storage",
                  "downloads",
                  `${readPoint}_${i}.csv`
                ),
                "utf8"
              )
                .pipe(csv({ separator: ";" }))
                .on("data", (data) => results.push(data))
                .on("end", async () => {
                  results = results.map((d) => {
                    const dateRegex =
                      /(\d{2}\.\d{2}\.\d{4}) (\d{2}:\d{2}:\d{2}),/;
                    const match = d.EVENT_TIME.match(dateRegex);
                    let dateTime = "";
                    if (!match) {
                      console.warn(
                        `Invalid date format for address ${readPoint} in group ${zone.zone} for split ${i}`
                      );
                      dateTime = dayjs(split_.start).format(
                        "YYYY-MM-DD HH:mm:ss"
                      );
                    } else {
                      dateTime = dayjs(
                        `${match[1]} ${match[2]}`,
                        "DD.MM.YYYY HH:mm:ss"
                      ).format("YYYY-MM-DD HH:mm:ss");
                    }
                    return {
                      timestamp: dateTime,
                      trayId: d.loadCarrierIdentifier,
                      address: d.addressidentifier,
                    };
                  });
                  console.log(
                    `Extracted ${results.length} records for address ${readPoint} in group ${zone.zone} for split ${i}`
                  );
                  await updateJob(
                    {
                      actualState: "running",
                      lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                      lastLog: `Extracted ${results.length} records for address ${readPoint} in group ${zone.zone} for split ${i}`,
                    },
                    jobName
                  );
                  splitGroup = [...splitGroup, ...results];
                  resolve();
                });
            });
            i++;
          }
          zoneData = [...zoneData, ...splitGroup];
        }
        console.log(
          `Total records extracted for group ${zone.zone}: ${zoneData.length}`
        );
        fs.writeFileSync(
          path.join(
            process.cwd(),
            "storage",
            "archives",
            `${dayjs(date).format("YYYY_MM_DD")}_${zone.zone}.json`
          ),
          JSON.stringify(zoneData, null, 2)
        );
        zone.total = zoneData.length;
      }
      console.log("Extraction completed successfully");
      global.sendNotificationToElectron(
        "Extract tray amount",
        "Extraction completed successfully"
      );
      await updateJob(
        {
          actualState: "idle",
          lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          lastLog: `Extraction completed successfully`,
          endAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          args: null,
          cronExpression: "0 1 * * * ",
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

      // Check if all last days since the last extract have been extracted
      const lastExtract = await db.models.ZoneData.findOne({
        order: [["date", "DESC"]],
      });
      const daysDiff = dayjs().diff(dayjs(lastExtract.date), "day");
      if (daysDiff > 1) {
        console.log(
          `There are ${
            daysDiff - 1
          } days since the last extraction, starting extraction for missing days...`
        );

        // Start the extraction for missing days, start with the oldest day and set the bot for only one extraction at a time
        const dayToExtract = dayjs(lastExtract.date).add(1, "day");
        console.log(
          `Setting extraction for date ${dayToExtract.format("YYYY-MM-DD")}`
        );
        await updateJob(
          {
            actualState: "idle",
            lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            lastLog: `Extraction completed successfully. Setting extraction for date ${dayToExtract.format(
              "YYYY-MM-DD"
            )}`,
            endAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            args: `date:${dayToExtract.format("YYYY-MM-DD")}`,
            cronExpression: dayjs().add(5, "minute").format("m H * * *"),
          },
          jobName
        );
      }

      // Set the bot to restart
      const bot = await db.models.Users.findOne({
        where: { isBot: true },
      });
      if (bot) {
        bot.update({ needsRestart: true });
      }

      resolve(zones);
    } catch (error) {
      console.error("Error extracting tray amount:", error);
      global.sendNotificationToElectron(
        "Extract tray amount",
        `Error extracting tray amount: ${error.message}`
      );
      await updateJob({
        actualState: "error",
        lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        lastLog: `Error extracting tray amount: ${error.message}`,
      }),
        jobName;
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
