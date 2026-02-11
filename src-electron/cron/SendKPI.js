import { updateJob } from "./utils.js";
import { getDB } from "../database.js";
import dayjs from "dayjs";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import puppeteer from "puppeteer";
import { app } from "electron";

const jobName = "sendKPI";
const CONFIG_PATH = path.join(process.cwd(), "storage", "mlrtools-config.json");

// Utilisation de puppeteer pour générer les graphiques (plus stable que canvas dans Electron)
let browserInstance = null;

/**
 * Ferme le navigateur puppeteer proprement
 */
export async function closePuppeteerBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    console.log("Puppeteer browser closed");
  }
}

export const sendKPI = async (options = {}) => {
  const db = getDB();
  console.log("Starting SendKPI job...");
  const sendEmail = options.sendEmail !== false; // Par défaut true pour compatibilité

  updateJob(
    {
      lastRun: new Date(),
      actualState: "running",
      lastLog: "Starting SendKPI job...",
      startAt: new Date(),
      endAt: null,
    },
    jobName
  );

  try {
    // Génération du PDF KPI
    await updateJob(
      {
        lastLog: "Generating KPI PDF report...",
      },
      jobName
    );

    console.log("Generating KPI PDF report...");
    const pdfPath = await generateKPIPDF();

    await updateJob(
      {
        lastLog: `PDF generated: ${pdfPath}`,
      },
      jobName
    );

    console.log(`PDF generated: ${pdfPath}`);

    // Envoi du PDF par mail ou simple génération pour téléchargement
    if (sendEmail) {
      await updateJob(
        {
          lastLog: "Sending PDF by email...",
        },
        jobName
      );

      console.log("Sending PDF by email...");
      await sendPDFByEmail(pdfPath);

      await updateJob(
        {
          lastLog: "PDF sent by email successfully.",
        },
        jobName
      );

      console.log("PDF sent by email successfully.");

      // Fermer le navigateur puppeteer après envoi
      await closePuppeteerBrowser();
    } else {
      await updateJob(
        {
          lastLog: "PDF ready for download.",
        },
        jobName
      );

      console.log("PDF ready for download.");
      // Le navigateur sera fermé après le téléchargement si c'est via l'API
    }

    console.log("SendKPI job completed.");
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: "SendKPI job completed.",
        endAt: new Date(),
        actualState: "idle",
      },
      jobName
    );

    const admins = await db.models.Users.findAll({
      where: { isAdmin: true },
    });

    for (const admin of admins) {
      await db.models.Notifications.create({
        userId: admin.id,
        message: sendEmail
          ? "KPI data has been sent by mail."
          : "KPI report is ready for download.",
        type: "info",
      });
    }

    // Retourner le chemin du PDF pour permettre le téléchargement
    return { pdfPath, success: true };
  } catch (error) {
    console.error("Error during SendKPI job:", error);
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: `Error during SendKPI job: ${error.message}`,
        endAt: new Date(),
        actualState: "error",
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
        message: `SendKPI job failed: ${error.message}`,
        type: "error",
      });
    }

    throw error; // Permet au système de retry automatique de fonctionner
  }
};

/**
 * Génère le PDF KPI avec tous les graphiques
 * @returns {Promise<string>} Chemin du fichier PDF généré
 */
