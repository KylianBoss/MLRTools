import { Dialog } from "quasar";
import ProductionDataDialog from "src/components/dialogs/ProductionDataDialog.vue";

export function useProductionDataDialog() {
  const createProductionData = () => {
    return new Promise((resolve, reject) => {
      Dialog.create({
        component: ProductionDataDialog,
        componentProps: {
          resolve,
          reject,
        },
        persistent: true,
      })
        .onOk((result) => {
          resolve(result);
        })
        .onCancel(() => {
          reject();
        });
    });
  };

  return {
    createProductionData,
  };
}
