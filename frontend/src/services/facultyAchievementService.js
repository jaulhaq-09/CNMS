import api from './api';

const facultyAchievementService = {
  create: async (data) => {
    const response = await api.post('/api/faculty-achievements', data);
    return response.data;
  },
  getAll: async (filters = {}, page = 1, limit = 10) => {
    const params = new URLSearchParams({ page, limit, ...filters });
    const response = await api.get(`/api/faculty-achievements?${params}`);
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/api/faculty-achievements/${id}`);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/api/faculty-achievements/${id}`, data);
    return response.data;
  },
  submit: async (id) => {
    const response = await api.post(`/api/faculty-achievements/${id}/submit`);
    return response.data;
  },
  approve: async (id, feedback = '') => {
    const response = await api.post(`/api/faculty-achievements/${id}/approve`, { feedback });
    return response.data;
  },
  reject: async (id, feedback) => {
    const response = await api.post(`/api/faculty-achievements/${id}/reject`, { feedback });
    return response.data;
  },
};

export default facultyAchievementService;