export async function generateKPIPDF() {
  const db = getDB();
  const groups = await db.models.ZoneGroups.findAll({
    where: {
      display: true,
    },
    order: [["order", "ASC"]],
  });

  const customCharts = await db.models.CustomChart.findAll();

  // Créer le dossier de destination s'il n'existe pas
  const outputDir = path.join(process.cwd(), "storage", "prints");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileName = `KPI_Report_${dayjs()
    .subtract(1, "day")
    .format("YYYY-MM-DD")}.pdf`;
  const filePath = path.join(outputDir, fileName);

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margin: 30,
        autoFirstPage: false,
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Title page
      doc.addPage();
      doc.moveDown();
      doc
        .fontSize(40)
        .text(`KPI REPORT ${dayjs().subtract(1, "day").format("DD.MM.YYYY")}`, {
          align: "center",
          valign: "center",
        });
      doc.moveDown();

      doc.image(
        `data:image/jpeg;base64,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`,
        doc.page.width / 2 - 200,
        doc.y,
        { width: 400 }
      );

      const pageWidth = doc.page.width - 60;

      // START GROUP CHART
      // Générer les graphiques pour chaque groupe
      for (const group of groups) {
        console.log(`Generating chart for group: ${group.zoneGroupName}`);

        await updateJob(
          {
            lastLog: `Generating chart for group: ${group.zoneGroupName}`,
          },
          jobName
        );

        // Récupérer les données du graphique
        const response = await fetch(
          `http://localhost:${
            process.env.PORT || 3000
          }/kpi/charts/alarms-by-group/${group.zoneGroupName}`
        );
        const data = await response.json();

        doc.addPage();
        const imageBuffer = await generateImage(data);
        const { tableRows, tableColumns } = formatDataForTable(data);

        // Titre de la page
        doc.fontSize(18).fillColor("#000").text(`${group.zoneGroupName}`);
        const zones = await db.models.Zones.findAll();
        const zoneDescriptions = group.zones
          .map((z) => zones.find((z1) => z1.zone === z)?.zoneDescription)
          .join(", ");
        doc.fontSize(10).text(zoneDescriptions);

        // Graphique 1
        if (imageBuffer !== null) {
          doc.image(imageBuffer, 30, 90, {
            width: pageWidth,
            height: 200,
          });
        }

        // Tableau de données
        if (tableRows.length > 0) {
          generateTable(doc, tableRows, tableColumns, 30, 300, pageWidth);
        }

        console.log(`Chart for group: ${group.zoneGroupName} added to PDF.`);
      }
      // END GROUP CHART

      // START CUSTOM CHART
      // Custom charts
      for (const customChart of customCharts) {
        console.log(`Generating custom chart: ${customChart.chartName}`);

        await updateJob(
          {
            lastLog: `Generating custom chart: ${customChart.chartName}`,
          },
          jobName
        );

        const response = await fetch(
          `http://localhost:${process.env.PORT || 3000}/kpi/charts/custom/${
            customChart.id
          }`
        );
        const customData = await response.json();

        // Récupérer les détails des alarmes depuis la base de données
        const alarmIds = JSON.parse(customChart.alarms) || [];
        const alarmList = await db.models.Alarms.findAll({
          where: {
            alarmId: alarmIds,
          },
          attributes: ["alarmId", "dataSource", "alarmArea", "alarmText"],
          raw: true,
        });

        customData.alarmList = alarmList;

        doc.addPage();
        const imageBuffer = await generateCustomChartImage(customData);
        const { tableRows, tableColumns } = formatDataForCustomChart(
          customData,
          customChart
        );

        // Titre de la page
        doc.fontSize(18).fillColor("#000").text(`${customChart.chartName}`);

        // Graphique
        if (imageBuffer !== null) {
          doc.image(imageBuffer, 30, 90, {
            width: pageWidth,
            height: 200,
          });
        }

        // Tableau de données
        if (tableRows.length > 0) {
          generateTable(doc, tableRows, tableColumns, 30, 300, pageWidth);
        }

        console.log(`Custom chart: ${customChart.chartName} added to PDF.`);
      }
      // END CUSTOM CHART

      // START PLANNED INTERVENTIONS
      console.log("Generating planned interventions summary...");
      await updateJob(
        {
          lastLog: "Generating planned interventions summary...",
        },
        jobName
      );

      // Récupérer toutes les alarmes planifiées avec commentaire
      const yesterday = dayjs().subtract(1, "day");
      const startOfDay = yesterday.startOf("day").format("YYYY-MM-DD HH:mm:ss");
      const endOfDay = yesterday.endOf("day").format("YYYY-MM-DD HH:mm:ss");

      const plannedAlarms = await db.models.Datalog.findAll({
        where: {
          timeOfOccurence: {
            [db.Sequelize.Op.between]: [startOfDay, endOfDay],
          },
          x_state: "planned",
          x_comment: {
            [db.Sequelize.Op.ne]: null,
          },
        },
        order: [
          ["x_group", "ASC"],
          ["timeOfOccurence", "ASC"],
        ],
        raw: true,
      });

      if (plannedAlarms.length > 0) {
        doc.addPage();

        // Titre de la page
        doc
          .fontSize(20)
          .fillColor("#000")
          .text("Résumé des interventions planifiées", {
            align: "center",
          });
        doc.moveDown();
        doc
          .fontSize(12)
          .fillColor("#666")
          .text(
            `Date: ${yesterday.format("DD/MM/YYYY")} - ${
              plannedAlarms.length
            } alarme(s)`,
            {
              align: "center",
            }
          );
        doc.moveDown(2);

        // Grouper les alarmes par x_group
        const groupedPlannedAlarms = plannedAlarms.reduce((acc, alarm) => {
          const groupKey = alarm.x_group || `single_${alarm.dbId}`;
          if (!acc[groupKey]) {
            acc[groupKey] = [];
          }
          acc[groupKey].push(alarm);
          return acc;
        }, {});

        let yPosition = doc.y;
        const maxY = doc.page.height - 60; // Marge du bas

        for (const [groupKey, alarms] of Object.entries(groupedPlannedAlarms)) {
          const isGroup = !groupKey.startsWith("single_");
          const firstAlarm = alarms[0]; // Premier alarme du groupe
          const lastAlarm = alarms[alarms.length - 1]; // Dernière alarme du groupe

          // Calculer le temps total de l'intervention
          const startTime = dayjs(firstAlarm.timeOfOccurence);
          const endTime = dayjs(
            lastAlarm.timeOfAcknowledge || lastAlarm.timeOfOccurence
          ).add(lastAlarm.duration || 0, "second");
          const totalDuration = endTime.diff(startTime, "minute");
          const hours = Math.floor(totalDuration / 60);
          const minutes = totalDuration % 60;
          const durationText =
            hours > 0
              ? `${hours}h${minutes.toString().padStart(2, "0")}`
              : `${minutes}min`;

          // Vérifier si on doit ajouter une nouvelle page
          if (yPosition > maxY - 100) {
            doc.addPage();
            yPosition = 60;
          }

          // Encadré pour chaque intervention
          doc.rect(30, yPosition - 5, pageWidth, 0).stroke();

          // Titre = Commentaire
          doc.fontSize(12).fillColor("#0066cc").font("Helvetica-Bold");
          doc.text(firstAlarm.x_comment || "Intervention", 35, yPosition, {
            width: pageWidth - 10,
          });
          yPosition += 20;

          // Détails de l'intervention
          doc.fontSize(10).font("Helvetica").fillColor("#333");
          doc.text(`Zone: ${firstAlarm.dataSource}`, 35, yPosition);
          doc.text(`Début: ${startTime.format("HH:mm")}`, 200, yPosition);
          doc.text(`Fin: ${endTime.format("HH:mm")}`, 350, yPosition);
          doc.text(`Durée: ${durationText}`, 480, yPosition);

          yPosition += 20; // Espacement entre les interventions
        }

        console.log("Planned interventions summary added to PDF.");
      } else {
        console.log("No planned interventions found for yesterday.");
      }
      // END PLANNED INTERVENTIONS

      doc.end();

      stream.on("finish", async () => {
        console.log(`PDF successfully saved to: ${filePath}`);
        // Ne pas fermer le navigateur ici, il sera fermé après l'utilisation du PDF
        resolve(filePath);
      });

      stream.on("error", async (err) => {
        console.error("Error writing PDF:", err);
        // Fermer le navigateur puppeteer en cas d'erreur
        if (browserInstance) {
          await browserInstance.close();
          browserInstance = null;
        }
        reject(err);
      });
    } catch (error) {
      console.error("Error generating KPI PDF:", error);
      // Fermer le navigateur puppeteer en cas d'erreur
      if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
      }
      reject(error);
    }
  });
}

