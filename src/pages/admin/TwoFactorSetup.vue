<template>
  <q-page padding>
    <div class="row justify-center">
      <div class="col-12 col-md-8 col-lg-6">
        <q-card>
          <q-card-section>
            <div class="text-h5 q-mb-md">Configuration 2FA</div>
            <div class="text-body1 q-mb-lg">
              Configurez l'authentification à deux facteurs pour sécuriser les
              actions sensibles dans l'application.
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section v-if="loading" class="text-center">
            <q-spinner color="primary" size="3em" />
            <div class="q-mt-md">Chargement...</div>
          </q-card-section>

          <q-card-section v-else-if="error" class="text-center">
            <q-icon name="error" color="negative" size="3em" />
            <div class="text-negative q-mt-md">{{ error }}</div>
            <q-btn
              label="Réessayer"
              color="primary"
              flat
              @click="loadSetup"
              class="q-mt-md"
            />
          </q-card-section>

          <q-card-section v-else>
            <div class="text-h6 q-mb-md">Étape 1: Scanner le QR Code</div>
            <div class="text-body2 q-mb-md">
              Ouvrez votre application Google Authenticator et scannez ce QR
              code:
            </div>

            <div class="row justify-center q-mb-lg">
              <div style="background: white; padding: 20px; border-radius: 8px">
                <img :src="qrCode" alt="QR Code 2FA" style="display: block" />
              </div>
            </div>

            <q-separator class="q-my-lg" />

            <div class="text-h6 q-mb-md">
              Étape 2: Configuration manuelle (optionnel)
            </div>
            <div class="text-body2 q-mb-md">
              Si vous ne pouvez pas scanner le QR code, entrez cette clé
              manuellement:
            </div>

            <q-input
              :model-value="secret"
              readonly
              outlined
              label="Clé secrète"
              class="q-mb-md"
            >
              <template v-slot:append>
                <q-btn
                  flat
                  dense
                  icon="content_copy"
                  @click="copySecret"
                  color="primary"
                >
                  <q-tooltip>Copier</q-tooltip>
                </q-btn>
              </template>
            </q-input>

            <q-separator class="q-my-lg" />

            <div class="text-h6 q-mb-md">Étape 3: Tester la configuration</div>
            <div class="text-body2 q-mb-md">
              Entrez le code à 6 chiffres affiché dans votre application:
            </div>

            <div class="row q-gutter-sm items-center">
              <q-input
                v-model="testCode"
                outlined
                label="Code 2FA"
                mask="### ###"
                placeholder="000 000"
                style="width: 200px"
                :error="testError"
                :error-message="testErrorMessage"
              />
              <q-btn
                label="Vérifier"
                color="primary"
                @click="verifyTest"
                :disable="testCode.replace(/\s/g, '').length !== 6"
                :loading="testLoading"
              />
            </div>

            <q-banner
              v-if="testSuccess"
              class="bg-positive text-white q-mt-md"
              rounded
            >
              <template v-slot:avatar>
                <q-icon name="check_circle" />
              </template>
              Configuration réussie! Vous pouvez maintenant utiliser
              l'authentification 2FA.
            </q-banner>
          </q-card-section>

          <q-separator />

          <q-card-section>
            <div class="text-caption text-grey-7">
              <strong>Note:</strong> Conservez cette clé secrète dans un endroit
              sûr. Vous en aurez besoin si vous devez reconfigurer votre
              authentificateur.
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { api } from "boot/axios";
import { Notify, copyToClipboard } from "quasar";

const loading = ref(true);
const error = ref("");
const qrCode = ref("");
const secret = ref("");
const testCode = ref("");
const testError = ref(false);
const testErrorMessage = ref("");
const testLoading = ref(false);
const testSuccess = ref(false);

const loadSetup = async () => {
  loading.value = true;
  error.value = "";

  try {
    const response = await api.get("/auth/2fa/setup");
    qrCode.value = response.data.qrCode;
    secret.value = response.data.secret;
  } catch (err) {
    error.value =
      err.response?.data?.error || err.message || "Erreur lors du chargement";
  } finally {
    loading.value = false;
  }
};

const copySecret = () => {
  copyToClipboard(secret.value)
    .then(() => {
      Notify.create({
        type: "positive",
        message: "Clé secrète copiée dans le presse-papiers",
        position: "top",
      });
    })
    .catch(() => {
      Notify.create({
        type: "negative",
        message: "Erreur lors de la copie",
        position: "top",
      });
    });
};

const verifyTest = async () => {
  testLoading.value = true;
  testError.value = false;
  testErrorMessage.value = "";
  testSuccess.value = false;

  try {
    const code = testCode.value.replace(/\s/g, "");

    // Faire un appel de test à une route protégée
    await api.post(
      "/db/execute-code-override",
      { code: "db.models.Users.count()" },
      {
        headers: {
          "x-totp-code": code,
        },
      }
    );

    testSuccess.value = true;
    Notify.create({
      type: "positive",
      message: "Code 2FA valide!",
      position: "top",
    });
  } catch (err) {
    testError.value = true;
    if (err.response?.status === 401) {
      testErrorMessage.value = "Code 2FA invalide";
    } else {
      testErrorMessage.value =
        err.response?.data?.error || "Erreur lors de la vérification";
    }
  } finally {
    testLoading.value = false;
  }
};

onMounted(() => {
  loadSetup();
});
</script>
