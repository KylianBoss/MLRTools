import dayjs from "dayjs";
import { db } from "../database.js";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import csv from "csv-parser";

const jobName = "extractTrayAmount";
function updateJob(data = {}) {
  return new Promise((resolve, reject) => {
    db.models.CronJobs.findOne({
      where: {
        action: jobName,
      },
    })
      .then((job) => {
        if (job) {
          job.update({ ...data }).then(() => {
            resolve(job);
          });
        } else {
          db.models.CronJobs.create({
            action: jobName,
            ...data,
          }).then((job) => {
            resolve(job);
          });
        }
      })
      .catch((error) => {
        console.error("Error updating job:", error);
        reject(error);
      });
  });
}

export const extractTrayAmount = (date) => {
  return new Promise(async (resolve, reject) => {
    try {
      await updateJob({
        actualState: "running",
        lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        lastLog: `Starting extraction job`,
      });
      const groups = await db.models.ZoneGroups.findAll({
        raw: true,
      });
      for (const group of groups) {
        group.addresses = [];
        group.total = 0;
        for (const zone of group.zones) {
          const readPoints = await db.models.ZoneReadPoints.findByPk(zone, {
            raw: true,
          });
          if (!readPoints) {
            console.warn(
              `No readPoints found for zone ${zone} in group ${group.name}`
            );
            continue;
          }
          group.addresses = [...group.addresses, ...readPoints.readPoints];
        }
      }
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
      await updateJob({
        actualState: "running",
        lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        lastLog: `Starting extraction for date ${date}`,
      });

      // Setup the storage
      if (!fs.existsSync(path.join(process.cwd(), "storage", "downloads")))
        fs.mkdirSync(path.join(process.cwd(), "storage", "downloads"), {
          recursive: true,
        });
      if (!fs.existsSync(path.join(process.cwd(), "storage", "achrives")))
        fs.mkdirSync(path.join(process.cwd(), "storage", "archives"), {
          recursive: true,
        });

      // Setup puppeteer
      const browser = await puppeteer.launch({
        headless: true,
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
      await updateJob({
        actualState: "running",
        lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        lastLog: `Logged in successfully`,
      });
      await sleep(2000);

      await page.goto(
        "https://10.95.62.134:8443/infosysgtem/protected/report.jspa?method=GET&categorizeable=report.1676549483645&view=&mode=edit",
        {
          waitUntil: "networkidle0",
          timeout: 60000,
        }
      );

      const startDateInput = await page.$('input[id="inputTimestampPicker_1"]');
      const endDateInput = await page.$('input[id="inputTimestampPicker_2"]');
      const addressInput = await page.$('input[id="input_2"]');
      const messageTypeInput = await page.$('input[id="input_5"]');

      for (const group of groups) {
        console.log(`Processing group: ${group.name}`);
        global.sendNotificationToElectron(
          "Extract tray amount",
          `Processing group: ${group.name}`
        );
        await updateJob({
          actualState: "running",
          lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          lastLog: `Processing group: ${group.name}`,
        });
        for (const address of group.addresses) {
          let i = 1;
          for (const split of splits) {
            await clearInput(startDateInput, page);
            await startDateInput.type(
              dayjs(split.start).format("DD.MM.YYYY HH:mm:ss")
            );
            await clearInput(endDateInput, page);
            await endDateInput.type(
              dayjs(split.end).format("DD.MM.YYYY HH:mm:ss")
            );
            await clearInput(addressInput, page);
            await addressInput.type(address);
            await clearInput(messageTypeInput, page);
            await messageTypeInput.type(group.messageType);

            console.log("Filling form...");
            await Promise.all([
              page.waitForNavigation({
                waitUntil: "networkidle0",
                timeout: 60000,
              }),
              page.click('input[name="Search"]'),
            ]);

            await page.waitForSelector('a[href*=".csv"]', {
              timeout: 30000,
            });

            const pageContent = await page.content();
            if (pageContent.includes("Aucun jeu de données")) {
              console.warn(
                `No data found for address ${address} in group ${group.name} for split ${i}`
              );
              i++;
              continue;
            }

            function download() {
              return new Promise(async (resolve, reject) => {
                const downloadLink = page.$('a[href*=".csv"]');
                if (downloadLink) {
                  await downloadLink.click();
                  console.log("Start downloading CSV file...");
                } else {
                  console.warn(
                    `No download link found for address ${address} in group ${group.name} for split ${i}`
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
                      `Download took too long for address ${address} in group ${group.name} for split ${i}`
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
                    `${address}_${i}.csv`
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

      console.log("All groups downloaded successfully, starting extraction...");
      global.sendNotificationToElectron(
        "Extract tray amount",
        "All groups downloaded successfully, starting extraction..."
      );
      await updateJob({
        actualState: "running",
        lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        lastLog: `All groups downloaded successfully, starting extraction...`,
      });
      await browser.close();

      for (const group of groups) {
        let groupData = [];
        for (const address of group.addresses) {
          let i = 1;
          let splitGroup = [];
          for (const split of splits) {
            let results = [];
            if (
              !fs.existsSync(
                path.join(
                  process.cwd(),
                  "storage",
                  "downloads",
                  `${address}_${split.start}.csv`
                )
              )
            )
              continue;
            await new Promise((resolve, reject) => {
              fs.createReadStream(
                path.join(
                  process.cwd(),
                  "storage",
                  "downloads",
                  `${address}_${split.start}.csv`
                ),
                "utf8"
              )
                .pipe(csv({ separator: ";" }))
                .on("data", (data) => results.push(data))
                .on("end", () => {
                  results = results.map((d) => {
                    const date = dayjs.EVENT_TIME.split(" ")[0]
                      .split(".")
                      .reverse()
                      .join("-");
                    const time = dayjs.EVENT_TIME.split(" ")[1].split(",")[0];
                    const dateTime = dayjs(`${date} ${time}`).format(
                      "YYYY-MM-DD HH:mm:ss"
                    );
                    return {
                      timestamp: dateTime,
                      trayId: d.loadCarrierIdentifier,
                      address: d.addressidentifier,
                    };
                  });
                  splitGroup = [...splitGroup, ...results];
                  resolve();
                });
            });
            i++;
          }
          groupData = [...groupData, ...splitGroup];
        }
        fs.writeFileSync(
          path.join(
            process.cwd(),
            "storage",
            "archives",
            `${dayjs(date).format("YYYY_MM_DD")}_${group.name}.json`
          ),
          JSON.stringify(groupData, null, 2)
        );
        group.total = groupData.length;
      }
      console.log("Extraction completed successfully");
      global.sendNotificationToElectron(
        "Extract tray amount",
        "Extraction completed successfully"
      );
      await updateJob({
        actualState: "idle",
        lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        lastLog: `Extraction completed successfully`,
      });
      fs.rmdirSync(path.join(process.cwd(), "storage", "downloads"), {
        recursive: true,
      });

      // Save data in DB
      for (const group of groups) {
        await db.models.ZoneGroupData.create({
          zoneGrounName: group.name,
          date: dayjs(date).format("YYYY-MM-DD"),
          total: group.total,
        });
      }
      resolve(groups);
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
      });
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
