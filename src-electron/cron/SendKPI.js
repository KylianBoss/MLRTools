import { updateJob } from "./utils.js";
import { getDB } from "../database.js";
import dayjs from "dayjs";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import puppeteer from "puppeteer";

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

  const fileName = `KPI_Report_${dayjs().format("YYYY-MM-DD_HHmmss")}.pdf`;
  const filePath = path.join(outputDir, fileName);

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A2",
        layout: "portrait",
        margin: 30,
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Disposition en deux colonnes: table à gauche, graphique à droite
      const pageWidth = doc.page.width - 60;
      const leftColumnWidth = pageWidth * 0.6;
      const rightColumnWidth = pageWidth * 0.4;
      const columnGap = 20;
      let actualY = 30;

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

        const imageBuffer = await generateImage(data);
        const { tableRows, tableColumns } = formatDataForTable(data);

        // Calculer la hauteur nécessaire pour ce groupe
        const titleHeight = 30; // Titre + marge
        const width = 1200;
        const height = 450;
        const imgRatio = width / height;
        let imgWidth = rightColumnWidth;
        let imgHeight = imgWidth / imgRatio;
        const rowHeight = 20;
        const tableHeight = tableRows.length * rowHeight + 50;

        // Hauteur totale nécessaire (prendre le max entre table et image)
        const contentHeight =
          imageBuffer !== null ? Math.max(imgHeight, tableHeight) : tableHeight;
        const totalHeightNeeded = titleHeight + contentHeight + 40; // +40 pour marge de sécurité

        // Vérifier si on a assez d'espace sur la page actuelle
        if (actualY + totalHeightNeeded > doc.page.height - 60) {
          doc.addPage();
          actualY = 30;
        }

        doc
          .fontSize(18)
          .fillColor("#000")
          .text(`${group.zoneGroupName}`, 30, actualY);
        actualY += 20;

        // Colonne gauche: Table
        if (tableRows.length > 0) {
          generateTable(
            doc,
            tableRows,
            tableColumns,
            30,
            actualY,
            leftColumnWidth
          );
        }

        // Colonne droite: Graphique
        if (imageBuffer !== null) {
          const width = 1200;
          const height = 450;
          const imgRatio = width / height;
          const graphStartX = 30 + leftColumnWidth + columnGap;
          let imgWidth = rightColumnWidth;
          let imgHeight = imgWidth / imgRatio;

          doc.image(imageBuffer, graphStartX, actualY, {
            fit: [imgWidth, imgHeight],
          });

          actualY += imgHeight + 10;
        } else {
          // Sans graphique, on calcule la hauteur du tableau
          const rowHeight = 20;
          const tableHeight = tableRows.length * rowHeight + 50;
          actualY += tableHeight;
        }

        console.log(`Chart for group: ${group.zoneGroupName} added to PDF.`);
      }

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

        const imageBuffer = await generateCustomChartImage(customData);
        const { tableRows, tableColumns } = formatDataForCustomChart(
          customData,
          customChart
        );

        // Calculer la hauteur nécessaire pour ce custom chart
        const titleHeight = 30;
        const width = 1200;
        const height = 450;
        const imgRatio = width / height;
        let imgWidth = rightColumnWidth;
        let imgHeight = imgWidth / imgRatio;
        const rowHeight = 20;
        const tableHeight = tableRows.length * rowHeight + 50;

        // Hauteur totale nécessaire
        const contentHeight =
          imageBuffer !== null ? Math.max(imgHeight, tableHeight) : tableHeight;
        const totalHeightNeeded = titleHeight + contentHeight + 40;

        // Vérifier si on a assez d'espace
        if (actualY + totalHeightNeeded > doc.page.height - 60) {
          doc.addPage();
          actualY = 30;
        }

        doc
          .fontSize(18)
          .fillColor("#000")
          .text(`${customChart.chartName}`, 30, actualY);
        actualY += 20;

        // Colonne gauche: Table
        if (tableRows.length > 0) {
          generateTable(
            doc,
            tableRows,
            tableColumns,
            30,
            actualY,
            leftColumnWidth
          );
        }

        // Colonne droite: Graphique
        if (imageBuffer !== null) {
          const width = 1200;
          const height = 450;
          const imgRatio = width / height;
          const graphStartX = 30 + leftColumnWidth + columnGap;
          let imgWidth = rightColumnWidth;
          let imgHeight = imgWidth / imgRatio;

          doc.image(imageBuffer, graphStartX, actualY, {
            fit: [imgWidth, imgHeight],
          });

          actualY += imgHeight + 10;
        } else {
          // Sans graphique, on calcule la hauteur du tableau
          const rowHeight = 20;
          const tableHeight = tableRows.length * rowHeight + 50;
          actualY += tableHeight;
        }

        console.log(`Custom chart: ${customChart.chartName} added to PDF.`);
      }

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

  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 450 });

  const configuration = {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
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
        #chartContainer { width: 1200px; height: 450px; }
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
  await page.setViewport({ width: 1200, height: 450 });

  const labels = chartData.map((item) => {
    const date = new Date(item.date);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  });

  const barColors = chartData.map((item) => {
    const value = parseFloat(item.data);
    const target = parseFloat(item.target) || 0;
    const above = value > target;
    return above ? "#E74C3CA0" : "#27AE60A0";
  });

  const configuration = {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          type: "bar",
          label: "Nombre d'erreurs",
          data: chartData.map((item) => parseFloat(item.data)),
          backgroundColor: barColors,
          borderColor: barColors,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "Target",
          data: chartData.map((item) => parseFloat(item.target) || 0),
          borderColor: "#3498DB",
          backgroundColor: "#3498DB",
          borderWidth: 3,
          fill: false,
          pointRadius: 0,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "Moyenne 7 jours (nombre)",
          data: chartData.map((item) => parseFloat(item.movingAverage)),
          borderColor: "#F39C12",
          backgroundColor: "#F39C12",
          borderWidth: 2,
          fill: false,
          pointRadius: 0,
          tension: 0.2,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: false,
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
          title: {
            display: true,
            text: "Nombre d'erreurs",
          },
        },
        y1: {
          type: "linear",
          display: true,
          position: "right",
          beginAtZero: true,
          title: {
            display: true,
            text: "Moyenne mobile 7 jours",
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
        #chartContainer { width: 1200px; height: 450px; }
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
