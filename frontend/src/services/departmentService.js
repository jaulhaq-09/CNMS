import api from './api';

const departmentService = {
  getAll: async (includeInactive = false) => {
    const response = await api.get(`/api/departments?includeInactive=${includeInactive}`);
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/api/departments/${id}`);
    return response.data;
  },

  create: async (departmentData) => {
    const response = await api.post('/api/departments', departmentData);
    return response.data;
  },

  update: async (id, departmentData) => {
    const response = await api.put(`/api/departments/${id}`, departmentData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/api/departments/${id}`);
    return response.data;
  },

  deletePermanent: async (id) => {
    const response = await api.delete(`/api/departments/${id}/permanent`);
    return response.data;
  },
};

export default departmentService;