/**
 * Obtient ou crée une instance de navigateur puppeteer
 */
async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserInstance;
}

/**
 * Génère l'image du graphique pour un groupe en utilisant puppeteer
 */
async function generateImage(data) {
  const filteredData = data.chartData.filter(
    (d) => d.minProdReached && d.errors > 0 && d.downtime > 0
  );

  if (filteredData.length === 0) {
    return null;
  }

  const labels = filteredData.map((item) => {
    const date = new Date(item.date);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  });

  const transportLabel =
    data.chartData[0]?.transportType === "tray" ? "trays" : "palettes";
  const transportDivisor =
    data.chartData[0]?.transportType === "tray" ? "1000" : "100";

  // Calculer la ligne de tendance (régression linéaire)
  const calculateTrendLine = (values) => {
    const n = values.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const yValues = values.map((v) => parseFloat(v));

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return {
      data: xValues.map((x) => parseFloat((slope * x + intercept).toFixed(2))),
      slope: slope,
    };
  };

  const trendLine = calculateTrendLine(filteredData.map((item) => item.errors));

  const getTrendColor = (slope) => {
    const avgValue =
      filteredData.reduce((sum, item) => sum + parseFloat(item.errors), 0) /
      filteredData.length;
    const relativeSlope = Math.abs(slope) / avgValue;

    if (relativeSlope < 0.01) return "#FFA500";
    return slope < 0 ? "#00C853" : "#FF1744";
  };

  const trendColor = getTrendColor(trendLine.slope);

  // Calculer l'échelle max basée sur les données et moyennes
  const errorValues = filteredData.map((item) => parseFloat(item.errors));
  const movingAverageValues = filteredData.map((item) =>
    parseFloat(item.movingAverageErrors)
  );
  const allErrorValues = [
    ...errorValues,
    ...movingAverageValues,
    ...trendLine.data,
  ].sort((a, b) => a - b);
  const percentile90Index = Math.floor(allErrorValues.length * 0.9);
  const maxScale = Math.round(allErrorValues[percentile90Index] * 1.5);

  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setViewport({
    width: 2346,
    height: 600,
    deviceScaleFactor: 3,
  });

  const configuration = {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          type: "line",
          label: "Tendance",
          data: trendLine.data,
          borderColor: trendColor,
          backgroundColor: trendColor,
          borderWidth: 3,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
          tension: 0,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "Moyenne 7 jours (nombre)",
          data: filteredData.map((item) => item.movingAverageErrors),
          borderColor: "#C10015",
          backgroundColor: "#C10015",
          borderWidth: 2,
          fill: false,
          pointRadius: 0,
          tension: 0.2,
          yAxisID: "y",
        },
        {
          type: "bar",
          label: `Pannes / ${transportDivisor} ${transportLabel} (temps [minutes])`,
          data: filteredData.map((item) =>
            parseFloat(item.downtime.toFixed(2))
          ),
          backgroundColor: "#00e396",
          borderColor: "#00e396",
          yAxisID: "y1",
        },
        {
          type: "bar",
          label: `Pannes / ${transportDivisor} ${transportLabel} (nombre)`,
          data: filteredData.map((item) => parseFloat(item.errors.toFixed(2))),
          backgroundColor: "#008ffb",
          borderColor: "#008ffb",
          yAxisID: "y",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: 0,
      },
      plugins: {
        title: {
          display: true,
          text: "Total history",
          font: {
            size: 20,
            weight: "bold",
          },
        },
        legend: {
          display: true,
          position: "bottom",
        },
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 90,
            minRotation: 90,
          },
          grid: {
            display: false,
          },
        },
        y: {
          type: "linear",
          display: true,
          position: "left",
          beginAtZero: true,
          min: 0,
          max: maxScale,
          title: {
            display: true,
            text: `Nombre de pannes / ${transportDivisor} ${transportLabel}`,
          },
        },
        y1: {
          type: "linear",
          display: true,
          position: "right",
          beginAtZero: true,
          min: 0,
          title: {
            display: true,
            text: `Temps de pannes / ${transportDivisor} ${transportLabel} (minutes)`,
          },
          grid: {
            drawOnChartArea: false,
          },
        },
      },
    },
  };

  // Générer le HTML avec Chart.js
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
      <style>
        body { margin: 0; padding: 0; background: white; }
        #chartContainer { width: 100vw; height: 100vh; }
        canvas { width: 100% !important; height: 100% !important; }
      </style>
    </head>
    <body>
      <div id="chartContainer">
        <canvas id="myChart"></canvas>
      </div>
      <script>
        const ctx = document.getElementById('myChart');
        const config = ${JSON.stringify(configuration)};
        new Chart(ctx, config);
      </script>
    </body>
    </html>
  `;

  await page.setContent(htmlContent);
  // Attendre que le graphique soit rendu (compatibilité Puppeteer)
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const chartElement = await page.$("#chartContainer");
  const imageBuffer = await chartElement.screenshot({ type: "png" });

  await page.close();
  return imageBuffer;
}

/**
 * Génère l'image du graphique pour un custom chart en utilisant puppeteer
 */
async function generateCustomChartImage(data) {
  const chartData = data.chartData;

  if (!chartData || chartData.length === 0) return null;

  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setViewport({
    width: 2346,
    height: 600,
    deviceScaleFactor: 3,
  });

  const labels = chartData.map((item) => {
    const date = new Date(item.date);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  });

  // Calculer la ligne de tendance (régression linéaire)
  const calculateTrendLine = (values) => {
    const n = values.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const yValues = values.map((v) => parseFloat(v));

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return {
      data: xValues.map((x) => parseFloat((slope * x + intercept).toFixed(2))),
      slope: slope,
    };
  };

  const trendLine = calculateTrendLine(
    chartData.map((item) => parseFloat(item.data))
  );

  const getTrendColor = (slope) => {
    const avgValue =
      chartData.reduce((sum, item) => sum + parseFloat(item.data), 0) /
      chartData.length;
    const relativeSlope = Math.abs(slope) / avgValue;

    if (relativeSlope < 0.01) return "#FFA500";
    return slope < 0 ? "#00C853" : "#FF1744";
  };

  const trendColor = getTrendColor(trendLine.slope);

  // Calculer l'échelle max basée sur les données et moyennes (sans targets)
  const dataValues = chartData.map((item) => parseFloat(item.data));
  const movingAverageValues = chartData.map((item) =>
    parseFloat(item.movingAverage)
  );
  const allValues = [
    ...dataValues,
    ...movingAverageValues,
    ...trendLine.data,
  ].sort((a, b) => a - b);
  const percentile90Index = Math.floor(allValues.length * 0.9);
  const maxScale = Math.round(allValues[percentile90Index] * 1.5);

  const configuration = {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          type: "line",
          label: "Tendance",
          data: trendLine.data,
          borderColor: trendColor,
          backgroundColor: trendColor,
          borderWidth: 3,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
          tension: 0,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "Moyenne 7 jours (nombre)",
          data: chartData.map((item) => parseFloat(item.movingAverage)),
          borderColor: "#C10015",
          backgroundColor: "#C10015",
          borderWidth: 2,
          fill: false,
          pointRadius: 0,
          tension: 0.2,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "Target",
          data: chartData.map((item) => parseFloat(item.target) || 0),
          borderColor: "#34db34",
          backgroundColor: "#34db34",
          borderWidth: 2,
          fill: false,
          pointRadius: 0,
          yAxisID: "y",
        },
        {
          type: "bar",
          label: "Nombre d'erreurs",
          data: chartData.map((item) => parseFloat(item.data)),
          backgroundColor: "#008ffb",
          borderColor: "#008ffb",
          yAxisID: "y",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: 0,
      },
      plugins: {
        title: {
          display: true,
          text: "Total history",
          font: {
            size: 20,
            weight: "bold",
          },
        },
        legend: {
          display: true,
          position: "bottom",
        },
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 90,
            minRotation: 90,
          },
          grid: {
            display: false,
          },
        },
        y: {
          type: "linear",
          display: true,
          position: "left",
          beginAtZero: true,
          min: 0,
          max: maxScale,
          title: {
            display: true,
            text: "Nombre d'erreurs",
          },
        },
      },
    },
  };

  // Générer le HTML avec Chart.js
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
      <style>
        body { margin: 0; padding: 0; background: white; }
        #chartContainer { width: 100vw; height: 100vh; }
        canvas { width: 100% !important; height: 100% !important; }
      </style>
    </head>
    <body>
      <div id="chartContainer">
        <canvas id="myChart"></canvas>
      </div>
      <script>
        const ctx = document.getElementById('myChart');
        const config = ${JSON.stringify(configuration)};
        new Chart(ctx, config);
      </script>
    </body>
    </html>
  `;

  await page.setContent(htmlContent);
  // Attendre que le graphique soit rendu (compatibilité Puppeteer)
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const chartElement = await page.$("#chartContainer");
  const imageBuffer = await chartElement.screenshot({ type: "png" });

  await page.close();
  return imageBuffer;
}

