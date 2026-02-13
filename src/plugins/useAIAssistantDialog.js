import { ref } from 'vue';

const showDialog = ref(false);

export function useAIAssistantDialog() {
  const openDialog = () => {
    showDialog.value = true;
  };

  const closeDialog = () => {
    showDialog.value = false;
  };

  return {
    showDialog,
    openDialog,
    closeDialog,
  };
}
