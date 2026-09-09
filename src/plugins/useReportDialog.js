import { Dialog } from "quasar";
import ReportDialog from "src/components/dialogs/ReportDialog.vue";

export function useReportDialog() {
  const askForReport = (reportData) => {
    return new Promise((resolve, reject) => {
      Dialog.create({
        component: ReportDialog,
        componentProps: {
          resolve,
          reject,
          reportData,
        },
        persistent: true,
      }).onOk((result) => {
        resolve(result);
      });
    });
  };

  return {
    askForReport,
  };
}
