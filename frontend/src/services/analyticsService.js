import api from './api';

const analyticsService = {
  getDashboard: async (days = 30) => {
    const response = await api.get(`/api/analytics/dashboard?days=${days}`);
    return response.data;
  },

  getEventAnalytics: async (days = 30) => {
    const response = await api.get(`/api/analytics/events?days=${days}`);
    return response.data;
  },

  getNewsletterAnalytics: async (days = 30) => {
    const response = await api.get(`/api/analytics/newsletters?days=${days}`);
    return response.data;
  },

  getUserAnalytics: async (days = 30) => {
    const response = await api.get(`/api/analytics/users?days=${days}`);
    return response.data;
  },
};

export default analyticsService;