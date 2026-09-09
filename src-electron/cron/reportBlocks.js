import { updateJob } from "./utils.js";
import dayjs from "dayjs";
import puppeteer from "puppeteer";

const jobName = "sendKPI";

// Utilisation de puppeteer pour générer les graphiques (plus stable que canvas dans Electron)
// Instance unique partagée par tous les renderers de blocs (et par SendKPI.js
// via closePuppeteerBrowser, ré-exporté depuis ce module).
let browserInstance = null;

/**
 * Ferme le navigateur puppeteer proprement.
 * Ré-exporté par SendKPI.js sous le même nom pour compatibilité avec
 * l'API existante (KPI.routes.js importe closePuppeteerBrowser).
 */
export async function closePuppeteerBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    console.log("Puppeteer browser closed");
  }
}

/**
 * Formate un nombre avec des apostrophes comme séparateurs de milliers
 * (convention suisse, ex: 1'493'948). N'utilise PAS toLocaleString("fr-CH") :
 * cette locale utilise l'espace fine insécable Unicode (U+202F) comme
 * séparateur, un caractère absent de l'encodage WinAnsi que PDFKit utilise
 * pour la police Helvetica par défaut — le glyphe est alors mal rendu dans
 * le PDF (observé : "/" à la place de l'espace).
 */
function formatSwissNumber(value) {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

/**
 * [D4] Centralise les appels aux endpoints locaux de l'API KPI, réutilisé
 * par tous les renderers qui ont besoin de données déjà exposées en HTTP.
 */
async function fetchLocalAPI(path) {
  const response = await fetch(`http://localhost:${process.env.PORT || 3000}${path}`);
  return response.json();
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
  const maxScale =
    data.options.maxY || Math.round(allErrorValues[percentile90Index] * 1.5);

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
 * Génère l'image du graphique SevenDaysAverage
 */
async function generateSevenDaysAverageImage(data) {
  const max = Math.round(
    Math.max(data.errors_per_thousand, data.downtime_minutes_per_thousand) * 1.5
  );

  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 400, deviceScaleFactor: 2 });

  const configuration = {
    type: "bar",
    data: {
      datasets: [
        {
          label: "Nombre de pannes",
          data: [
            {
              x: "Nombre d'erreurs moyen",
              y: parseFloat(data.errors_per_thousand.toFixed(2)),
            },
          ],
          backgroundColor: "#008ffb",
        },
        {
          label: "Temps de pannes [min]",
          data: [
            {
              x: "Temps de panne moyen",
              y: parseFloat(data.downtime_minutes_per_thousand.toFixed(2)),
            },
          ],
          backgroundColor: "#00e396",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: "Rapport des 7 derniers jours",
          font: { size: 18, weight: "bold" },
        },
        legend: { display: true, position: "bottom" },
        datalabels: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          min: 0,
          max: max,
          title: { display: true, text: "Valeur / 1000 trays" },
        },
      },
    },
  };

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
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const chartElement = await page.$("#chartContainer");
  const imageBuffer = await chartElement.screenshot({ type: "png" });
  await page.close();
  return imageBuffer;
}

/**
 * Formate les données top-10 des 7 derniers jours pour le tableau
 */
