import api from './api';

const userService = {
  getAll: async (filters = {}, page = 1, limit = 20) => {
    const params = new URLSearchParams({
      page,
      limit,
      ...filters,
    });
    const response = await api.get(`/api/users?${params}`);
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/api/users/${id}`);
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await api.put('/api/users/profile', profileData);
    return response.data;
  },

  uploadProfilePhoto: async (file) => {
    const formData = new FormData();
    formData.append('photo', file);
    const response = await api.post('/api/users/profile/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  create: async (userData) => {
    const response = await api.post('/api/users', userData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/api/users/${id}`);
    return response.data;
  },

  updateAccess: async (id, accessData) => {
    const response = await api.put(`/api/users/${id}/access`, accessData);
    return response.data;
  },

  // Admin edits a person's name or login email.
  updateDetails: async (id, details) => {
    const response = await api.put(`/api/users/${id}/details`, details);
    return response.data;
  },

  // ---- Users page: tab counts and bulk role assignment (Admin) ----
  getSummary: async () => {
    const response = await api.get('/api/users/summary');
    return response.data;
  },

  bulkUpdateAccess: async (payload) => {
    const response = await api.put('/api/users/bulk-access', payload);
    return response.data;
  },

  // ---- Excel import (Admin) ----
  downloadImportTemplate: async () => {
    const response = await api.get('/api/user-import/template', { responseType: 'blob' });
    return response.data;
  },

  previewImport: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/user-import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  startImport: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/user-import/start', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  importStatus: async (batchId) => {
    const response = await api.get(`/api/user-import/status/${batchId}`);
    return response.data;
  },

  updateRoles: async (id, roles) => {
    const response = await api.put(`/api/users/${id}/roles`, { roles });
    return response.data;
  },
};

export default userService;