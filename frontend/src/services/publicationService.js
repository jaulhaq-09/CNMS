import api from './api';

const publicationService = {
  create: async (publicationData) => {
    const response = await api.post('/api/publications', publicationData);
    return response.data;
  },

  getAll: async (filters = {}, page = 1, limit = 10) => {
    const params = new URLSearchParams({ page, limit, ...filters });
    const response = await api.get(`/api/publications?${params}`);
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/api/publications/${id}`);
    return response.data;
  },

  update: async (id, publicationData) => {
    const response = await api.put(`/api/publications/${id}`, publicationData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/api/publications/${id}`);
    return response.data;
  },

  submit: async (id) => {
    const response = await api.post(`/api/publications/${id}/submit`);
    return response.data;
  },

  approve: async (id, feedback = '') => {
    const response = await api.post(`/api/publications/${id}/approve`, { feedback });
    return response.data;
  },

  reject: async (id, feedback) => {
    const response = await api.post(`/api/publications/${id}/reject`, { feedback });
    return response.data;
  },
};

export default publicationService;