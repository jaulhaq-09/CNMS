import api from './api';

const patentService = {
  create: async (data) => {
    const response = await api.post('/api/patents', data);
    return response.data;
  },
  getAll: async (filters = {}, page = 1, limit = 10) => {
    const params = new URLSearchParams({ page, limit, ...filters });
    const response = await api.get(`/api/patents?${params}`);
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/api/patents/${id}`);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/api/patents/${id}`, data);
    return response.data;
  },
  submit: async (id) => {
    const response = await api.post(`/api/patents/${id}/submit`);
    return response.data;
  },
  approve: async (id, feedback = '') => {
    const response = await api.post(`/api/patents/${id}/approve`, { feedback });
    return response.data;
  },
  reject: async (id, feedback) => {
    const response = await api.post(`/api/patents/${id}/reject`, { feedback });
    return response.data;
  },
};

export default patentService;