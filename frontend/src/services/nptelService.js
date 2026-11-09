import api from './api';

const nptelService = {
  create: async (courseData) => {
    const response = await api.post('/api/nptel-courses', courseData);
    return response.data;
  },

  getAll: async (filters = {}, page = 1, limit = 10) => {
    const params = new URLSearchParams({ page, limit, ...filters });
    const response = await api.get(`/api/nptel-courses?${params}`);
    return response.data;
  },

  update: async (id, courseData) => {
    const response = await api.put(`/api/nptel-courses/${id}`, courseData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/api/nptel-courses/${id}`);
    return response.data;
  },

  uploadCertificate: async (id, file) => {
    const formData = new FormData();
    formData.append('certificate', file);
    const response = await api.post(`/api/nptel-courses/${id}/certificate`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export default nptelService;