/**
 * Formate les données pour le custom chart
 */
function formatDataForCustomChart(data, customChart) {
  const tableData = data.tableData;
  let alarmMap = new Map();
  const dates = new Set();

  if (!tableData || tableData.length === 0)
    return { tableRows: [], tableColumns: [] };

  tableData.forEach((row) => {
    dates.add(row.day_date);

    try {
      const alarmsDetail = JSON.parse(`[${row.alarms_detail}]`);
      alarmsDetail.forEach((alarm) => {
        if (!alarmMap.has(alarm.alarm_id)) {
          alarmMap.set(alarm.alarm_id, {
            dailyBreakdown: {},
            alarmId: alarm.alarm_id,
          });
        }

        alarmMap.get(alarm.alarm_id).dailyBreakdown[row.day_date] = alarm.count;
      });
    } catch (e) {
      console.error("Error parsing alarms_detail:", e);
    }
  });

  alarmMap.forEach((value, key) => {
    value.count = Object.values(value.dailyBreakdown).reduce(
      (sum, current) => sum + current,
      0
    );
    alarmMap.set(key, value);
  });

  alarmMap = new Map(
    Array.from(alarmMap.entries()).sort((a, b) => b[1].count - a[1].count)
  );

  const sortedDates = Array.from(dates).sort();

  const tableColumns = [
    { name: "dataSource", label: "Source", align: "left" },
    { name: "alarmArea", label: "Module", align: "left" },
    { name: "error", label: "Erreur", align: "left" },
  ];

  sortedDates.forEach((date) => {
    const dateObj = new Date(date);
    const formattedDate = `${String(dateObj.getDate()).padStart(
      2,
      "0"
    )}/${String(dateObj.getMonth() + 1).padStart(2, "0")}`;

    tableColumns.push({
      name: date,
      label: formattedDate,
      align: "center",
    });
  });

  const alarmList = data.alarmList || [];

  const tableRows = Array.from(alarmMap.values()).map((alarm) => {
    const alarmDetails = alarmList.find((a) => a.alarmId === alarm.alarmId);

    const row = {
      alarmId: alarm.alarmId,
      dataSource: alarmDetails?.dataSource || "UNKNOWN",
      alarmArea: alarmDetails?.alarmArea || "",
      error: alarmDetails?.alarmText || alarm.alarmId,
    };

    sortedDates.forEach((date) => {
      row[date] = alarm.dailyBreakdown[date] || 0;
    });

    return row;
  });

  return { tableRows, tableColumns, sortedDates };
}

