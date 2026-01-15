<template>
  <q-page class="q-pa-md">
    <div class="row q-col-gutter-md">
      <div class="col-12">
        <q-card>
          <q-card-section class="bg-primary text-white">
            <div class="text-h6">Console d'Exécution de Code</div>
            <div class="text-caption">
              Exécutez du code JavaScript côté serveur avec accès en LECTURE
              SEULE à la base de données (db, Op, dayjs disponibles)
            </div>
            <div class="text-caption text-warning q-mt-xs">
              ⚠️ Les opérations UPDATE, DELETE, CREATE et INSERT sont interdites
            </div>
          </q-card-section>

          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">
              Code à exécuter:
              <span class="text-caption text-grey-7 q-ml-sm">
                (Ctrl+Enter pour exécuter)
              </span>
            </div>
            <div ref="editorContainer" class="editor-container"></div>

            <div class="q-mt-md">
              <q-btn
                color="primary"
                label="Exécuter"
                icon="play_arrow"
                @click="executeCode"
                :loading="loading"
              />
              <q-btn
                flat
                color="grey"
                label="Effacer"
                icon="clear"
                @click="clearCode"
                class="q-ml-sm"
              />
              <q-btn
                flat
                color="grey"
                label="Effacer Résultat"
                icon="delete_sweep"
                @click="clearResult"
                class="q-ml-sm"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12" v-if="result || error">
        <q-card>
          <q-card-section class="bg-grey-3">
            <div class="text-h6">
              <q-icon
                :name="error ? 'error' : 'check_circle'"
                :color="error ? 'negative' : 'positive'"
                class="q-mr-sm"
              />
              {{ error ? "Erreur" : "Résultat" }}
            </div>
            <div class="text-caption">
              Temps d'exécution: {{ executionTime }}ms
            </div>
          </q-card-section>

          <q-card-section>
            <div v-if="error" class="text-negative">
              <pre class="result-pre">{{ error }}</pre>
            </div>
            <div v-else>
              <pre class="result-pre">{{ formattedResult }}</pre>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { api } from "boot/axios";
