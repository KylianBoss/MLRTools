import { Dialog } from "quasar";
import InterventionEditDialog from "src/components/dialogs/InterventionEditDialog.vue";

export function useInterventionEditDialog() {
  const openEditDialog = ({ intervention, locations }) => {
    return new Promise((resolve) => {
      Dialog.create({
        component: InterventionEditDialog,
        componentProps: {
          intervention,
          locations: locations || [],
        },
        persistent: true,
      })
        .onOk((data) => resolve(data))
        .onCancel(() => resolve(null));
    });
  };

  return {
    openEditDialog,
  };
}