/**
 * Formate les données pour la table d'un groupe
 */
function formatDataForTable(data) {
  let alarmMap = new Map();
  const dates = new Set();

  if (data.alarms.length === 0) return { tableRows: [], tableColumns: [] };

  data.alarms.forEach((row) => {
    dates.add(row.alarm_date);

    if (!alarmMap.has(row.alarmId)) {
      alarmMap.set(row.alarmId, {
        dataSource: row.dataSource,
        alarmArea: row.alarmArea,
        alarmId: row.alarmId,
        error: row.alarmText,
        dailyBreakdown: {},
      });
    }

    alarmMap.get(row.alarmId).dailyBreakdown[row.alarm_date] = row.daily_count;
  });

  alarmMap.forEach((value, key) => {
    value.count = Object.values(value.dailyBreakdown).reduce(
      (sum, current) => sum + current,
      0
    );
    alarmMap.set(key, value);
  });

  alarmMap = new Map(
    Array.from(alarmMap.entries()).sort((a, b) => b[1].count - a[1].count)
  );
  const sortedDates = Array.from(dates).sort();

  const tableColumns = [
    { name: "dataSource", label: "Source", align: "left" },
    { name: "alarmArea", label: "Module", align: "left" },
    { name: "error", label: "Erreur", align: "left" },
  ];

  sortedDates.forEach((date) => {
    const dateObj = new Date(date);
    const formattedDate = `${String(dateObj.getDate()).padStart(
      2,
      "0"
    )}/${String(dateObj.getMonth() + 1).padStart(2, "0")}`;

    tableColumns.push({
      name: date,
      label: formattedDate,
      align: "center",
    });
  });

  const tableRows = Array.from(alarmMap.values()).map((alarm) => {
    const row = {
      alarmId: alarm.alarmId,
      dataSource: alarm.dataSource,
      alarmArea: alarm.alarmArea,
      error: alarm.error,
    };

    sortedDates.forEach((date) => {
      row[date] = alarm.dailyBreakdown[date] || 0;
    });

    return row;
  });

  // Ajouter la ligne des quantités de trays/palettes
  if (
    sortedDates
      .map((d) => {
        return data.chartData.find((t) => t.date === d)?.traysAmount || 0;
      })
      .some((v) => v > 0)
  ) {
    tableRows.unshift({
      dataSource: "----",
      alarmArea: "----",
      error:
        data.chartData[0].transportType === "tray"
          ? "Quantité de trays"
          : "Quantité de palettes",
      ...Object.fromEntries(
        sortedDates.map((date) => {
          const trayEntry = data.chartData.find((t) => t.date === date);
          return [date, trayEntry ? trayEntry.traysAmount : 0];
        })
      ),
    });
  }

  return { tableRows, tableColumns, sortedDates };
}

