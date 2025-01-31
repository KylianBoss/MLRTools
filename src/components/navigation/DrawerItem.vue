<template>
  <q-item
    clickable
    v-ripple
    :to="{ name: to }"
    :active="$route.name == to"
    v-if="App.userHasAccess(autorisation)"
  >
    <q-item-section avatar>
      <q-icon :name="icon" />
    </q-item-section>
    <q-item-section>{{ label }}</q-item-section>
  </q-item>
</template>

<script setup>
import { useAppStore } from "src/stores/app";

const App = useAppStore();
const props = defineProps({
  to: String,
  autorisation: String,
  icon: String,
  label: String,
});
</script>

<style></style>
