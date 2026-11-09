import api from './api';

const templateService = {
  create: async (templateData) => {
    const response = await api.post('/api/templates', templateData);
    return response.data;
  },

  getAll: async (filters = {}, page = 1, limit = 10) => {
    const params = new URLSearchParams({
      page,
      limit,
      ...filters,
    });
    const response = await api.get(`/api/templates?${params}`);
    return response.data;
  },

  getPublic: async () => {
    const response = await api.get('/api/templates/public');
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/api/templates/${id}`);
    return response.data;
  },

  update: async (id, templateData) => {
    const response = await api.put(`/api/templates/${id}`, templateData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/api/templates/${id}`);
    return response.data;
  },

  duplicate: async (id) => {
    const response = await api.post(`/api/templates/${id}/duplicate`);
    return response.data;
  },

  publish: async (id) => {
    const response = await api.post(`/api/templates/${id}/publish`);
    return response.data;
  },
  setAsMprTemplate: async (id) => {
    const response = await api.post(`/api/templates/${id}/set-mpr-template`);
    return response.data;
  },
  unsetMprTemplate: async (id) => {
    const response = await api.post(`/api/templates/${id}/unset-mpr-template`);
    return response.data;
  },
};

export default templateService;