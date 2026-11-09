import api from './api';

const settingsService = {
  get: async () => {
    const response = await api.get('/api/settings');
    return response.data;
  },

  update: async (settingsData) => {
    const response = await api.put('/api/settings', settingsData);
    return response.data;
  },
};

export default settingsService;