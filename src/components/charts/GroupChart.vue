<template>
  <q-card>
    <q-card-section v-if="chartVisibility">
      <vue-apex-charts
        height="350"
        :options="chartOptions"
        :series="chartSeries"
        :key="chartSeries.length"
      />
    </q-card-section>
    <q-card-section v-else>
      <q-skeleton height="350px" square />
    </q-card-section>
    <q-card-section v-if="chartVisibility">
      <q-table
        :rows="topErrors"
        :columns="columns"
        :rows-per-page-options="[0]"
        no-data-label="Aucune erreur trouvée"
      />
    </q-card-section>
    <q-card-section v-else>
      <skeleton-table />
    </q-card-section>
  </q-card>
</template>

<script setup>
import VueApexCharts from "vue3-apexcharts";
import SkeletonTable from "../SkeletonTable.vue";
import dayjs from "dayjs";
import { ref, watch } from "vue";
import { api } from "boot/axios";

const props = defineProps({
  locale: {
    type: Array,
    required: false,
  },
  group: {
    type: Object,
    required: true,
  },
});
const chartOptions = ref({
  chart: {
    height: 350,
    type: "line",
    stackable: false,
    defaultLocale: "fr",
    locales: props.locale,
  },
  title: {
    text: props.group.groupName,
    align: "center",
  },
  subtitle: {
    text: `(${props.group.zones.map((z) => z.description).join(", ")})`,
    align: "center",
  },
  dataLabels: {
    enabled: true,
    enabledOnSeries: [0, 1],
    offsetY: -10,
  },
  series: [],
  stroke: {
    width: 2,
    curve: "smooth",
  },
  legend: {
    horizontalAlign: "left",
    offsetX: 40,
  },
  legend: {
    show: true,
    position: "bottom",
    horizontalAlign: "center",
  },
  plotOptions: {
    bar: {
      columnWidth: "20%",
    },
  },
});
const chartSeries = ref([]);
const topErrors = ref([]);
const chartVisibility = ref(false);

const columns = ref([{ name: "error", label: "Erreur", field: "error" }]);
for (let i = 1; i <= 7; i++) {
  columns.value.push({
    name: `day${i}`,
    label: dayjs()
      .subtract(8 - i, "day")
      .format("DD/MM"),
    field: `day${i}`,
  });
}

const getData = async () => {
  chartSeries.value = [];
  const errorsByThousand = await api.get(
    `/kpi/charts/thousand-trays-number/${props.group.groupName}`
  );
  const errorsFromLastSevenDays = await api.get(
    `/kpi/charts/alarms-by-group/${props.group.groupName}`
  );
  console.table(errorsFromLastSevenDays.data);
  topErrors.value = getTop10AlarmsWithDailyBreakdown(
    errorsFromLastSevenDays.data
  );

  chartSeries.value.push(
    {
      name: "Pannes / 1000 trays (nombre)",
      type: "column",
      data: errorsByThousand.data.map((item) => item.number.toFixed(2)),
    },
    {
      name: "Panne / 1000 trays (temps)",
      type: "column",
      data: errorsByThousand.data.map((item) => item.time),
    },
    {
      name: "Moyenne 7 jours (nombre)",
      type: "line",
      data: errorsByThousand.data.map((item) => item.movingAverage),
      color: "#C10015",
    }
  );
  chartOptions.value.xaxis = {
    categories: errorsByThousand.data.map((item) =>
      dayjs(item.date).format("YYYY-MM-DD")
    ),
    labels: {
      show: true,
      rotate: -90,
      rotateAlways: true,
      formatter: (value) => {
        return dayjs(value).format("DD/MM");
      },
    },
  };
  chartOptions.value.yaxis = [
    {
      seriesName: "Pannes / 1000 trays (nombre)",
      axisTicks: {
        show: true,
      },
      axisBorder: {
        show: true,
      },
      title: {
        text: "Nombre de pannes / 1000 trays",
      },
    },
    {
      seriesName: "Pannes / 1000 trays (nombre)",
      show: false,
    },
    {
      opposite: true,
      seriesName: "Moyenne mobile 7 jours",
      axisTicks: {
        show: true,
      },
      axisBorder: {
        show: true,
      },
      title: {
        text: "Moyenne mobile 7 jours",
      },
    },
  ];
  chartVisibility.value = true;
};

const getTop10AlarmsWithDailyBreakdown = (weeklyData) => {
  const alarmAggregation = new Map();

  // Créer un array des dates pour référence
  const dates = weeklyData.map((dayData) => dayData.date).sort();

  // Première passe : agréger pour identifier le top 10
  weeklyData.forEach((dayData) => {
    dayData.alarms.forEach((alarm) => {
      const alarmId = alarm.alarmId;

      if (alarmAggregation.has(alarmId)) {
        const existing = alarmAggregation.get(alarmId);
        existing.totalCount += alarm.count;
      } else {
        alarmAggregation.set(alarmId, {
          alarmId: alarm.alarmId,
          alarmText: alarm.alarmText,
          alarmCode: alarm.alarmCode,
          alarmArea: alarm.alarmArea,
          dataSource: alarm.dataSource,
          totalCount: alarm.count,
          dailyBreakdown: {},
        });
      }
    });
  });

  // Identifier le top 10
  const top10AlarmIds = Array.from(alarmAggregation.values())
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 10)
    .map((alarm) => alarm.alarmId);

  // Deuxième passe : créer le breakdown quotidien pour le top 10
  const result = top10AlarmIds.map((alarmId) => {
    const alarmInfo = alarmAggregation.get(alarmId);

    // Initialiser tous les jours à 0
    const dailyBreakdown = {};
    dates.forEach((date) => {
      dailyBreakdown[date] = 0;
    });
    console.log("dailyBreakdown", dailyBreakdown);

    // Remplir avec les vraies valeurs
    weeklyData.forEach((dayData) => {
      const alarmForDay = dayData.alarms.find(
        (alarm) => alarm.alarmId === alarmId
      );
      if (alarmForDay) {
        dailyBreakdown[dayData.date] = alarmForDay.count;
        console.log(dailyBreakdown, alarmForDay);
      }
    });

    return {
      alarmId: alarmInfo.alarmId,
      alarmText: alarmInfo.alarmText,
      alarmCode: alarmInfo.alarmCode,
      alarmArea: alarmInfo.alarmArea,
      dataSource: alarmInfo.dataSource,
      totalCount: alarmInfo.totalCount,
      dailyBreakdown: dailyBreakdown,
    };
  });

  return result;
};

getData();
</script>

<style></style>