import { useQuasar } from "quasar";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  autocompletion,
  completeFromList,
  CompletionContext,
} from "@codemirror/autocomplete";
import { basicSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { indentOnInput } from "@codemirror/language";

const $q = useQuasar();

const editorContainer = ref(null);
const result = ref(null);
const error = ref(null);
const loading = ref(false);
const executionTime = ref(0);
const dbModels = ref([]);

let editorView = null;

// Charger les models de la base de données
const loadModels = async () => {
  try {
    const response = await api.get("/db/models");
    dbModels.value = response.data.models;
  } catch (err) {
    console.error("Erreur lors du chargement des models:", err);
  }
};

// Autocomplétion personnalisée pour les objets disponibles
const customCompletions = (context) => {
  const word = context.matchBefore(/\w*/);

  // Vérifier si on est après "db.models."
  const textBefore = context.state.doc.sliceString(
    Math.max(0, context.pos - 20),
    context.pos
  );
  const isAfterDbModels = /db\.models\.\w*$/.test(textBefore);

  if (isAfterDbModels) {
    // Si on est après "db.models.", proposer uniquement les noms de models
    const modelMatch = context.matchBefore(/db\.models\.(\w*)/);
    if (modelMatch) {
      const completions = dbModels.value.map((model) => ({
        label: model,
        type: "class",
        info: `Model ${model} from database`,
      }));

      return {
        from: modelMatch.from + 10, // Position après "db.models."
        options: completions,
      };
    }
  }

  if (!word || (word.from === word.to && !context.explicit)) {
    return null;
  }

  const completions = [
    // db models communs
    { label: "db.models", type: "variable", info: "Sequelize models" },
    {
      label: "db.query",
      type: "function",
      info: "Execute raw SQL query (READ ONLY)",
    },
    { label: "db.QueryTypes", type: "constant", info: "Query types" },
    {
      label: "db.QueryTypes.SELECT",
      type: "constant",
      info: "SELECT query type",
    },
    // Sequelize methods (READ ONLY)
    { label: "findAll", type: "function", info: "Find all records (READ)" },
    { label: "findOne", type: "function", info: "Find one record (READ)" },
    { label: "findByPk", type: "function", info: "Find by primary key (READ)" },
    {
      label: "findAndCountAll",
      type: "function",
      info: "Find and count (READ)",
    },
    { label: "count", type: "function", info: "Count records (READ)" },
    { label: "sum", type: "function", info: "Sum values (READ)" },
    { label: "min", type: "function", info: "Minimum value (READ)" },
    { label: "max", type: "function", info: "Maximum value (READ)" },
    // Query options
    { label: "where", type: "property", info: "Where clause" },
    { label: "attributes", type: "property", info: "Select attributes" },
    { label: "include", type: "property", info: "Include associations" },
    { label: "order", type: "property", info: "Order results" },
    { label: "limit", type: "property", info: "Limit results" },
    { label: "offset", type: "property", info: "Offset results" },
    { label: "raw", type: "property", info: "Return raw results" },
    { label: "group", type: "property", info: "Group by clause" },
    { label: "having", type: "property", info: "Having clause" },
    { label: "distinct", type: "property", info: "Distinct values" },
    // Operators
    { label: "Op", type: "variable", info: "Sequelize operators" },
    { label: "Op.eq", type: "constant", info: "Equal" },
    { label: "Op.ne", type: "constant", info: "Not equal" },
    { label: "Op.gt", type: "constant", info: "Greater than" },
    { label: "Op.gte", type: "constant", info: "Greater than or equal" },
    { label: "Op.lt", type: "constant", info: "Less than" },
    { label: "Op.lte", type: "constant", info: "Less than or equal" },
    { label: "Op.like", type: "constant", info: "Like pattern" },
    { label: "Op.in", type: "constant", info: "In array" },
    { label: "Op.notIn", type: "constant", info: "Not in array" },
    { label: "Op.between", type: "constant", info: "Between values" },
    { label: "Op.and", type: "constant", info: "AND condition" },
    { label: "Op.or", type: "constant", info: "OR condition" },
    { label: "Op.is", type: "constant", info: "IS (for NULL)" },
    { label: "Op.not", type: "constant", info: "NOT" },
    // dayjs
    { label: "dayjs", type: "function", info: "Day.js date manipulation" },
    { label: "dayjs()", type: "function", info: "Current date" },
    {
      label: "dayjs().format()",
      type: "function",
      info: "Format date string",
    },
    { label: "dayjs().startOf()", type: "function", info: "Start of period" },
    { label: "dayjs().endOf()", type: "function", info: "End of period" },
    { label: "dayjs().add()", type: "function", info: "Add time" },
    { label: "dayjs().subtract()", type: "function", info: "Subtract time" },
  ];

  return {
    from: word.from,
    options: completions,
  };
};

onMounted(async () => {
  // Charger les models de la base de données
  await loadModels();

  if (!editorContainer.value) return;

  const startState = EditorState.create({
    doc: "db.models.ZoneData.findAll({\n  limit: 10,\n  raw: true\n});",
    extensions: [
      basicSetup,
      javascript(),
      oneDark,
      indentOnInput(),
      autocompletion({
        override: [customCompletions],
      }),
      keymap.of([
        indentWithTab,
        {
          key: "Ctrl-Enter",
          run: () => {
            executeCode();
            return true;
          },
        },
        {
          key: "Cmd-Enter",
          run: () => {
            executeCode();
            return true;
          },
        },
      ]),
      EditorView.lineWrapping,
    ],
  });

  editorView = new EditorView({
    state: startState,
    parent: editorContainer.value,
  });
});

onBeforeUnmount(() => {
  if (editorView) {
    editorView.destroy();
  }
});

const getCode = () => {
  if (!editorView) return "";
  return editorView.state.doc.toString();
};

const executeCode = async () => {
  const code = getCode();
  if (!code.trim()) {
    return;
  }

  loading.value = true;
  result.value = null;
  error.value = null;
  executionTime.value = 0;

  try {
    const startTime = Date.now();
    const response = await api.post("/db/execute-code", {
      code: code,
    });
    const endTime = Date.now();

    executionTime.value = endTime - startTime;
    result.value = response.data.result;

    $q.notify({
      type: "positive",
      message: "Code exécuté avec succès",
      position: "top-right",
    });
  } catch (err) {
    executionTime.value = 0;
    error.value = err.response?.data?.error || err.message;

    $q.notify({
      type: "negative",
      message: "Erreur lors de l'exécution",
      position: "top-right",
    });
  } finally {
    loading.value = false;
  }
};

const clearCode = () => {
  if (editorView) {
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: "",
      },
    });
  }
};

const clearResult = () => {
  result.value = null;
  error.value = null;
  executionTime.value = 0;
};

const formattedResult = computed(() => {
  if (result.value === null || result.value === undefined) {
    return "null";
  }
  return JSON.stringify(result.value, null, 2);
});
</script>

<script>
export default {
  name: "CommandTool",
};
</script>

<style scoped>
.editor-container {
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow: hidden;
  min-height: 200px;
}

.editor-container :deep(.cm-editor) {
  height: auto;
  min-height: 200px;
}

.editor-container :deep(.cm-scroller) {
  font-family: "Consolas", "Monaco", "Courier New", monospace;
  font-size: 14px;
  line-height: 1.6;
}

.editor-container :deep(.cm-content) {
  padding: 8px 0;
}

.result-pre {
  background-color: #f5f5f5;
  padding: 16px;
  border-radius: 4px;
  overflow-x: auto;
  font-family: "Consolas", "Monaco", "Courier New", monospace;
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
