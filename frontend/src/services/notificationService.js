import api from './api';

const notificationService = {
  getAll: async (page = 1, limit = 20, filters = {}) => {
    const params = new URLSearchParams({
      page,
      limit,
      ...filters,
    });
    const response = await api.get(`/api/notifications?${params}`);
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/api/notifications/${id}`);
    return response.data;
  },

  markAsRead: async (id) => {
    const response = await api.put(`/api/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.put('/api/notifications/read/all');
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/api/notifications/${id}`);
    return response.data;
  },

  deleteAll: async () => {
    const response = await api.delete('/api/notifications');
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get('/api/notifications/count/unread');
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/api/notifications/stats/overview');
    return response.data;
  },
};

export default notificationService;