function formatSevenDaysTableData(top10Data, amountsData) {
  const alarmMap = new Map();
  const dates = new Set();

  top10Data.forEach((row) => {
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

  const sortedDates = Array.from(dates).sort();

  const tableColumns = [
    { name: "dataSource", label: "Source", align: "left" },
    { name: "alarmArea", label: "Module", align: "left" },
    { name: "error", label: "Erreur", align: "left" },
  ];

  sortedDates.forEach((date) => {
    const dateObj = new Date(date);
    const formattedDate = `${String(dateObj.getDate()).padStart(2, "0")}/${String(
      dateObj.getMonth() + 1
    ).padStart(2, "0")}`;
    tableColumns.push({ name: date, label: formattedDate, align: "center" });
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

  // Lignes de quantités
  tableRows.unshift({
    dataSource: "----",
    alarmArea: "----",
    error: "Quantité de trays sortie (entrée palletiseurs)",
    ...Object.fromEntries(
      sortedDates.map((date) => {
        const total = amountsData
          .filter(
            (t) =>
              t.date === date && ["X101", "X102", "X103", "X104"].includes(t.zoneName)
          )
          .reduce((sum, curr) => sum + curr.total, 0);
        return [date, total];
      })
    ),
  });
  tableRows.unshift({
    dataSource: "----",
    alarmArea: "----",
    error: "Quantité de trays entrée (sortie dépalettiseurs)",
    ...Object.fromEntries(
      sortedDates.map((date) => {
        const total = amountsData
          .filter(
            (t) =>
              t.date === date && ["X001", "X002", "X003", "X004"].includes(t.zoneName)
          )
          .reduce((sum, curr) => sum + curr.total, 0);
        return [date, total];
      })
    ),
  });
  tableRows.unshift({
    dataSource: "----",
    alarmArea: "----",
    error: "Quantité de palettes sortie",
    ...Object.fromEntries(
      sortedDates.map((date) => {
        const total = amountsData
          .filter((t) => t.date === date && ["F013"].includes(t.zoneName))
          .reduce((sum, curr) => sum + curr.total, 0);
        return [date, total];
      })
    ),
  });
  tableRows.unshift({
    dataSource: "----",
    alarmArea: "----",
    error: "Quantité de palettes entrée",
    ...Object.fromEntries(
      sortedDates.map((date) => {
        const total = amountsData
          .filter(
            (t) =>
              t.date === date &&
              ["X001_PAL", "X002_PAL", "X003_PAL"].includes(t.zoneName)
          )
          .reduce((sum, curr) => sum + curr.total, 0);
        return [date, total];
      })
    ),
  });

  return { tableRows, tableColumns };
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
 * Dessine le tableau croisé des chutes de tours de caisses (dates x zones),
 * avec une ligne de total par zone, dans le même style visuel que generateTable().
 */
function generateCaseCrashesTable(
  doc,
  rows,
  zones,
  startX = 30,
  startY = null,
  tableWidth = null
) {
  if (startY === null) startY = doc.y;
  if (tableWidth === null) tableWidth = doc.page.width - 60;

  const fontSize = 7;
  const rowHeight = 13;
  const headerHeight = 20;

  const dateColumnWidth = Math.min(60, tableWidth * 0.2);
  const zoneColumnWidth = Math.max(
    20,
    (tableWidth - dateColumnWidth) / zones.length
  );

  const totals = {};
  zones.forEach((zone) => {
    totals[zone] = rows.reduce((sum, row) => sum + (row[zone] || 0), 0);
  });

  const drawHeaderRow = (label, getValue, isBold, y) => {
    doc.font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
    let currentX = startX;

    doc
      .rect(currentX, y, dateColumnWidth, headerHeight)
      .fillAndStroke("#f1f3f5", "#000");
    doc.fillColor("#000").text(label, currentX + 5, y + 6, {
      width: dateColumnWidth - 10,
      align: "left",
    });
    currentX += dateColumnWidth;

    zones.forEach((zone) => {
      doc
        .rect(currentX, y, zoneColumnWidth, headerHeight)
        .fillAndStroke("#f1f3f5", "#000");
      doc.fillColor("#000").text(getValue(zone), currentX + 2, y + 6, {
        width: zoneColumnWidth - 4,
        align: "center",
      });
      currentX += zoneColumnWidth;
    });

    return y + headerHeight;
  };

  // En-tête (noms de zones)
  startY = drawHeaderRow("Date", (zone) => zone, true, startY);

  // Lignes de données
  doc.font("Helvetica").fontSize(fontSize);
  rows.forEach((row) => {
    if (startY > doc.page.height - 60) {
      doc.addPage();
      startY = 50;
    }

    let currentX = startX;

    doc.rect(currentX, startY, dateColumnWidth, rowHeight).stroke("#000");
    doc
      .fillColor("#000")
      .text(dayjs(row.date).format("DD/MM/YYYY"), currentX + 5, startY + 4, {
        width: dateColumnWidth - 10,
        align: "left",
      });
    currentX += dateColumnWidth;

    zones.forEach((zone) => {
      const value = row[zone] || 0;
      const bgColor = value > 0 ? "#ffd43b" : "#e9ecef";

      doc
        .rect(currentX, startY, zoneColumnWidth, rowHeight)
        .fillAndStroke(bgColor, "#000");

      if (value > 0) {
        doc.fillColor("#000").text(value.toString(), currentX + 2, startY + 4, {
          width: zoneColumnWidth - 4,
          align: "center",
        });
      }

      currentX += zoneColumnWidth;
    });

    startY += rowHeight;

    // Vérifier si on doit ajouter une nouvelle page pour la prochaine ligne
    if (startY > doc.page.height - 60) {
      doc.addPage();
      startY = 50;
    }
  });

  // Ligne de total en bas
  startY = drawHeaderRow("Total", (zone) => totals[zone], true, startY);
}

// ============================================================================
// FONCTIONS DE RENDU DE BLOCS
//
// Chaque fonction a la signature commune (doc, db, ctx, block) où :
//   - doc  : instance PDFDocument en cours d'écriture
//   - db   : instance Sequelize (getDB())
//   - ctx  : { pageWidth, renderCache } partagé entre tous les blocs d'un même
//            job (renderCache = Map clé `${blockType}:${refId}` — voir [D9])
//   - block: la ligne ReportBlocks en cours (blockType, refId, config)
// ============================================================================

/**
 * [D1] Notifie les admins qu'un bloc référence une entité introuvable
 * (ZoneGroup ou CustomChart supprimé/renommé après la création du rapport),
 * puis continue le rendu du reste du rapport sans planter.
 */
async function notifyOrphanBlock(db, blockType, refId) {
  const message = `Bloc de rapport introuvable : ${blockType} refId="${refId}" n'existe plus (supprimé ou renommé). Ce bloc a été ignoré.`;
  console.warn(message);
  try {
    const admins = await db.models.Users.findAll({ where: { isAdmin: true } });
    for (const admin of admins) {
      await db.models.Notifications.create({
        userId: admin.id,
        message,
        type: "warning",
      });
    }
  } catch (notifyError) {
    console.error("Failed to notify admins about orphan block:", notifyError);
  }
}

/**
 * START/END CASE CRASHES (bloc statique, aucun refId)
 */
export async function renderCaseCrashesBlock(doc, db, ctx) {
  const { pageWidth } = ctx;
  console.log("Generating case crashes summary...");
  await updateJob(
    {
      lastLog: "Generating case crashes summary...",
    },
    jobName
  );

  const CASE_CRASHES_ZONES = [
    "F013",
    "X001",
    "X002",
    "X003",
    "X101",
    "X102",
    "X103",
    "X104",
  ];

  const caseCrashesReportDaysSetting = await db.models.Settings.getValue(
    "CASE_CRASHES_REPORT_DAYS"
  );
  const caseCrashesReportDays =
    parseInt(caseCrashesReportDaysSetting, 10) || 30;

  const caseCrashesSince = dayjs()
    .subtract(caseCrashesReportDays, "day")
    .format("YYYY-MM-DD");

  const caseCrashes = await db.models.CaseCrash.findAll({
    where: {
      crashDate: {
        [db.Sequelize.Op.gte]: caseCrashesSince,
      },
    },
    attributes: ["crashDate", "zone"],
    order: [["crashDate", "DESC"]],
    raw: true,
  });

  const caseCrashesRowsByDate = new Map();
  for (let i = 0; i < caseCrashesReportDays; i++) {
    const date = dayjs().subtract(i, "day").format("YYYY-MM-DD");
    const emptyRow = { date };
    CASE_CRASHES_ZONES.forEach((zone) => (emptyRow[zone] = 0));
    caseCrashesRowsByDate.set(date, emptyRow);
  }
  for (const crash of caseCrashes) {
    const date = dayjs(crash.crashDate).format("YYYY-MM-DD");
    if (!caseCrashesRowsByDate.has(date)) {
      const emptyRow = { date };
      CASE_CRASHES_ZONES.forEach((zone) => (emptyRow[zone] = 0));
      caseCrashesRowsByDate.set(date, emptyRow);
    }
    caseCrashesRowsByDate.get(date)[crash.zone] += 1;
  }
  const caseCrashesRows = [...caseCrashesRowsByDate.values()].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  doc.addPage();

  doc
    .fontSize(20)
    .fillColor("#000")
    .text("Chutes de tours de caisses", {
      align: "center",
    });
  doc.moveDown(0.3);
  doc
    .fontSize(12)
    .fillColor("#666")
    .text(
      `Derniers ${caseCrashesReportDays} jours - ${caseCrashes.length} chute(s)`,
      {
        align: "center",
      }
    );
  doc.moveDown(0.8);

  if (caseCrashesRows.length > 0) {
    generateCaseCrashesTable(
      doc,
      caseCrashesRows,
      CASE_CRASHES_ZONES,
      30,
      doc.y,
      pageWidth
    );
  } else {
    doc
      .fontSize(11)
      .fillColor("#666")
      .text(
        `Aucune chute de tour de caisses enregistrée sur les derniers ${caseCrashesReportDays} jours.`,
        {
          align: "center",
        }
      );
  }

  console.log("Case crashes summary added to PDF.");
}

/**
 * START/END SEVEN DAYS AVERAGE PAGE (bloc statique, aucun refId)
 */
export async function renderSevenDaysAverageBlock(doc, db, ctx) {
  const { pageWidth } = ctx;
  console.log("Generating Seven Days Average page...");
  await updateJob(
    { lastLog: "Generating Seven Days Average page..." },
    jobName
  );

  const sevenDaysData = await fetchLocalAPI("/kpi/charts/global-last-7-days");
  const top10Data = await fetchLocalAPI("/kpi/charts/global-last-7-days/top-10");
  const amountsData = await fetchLocalAPI("/kpi/charts/amount");

  doc.addPage();

  // Titre
  doc
    .fontSize(18)
    .fillColor("#000")
    .text("Rapport des 7 derniers jours", { align: "center" });
  doc
    .fontSize(12)
    .fillColor("#666")
    .text(
      `Traité ${formatSwissNumber(sevenDaysData.total_LHM_processed)} LHM sur les 7 derniers jours`,
      { align: "center" }
    );

  // Graphique
  const sevenDaysImageBuffer = await generateSevenDaysAverageImage(sevenDaysData);
  if (sevenDaysImageBuffer) {
    doc.image(sevenDaysImageBuffer, 30, 80, {
      width: pageWidth,
      height: 180,
    });
  }

  // Tableau top-10
  const { tableRows: sevenDaysRows, tableColumns: sevenDaysColumns } =
    formatSevenDaysTableData(top10Data, amountsData);

  if (sevenDaysRows.length > 0) {
    generateTable(doc, sevenDaysRows, sevenDaysColumns, 30, 270, pageWidth);
  }

  console.log("Seven Days Average page added to PDF.");
}

/**
 * START/END GROUP CHART, pour un seul ZoneGroup (refId = zoneGroupName).
 * [D1] Notifie et skip si le groupe n'existe plus.
 * [D9] Réutilise le résultat déjà calculé dans ctx.renderCache si un rapport
 * précédent dans la même exécution du job a déjà rendu ce même groupe.
 */
export async function renderZoneGroupBlock(doc, db, ctx, block) {
  const { pageWidth, renderCache } = ctx;
  const zoneGroupName = block.refId;

  const group = await db.models.ZoneGroups.findByPk(zoneGroupName);
  if (!group) {
    await notifyOrphanBlock(db, "zoneGroup", zoneGroupName);
    return;
  }

  console.log(`Generating chart for group: ${group.zoneGroupName}`);
  await updateJob(
    {
      lastLog: `Generating chart for group: ${group.zoneGroupName}`,
    },
    jobName
  );

  // NOTE: la clé ignore block.config (réservé, non utilisé au lancement) —
  // si un renderer se met un jour à lire config, inclure son hash ici pour
  // éviter que deux rapports au même bloc mais config différente partagent
  // à tort un rendu en cache.
  const cacheKey = `zoneGroup:${zoneGroupName}`;
  let cached = renderCache?.get(cacheKey);
  if (!cached) {
    const data = await fetchLocalAPI(
      `/kpi/charts/alarms-by-group/${group.zoneGroupName}`
    );
    const imageBuffer = await generateImage(data);
    const { tableRows, tableColumns } = formatDataForTable(data);
    const zones = await db.models.Zones.findAll();
    const zoneDescriptions = group.zones
      .map((z) => zones.find((z1) => z1.zone === z)?.zoneDescription)
      .join(", ");
    cached = { imageBuffer, tableRows, tableColumns, zoneDescriptions };
    renderCache?.set(cacheKey, cached);
  }

  doc.addPage();

  // Titre de la page
  doc.fontSize(18).fillColor("#000").text(`${group.zoneGroupName}`);
  doc.fontSize(10).text(cached.zoneDescriptions);

  // Graphique
  if (cached.imageBuffer !== null) {
    doc.image(cached.imageBuffer, 30, 90, {
      width: pageWidth,
      height: 200,
    });
  }

  // Tableau de données
  if (cached.tableRows.length > 0) {
    generateTable(doc, cached.tableRows, cached.tableColumns, 30, 300, pageWidth);
  }

  console.log(`Chart for group: ${group.zoneGroupName} added to PDF.`);
}

/**
 * START/END CUSTOM CHART, pour un seul CustomChart (refId = CustomChart.id).
 * [D1] Notifie et skip si le graphique n'existe plus.
 * [D9] Réutilise le résultat déjà calculé dans ctx.renderCache.
 */
export async function renderCustomChartBlock(doc, db, ctx, block) {
  const { pageWidth, renderCache } = ctx;
  const customChartId = block.refId;

  const customChart = await db.models.CustomChart.findByPk(customChartId);
  if (!customChart) {
    await notifyOrphanBlock(db, "customChart", customChartId);
    return;
  }

  console.log(`Generating custom chart: ${customChart.chartName}`);
  await updateJob(
    {
      lastLog: `Generating custom chart: ${customChart.chartName}`,
    },
    jobName
  );

  // NOTE: voir la même remarque dans renderZoneGroupBlock sur block.config.
  const cacheKey = `customChart:${customChartId}`;
  let cached = renderCache?.get(cacheKey);
  if (!cached) {
    const customData = await fetchLocalAPI(`/kpi/charts/custom/${customChart.id}`);

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
    cached = { imageBuffer, tableRows, tableColumns };
    renderCache?.set(cacheKey, cached);
  }

  doc.addPage();

  // Titre de la page
  doc.fontSize(18).fillColor("#000").text(`${customChart.chartName}`);

  // Graphique
  if (cached.imageBuffer !== null) {
    doc.image(cached.imageBuffer, 30, 90, {
      width: pageWidth,
      height: 200,
    });
  }

  // Tableau de données
  if (cached.tableRows.length > 0) {
    generateTable(doc, cached.tableRows, cached.tableColumns, 30, 300, pageWidth);
  }

  console.log(`Custom chart: ${customChart.chartName} added to PDF.`);
}

/**
 * START/END PLANNED INTERVENTIONS (bloc statique, aucun refId).
 * Recalcule yesterday/startOfDay/endOfDay en interne pour être indépendant
 * du bloc "unplanned" (dans le code d'origine, ces variables étaient
 * partagées entre les deux sections — désormais chaque bloc est autonome
 * car il peut être sélectionné indépendamment dans un rapport).
 */
export async function renderPlannedInterventionsBlock(doc, db, ctx) {
  const { pageWidth } = ctx;
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

    for (const [_, alarms] of Object.entries(groupedPlannedAlarms)) {
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

      // Encadré pour chaque intervention
      doc.rect(30, yPosition - 5, pageWidth, 0).stroke();

      // Titre = Commentaire
      doc.fontSize(12).fillColor("#0066cc").font("Helvetica-Bold");
      doc.text(firstAlarm.x_comment || firstAlarm.alarmText, 35, yPosition, {
        width: pageWidth - 10,
      });
      yPosition += 20;

      // Détails de l'intervention
      doc.fontSize(10).font("Helvetica").fillColor("#333");
      doc.text(`Zone: ${firstAlarm.dataSource}`, 35, yPosition);
      doc.text(`Début: ${startTime.format("HH:mm")}`, 200, yPosition);
      doc.text(`Fin: ${endTime.format("HH:mm")}`, 350, yPosition);
      doc.text(`Durée: ${durationText}`, 480, yPosition);
      doc.text(`Nombre d'alarmes: ${alarms.length}`, 580, yPosition);

      yPosition += 20; // Espacement entre les interventions

      // Vérifier si on doit ajouter une nouvelle page
      if (yPosition > maxY) {
        doc.addPage();
        yPosition = 30;
      }
    }

    console.log("Planned interventions summary added to PDF.");
  } else {
    console.log("No planned interventions found for yesterday.");
  }
}

/**
 * START/END UNPLANNED INTERVENTIONS (bloc statique, aucun refId).
 * Recalcule yesterday/startOfDay/endOfDay en interne (voir note sur
 * renderPlannedInterventionsBlock).
 */
export async function renderUnplannedInterventionsBlock(doc, db, ctx) {
  const { pageWidth } = ctx;
  console.log("Generating unplanned interventions summary...");
  await updateJob(
    {
      lastLog: "Generating unplanned interventions summary...",
    },
    jobName
  );

  const yesterday = dayjs().subtract(1, "day");
  const startOfDay = yesterday.startOf("day").format("YYYY-MM-DD HH:mm:ss");
  const endOfDay = yesterday.endOf("day").format("YYYY-MM-DD HH:mm:ss");

  // Récupérer toutes les alarmes non-planifiées avec commentaire
  const unplannedAlarms = await db.models.Datalog.findAll({
    where: {
      timeOfOccurence: {
        [db.Sequelize.Op.between]: [startOfDay, endOfDay],
      },
      x_state: {
        [db.Sequelize.Op.ne]: "planned",
      },
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

  if (unplannedAlarms.length > 0) {
    doc.addPage();

    // Titre de la page
    doc
      .fontSize(20)
      .fillColor("#000")
      .text("Résumé des interventions non-planifiées", {
        align: "center",
      });
    doc.moveDown();
    doc
      .fontSize(12)
      .fillColor("#666")
      .text(
        `Date: ${yesterday.format("DD/MM/YYYY")} - ${
          unplannedAlarms.length
        } alarme(s)`,
        {
          align: "center",
        }
      );
    doc.moveDown(2);

    // Grouper les alarmes par x_group
    const groupedUnplannedAlarms = unplannedAlarms.reduce((acc, alarm) => {
      const groupKey = alarm.x_group || `single_${alarm.dbId}`;
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(alarm);
      return acc;
    }, {});

    let yPosition = doc.y;
    const maxY = doc.page.height - 60; // Marge du bas

    for (const [_, alarms] of Object.entries(groupedUnplannedAlarms)) {
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

      // Encadré pour chaque intervention
      doc.rect(30, yPosition - 5, pageWidth, 0).stroke();

      // Titre = Commentaire
      doc.fontSize(12).fillColor("#d32f2f").font("Helvetica-Bold");
      doc.text(firstAlarm.x_comment || firstAlarm.alarmText, 35, yPosition, {
        width: pageWidth - 10,
      });
      yPosition += 20;

      // Détails de l'intervention
      doc.fontSize(10).font("Helvetica").fillColor("#333");
      doc.text(`Zone: ${firstAlarm.dataSource}`, 35, yPosition);
      doc.text(`Début: ${startTime.format("HH:mm")}`, 200, yPosition);
      doc.text(`Fin: ${endTime.format("HH:mm")}`, 350, yPosition);
      doc.text(`Durée: ${durationText}`, 480, yPosition);
      doc.text(`Nombre d'alarmes: ${alarms.length}`, 580, yPosition);

      yPosition += 20; // Espacement entre les interventions

      // Vérifier si on doit ajouter une nouvelle page
      if (yPosition > maxY) {
        doc.addPage();
        yPosition = 30;
      }
    }

    console.log("Unplanned interventions summary added to PDF.");
  } else {
    console.log("No unplanned interventions found for yesterday.");
  }
}

/**
 * Registre de dispatch : blockType -> fonction de rendu.
 */
export const BLOCK_RENDERERS = {
  caseCrashes: renderCaseCrashesBlock,
  sevenDaysAverage: renderSevenDaysAverageBlock,
  zoneGroup: renderZoneGroupBlock,
  customChart: renderCustomChartBlock,
  plannedInterventions: renderPlannedInterventionsBlock,
  unplannedInterventions: renderUnplannedInterventionsBlock,
};
