import { defineStore } from "pinia";
import { api } from "boot/axios";

const errorMessage = (error) => error.response?.data?.error || error.message;

export const useStingraysStore = defineStore("stingrays", {
  state: () => ({
    stingrays: [],
    aisles: [],
    loading: false,
  }),
  actions: {
    async fetchStingrays(params = {}) {
      this.loading = true;
      try {
        const response = await api.get("/stingrays", { params });
        this.stingrays = response.data;
        return this.stingrays;
      } catch (error) {
        throw new Error(errorMessage(error));
      } finally {
        this.loading = false;
      }
    },
    async fetchStingray(id) {
      try {
        const response = await api.get(`/stingrays/${id}`);
        return response.data;
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
    async fetchStingrayByNumber(number) {
      try {
        const response = await api.get(`/stingrays/by-number/${number}`);
        return response.data;
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
    async createStingray(payload) {
      try {
        const response = await api.post("/stingrays", payload);
        return response.data;
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
    async updateStingray(id, payload) {
      try {
        const response = await api.patch(`/stingrays/${id}`, payload);
        return response.data;
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
    async fetchAisles(excludeStingrayId = null) {
      try {
        const response = await api.get("/stingrays/aisles", {
          params: excludeStingrayId ? { excludeStingrayId } : {},
        });
        this.aisles = response.data;
        return this.aisles;
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
    async fetchOccupiedFloors(aisleId, excludeStingrayId = null) {
      try {
        const response = await api.get(
          `/stingrays/aisles/${aisleId}/occupied-floors`,
          { params: excludeStingrayId ? { excludeStingrayId } : {} }
        );
        return response.data;
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
    async fetchPositionHistory(id) {
      try {
        const response = await api.get(`/stingrays/${id}/position-history`);
        return response.data;
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
    async addPosition(id, payload) {
      try {
        const response = await api.post(
          `/stingrays/${id}/position-history`,
          payload
        );
        return response.data;
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
    async fetchInterventions(id) {
      try {
        const response = await api.get(`/stingrays/${id}/interventions`);
        return response.data;
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
    async fetchAlarmSettings() {
      try {
        const response = await api.get("/stingrays/alarm-settings");
        return response.data;
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
    async updateAlarmSettings(payload) {
      try {
        const response = await api.patch("/stingrays/alarm-settings", payload);
        return response.data;
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
  },
  persist: false,
});