/**
 * Génère une table dans le PDF
 */
function generateTable(
  doc,
  tableRows,
  tableColumns,
  startX = 30,
  startY = null,
  tableWidth = null
) {
  if (startY === null) startY = doc.y;
  if (tableWidth === null) tableWidth = doc.page.width - 60;

  const fontSize = 7;
  const rowHeight = 13;
  const headerHeight = 20;

  const fixedColumnsWidth = {
    dataSource: Math.min(40, tableWidth * 0.15),
    alarmArea: Math.min(40, tableWidth * 0.15),
    error: Math.min(350, tableWidth * 0.55),
  };

  const dateColumns = tableColumns.filter(
    (col) => !["dataSource", "alarmArea", "error"].includes(col.name)
  );

  const fixedWidth =
    fixedColumnsWidth.dataSource +
    fixedColumnsWidth.alarmArea +
    fixedColumnsWidth.error;
  const remainingWidth = tableWidth - fixedWidth;
  const dateColumnWidth = Math.max(15, remainingWidth / dateColumns.length);

  const getCellColor = (value, row, allRows, colName) => {
    if (row.dataSource === "----") return "#a5d8ff";
    if (
      colName === "dataSource" ||
      colName === "alarmArea" ||
      colName === "error"
    )
      return null;
    if (value === null || value === undefined || value === 0) return "#e9ecef";

    const rowsValues = allRows
      .slice(1)
      .map((r) =>
        Object.keys(r)
          .filter(
            (k) => !["alarmId", "dataSource", "alarmArea", "error"].includes(k)
          )
          .map((k) => r[k])
      )
      .flat()
      .filter((v) => v > 0);

    const maxValue = Math.max(...rowsValues);
    const minValue = Math.min(...rowsValues);
    const range = maxValue - minValue;
    const normalizedValue = (value - minValue) / range;

    if (normalizedValue < 0.1) return "#51cf66";
    if (normalizedValue < 0.2) return "#ffd43b";
    if (normalizedValue < 0.5) return "#ff922b";
    return "#ff6b6b";
  };

  // Dessiner l'en-tête
  doc.fontSize(fontSize).font("Helvetica-Bold");
  let currentX = startX;

  ["dataSource", "alarmArea", "error"].forEach((colName) => {
    const col = tableColumns.find((c) => c.name === colName);
    const colWidth = fixedColumnsWidth[colName];

    doc
      .rect(currentX, startY, colWidth, headerHeight)
      .fillAndStroke("#f1f3f5", "#000");
    doc.fillColor("#000").text(col.label, currentX + 5, startY + 8, {
      width: colWidth - 10,
      align: col.align || "left",
    });

    currentX += colWidth;
  });

  // En-têtes des dates
  dateColumns.forEach((col) => {
    doc
      .rect(currentX, startY, dateColumnWidth, headerHeight)
      .fillAndStroke("#f1f3f5", "#000");
    doc.fillColor("#000").text(col.label, currentX + 2, startY + 8, {
      width: dateColumnWidth - 4,
      align: "center",
    });

    currentX += dateColumnWidth;
  });

  startY += headerHeight;

  // Dessiner les lignes de données
  doc.font("Helvetica").fontSize(fontSize);

  tableRows.forEach((row) => {
    if (startY > doc.page.height - 60) {
      doc.addPage();
      startY = 50;
    }

    currentX = startX;

    // Colonnes fixes
    ["dataSource", "alarmArea", "error"].forEach((colName) => {
      const colWidth = fixedColumnsWidth[colName];
      const value = row[colName] || "";

      doc.rect(currentX, startY, colWidth, rowHeight).stroke("#000");
      doc.fillColor("#000").text(value, currentX + 5, startY + 4, {
        width: colWidth - 10,
        align: "left",
        ellipsis: true,
      });

      currentX += colWidth;
    });

    // Colonnes de dates
    dateColumns.forEach((col) => {
      const value = row[col.name] || 0;
      const bgColor = getCellColor(value, row, tableRows, col.name);

      if (bgColor) {
        doc
          .rect(currentX, startY, dateColumnWidth, rowHeight)
          .fillAndStroke(bgColor, "#000");
      } else {
        doc.rect(currentX, startY, dateColumnWidth, rowHeight).stroke("#000");
      }

      if (value > 0) {
        doc.fillColor("#000").text(value.toString(), currentX + 2, startY + 4, {
          width: dateColumnWidth - 4,
          align: "center",
        });
      }

      currentX += dateColumnWidth;
    });

    startY += rowHeight;
  });
}

