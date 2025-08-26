import { Dialog } from "quasar";
import DefectDialog from "src/components/dialogs/DefectDialog.vue";

export function useDefectDialog() {
  const open = (defectData) => {
    return new Promise((resolve, reject) => {
      Dialog.create({
        component: DefectDialog,
        componentProps: {
          resolve,
          reject,
          defectData,
        },
        persistent: true,
      }).onOk((result) => {
        resolve(result);
      });
    });
  };

  return {
    open,
  };
}
