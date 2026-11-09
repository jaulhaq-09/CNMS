import api from './api';

const eventService = {
  create: async (eventData) => {
    const response = await api.post('/api/events', eventData);
    return response.data;
  },

  getAll: async (filters = {}, page = 1, limit = 10) => {
    const params = new URLSearchParams({
      page,
      limit,
      ...filters,
    });
    const response = await api.get(`/api/events?${params}`);
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/api/events/${id}`);
    return response.data;
  },

  update: async (id, eventData) => {
    const response = await api.put(`/api/events/${id}`, eventData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/api/events/${id}`);
    return response.data;
  },

  uploadPhotos: async (id, files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('photos', file));
    const response = await api.post(`/api/events/${id}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  submit: async (id) => {
    const response = await api.post(`/api/events/${id}/submit`);
    return response.data;
  },

  approve: async (id, feedback = '') => {
    const response = await api.post(`/api/events/${id}/approve`, { feedback });
    return response.data;
  },

  reject: async (id, feedback) => {
    const response = await api.post(`/api/events/${id}/reject`, { feedback });
    return response.data;
  },
};

export default eventService;