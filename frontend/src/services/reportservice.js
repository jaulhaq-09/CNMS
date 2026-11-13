import api from './api';

const reportService = {
  create: async (reportData) => {
    const response = await api.post('/api/reports', reportData);
    return response.data;
  },

  getAll: async (page = 1, limit = 10) => {
    const params = new URLSearchParams({ page, limit });
    const response = await api.get(`/api/reports?${params}`);
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/api/reports/${id}`);
    return response.data;
  },

  update: async (id, reportData) => {
    const response = await api.put(`/api/reports/${id}`, reportData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/api/reports/${id}`);
    return response.data;
  },

  // FIXED: the backend route is `router.post('/:id/generate', ...)`, but
  // this was calling api.get() — a GET request against a POST-only route
  // falls through Express straight to the 404 handler, which is exactly
  // the "404 Not Found" the browser console was showing. Switched to
  // api.post() to match how the backend actually registered the route.
  generate: async (id) => {
    const response = await api.post(
      `/api/reports/${id}/generate`,
      {},
      { responseType: 'blob' }
    )
    return response
  },

  emailMe: async (id) => {
    const response = await api.post(`/api/reports/${id}/email-me`);
    return response.data;
  },
  schedule: async (id, scheduleData) => {
    const response = await api.post(`/api/reports/${id}/schedule`, scheduleData);
    return response.data;
  },

  unschedule: async (id) => {
    const response = await api.post(`/api/reports/${id}/unschedule`);
    return response.data;
  },

  getApprovedActivities: async (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    ).toString();
    const response = await api.get(`/api/reports/coordinator/approved-activities${query ? `?${query}` : ''}`);
    return response.data;
  },

  forwardClusterReport: async (payload) => {
    const response = await api.post('/api/reports/coordinator/forward', payload);
    return response.data;
  },

  getCoordinatorReports: async () => {
    const response = await api.get('/api/reports/admin/coordinator-reports');
    return response.data;
  },

  consolidateReports: async (payload) => {
    const response = await api.post('/api/reports/admin/consolidate', payload);
    return response.data;
  },
};

export default reportService;