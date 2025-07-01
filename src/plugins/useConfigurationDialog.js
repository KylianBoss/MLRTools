import { Dialog } from "quasar";
import ConfigurationDialog from "components/dialogs/ConfigurationDialog.vue";

export function useConfigurationDialog() {
  const askForConfigFile = () => {
    return new Promise((resolve, reject) => {
      Dialog.create({
        component: ConfigurationDialog,
        componentProps: {
          resolve,
          reject,
        },
        persistent: true,
      }).onOk((result) => {
        resolve(result);
      });
    });
  };

  return {
    askForConfigFile,
  };
}
