import { Dialog } from "quasar";
import ChartDialog from "src/components/dialogs/ChartDialog.vue";

export function useChartDialog() {
  const askForChart = (chartData) => {
    return new Promise((resolve, reject) => {
      Dialog.create({
        component: ChartDialog,
        componentProps: {
          resolve,
          reject,
          chartData,
        },
        persistent: true,
      }).onOk((result) => {
        resolve(result);
      });
    });
  };

  return {
    askForChart,
  };
}
