import { Dialog } from "quasar";
import InterventionTimerStopDialog from "src/components/dialogs/InterventionTimerStopDialog.vue";

export function useInterventionTimerStopDialog() {
  const openTimerStopDialog = ({
    timerForm,
    displayTime,
    onCancel,
    locations,
  }) => {
    return new Promise((resolve) => {
      Dialog.create({
        component: InterventionTimerStopDialog,
        componentProps: {
          timerForm,
          displayTime,
          locations: locations || [],
        },
        persistent: true,
      })
        .onOk((data) => resolve(data))
        .onCancel(() => {
          if (onCancel) {
            onCancel();
          }
          resolve(null);
        });
    });
  };

  return {
    openTimerStopDialog,
  };
}
