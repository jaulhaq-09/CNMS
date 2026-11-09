import api from './api';

const auditService = {
  getAll: async (filters = {}, page = 1, limit = 20) => {
    const params = new URLSearchParams({ page, limit });
    // Skip empty filters so they are never sent as the text "undefined".
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.set(key, value);
    });
    const response = await api.get(`/api/audit-logs?${params}`);
    return response.data;
  },

  // People who appear in the log, for the "Performed by" filter.
  getActors: async () => {
    const response = await api.get('/api/audit-logs/actors');
    return response.data;
  },
};

export default auditService;