/**
 * Envoie le PDF par email aux utilisateurs configurés
 */
async function sendPDFByEmail(pdfPath) {
  const db = getDB();
  // Vérifier si le fichier existe
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  // Charger la configuration
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  if (!config.email || !config.email.enabled) {
    console.log("Email sending is disabled in configuration.");
    return;
  }

  // Récupérer les utilisateurs qui doivent recevoir le rapport
  const users = await db.models.Users.findAll({
    where: { recieveDailyReport: true },
  });

  if (!users || users.length === 0) {
    console.log("No users configured to receive daily report.");
    return;
  }

  const recipientEmails = users
    .map((u) => u.email)
    .filter((email) => email && email.includes("@"));

  if (recipientEmails.length === 0) {
    console.log("No valid email addresses found.");
    return;
  }

  // Lire le PDF
  const pdfData = fs.readFileSync(pdfPath);

  // Configurer le transporteur
  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: false,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });

  // Options du mail
  const mailOptions = {
    from: `MLR Tool <${config.email.user}>`,
    to: recipientEmails,
    subject: `KPI Daily Report - ${dayjs()
      .subtract(1, "day")
      .format("YYYY-MM-DD")}`,
    text: `
Bonjour,
Hallo,
Hello,

Voici les KPI machine des 7 derniers jours.
Hier sind die Maschinen-KPIs der letzten 7 Tage.
Here are the machine's KPIs for the last 7 days.

Bonne lecture, bonne journée.
Viel Spaß beim Lesen, einen schönen Tag noch.
Enjoy your reading, have a nice day.

-----------------------------------------------------------------------

Ceci est un email généré automatiquement, merci de ne pas y répondre.
Dies ist eine automatisch generierte E-Mail, bitte nicht antworten.
This is an automatically generated email, please do not reply.`,
    attachments: [
      {
        filename: path.basename(pdfPath),
        content: pdfData,
      },
    ],
  };

  // Envoyer l'email
  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending KPI report email:", error);
        reject(error);
      } else {
        console.log("KPI report email sent:", info.response);
        console.log(`Email sent to: ${recipientEmails.join(", ")}`);
        resolve(info);
      }
    });
  });
}
