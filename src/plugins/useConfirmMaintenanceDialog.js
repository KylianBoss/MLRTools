import { Dialog } from "quasar";
import ConfirmMaintenanceDialog from "src/components/dialogs/ConfirmMaintenanceDialog.vue";

export function useConfirmMaintenanceDialog() {
  const askForConfirmation = (maintenanceData) => {
    return new Promise((resolve, reject) => {
      Dialog.create({
        component: ConfirmMaintenanceDialog,
        componentProps: {
          resolve,
          reject,
          maintenanceData,
        },
        persistent: true,
      }).onOk((result) => {
        resolve(result);
      });
    });
  };

  return {
    askForConfirmation,
  };
}
