import api from './api';

const newsletterService = {
  generate: async (startDate, endDate, templateId) => {
    const response = await api.post('/api/newsletters/generate', {
      startDate,
      endDate,
      templateId,
    });
    return response.data;
  },

  generateFromConsolidatedReport: async (reportId, templateId) => {
    const response = await api.post('/api/newsletters/from-consolidated-report', {
      reportId,
      templateId,
    });
    return response.data;
  },

  getAll: async (filters = {}, page = 1, limit = 10) => {
    const params = new URLSearchParams({
      page,
      limit,
      ...filters,
    });
    const response = await api.get(`/api/newsletters?${params}`);
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/api/newsletters/${id}`);
    return response.data;
  },

  schedule: async (id, scheduledFor) => {
    const response = await api.post(`/api/newsletters/${id}/schedule`, {
      scheduledFor,
    });
    return response.data;
  },

  publish: async (id) => {
    const response = await api.post(`/api/newsletters/${id}/publish`);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/api/newsletters/${id}`);
    return response.data;
  },
};

export default newsletterService;