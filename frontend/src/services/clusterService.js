import api from './api';

const clusterService = {
  getByDepartment: async (departmentId, includeInactive = false) => {
    const response = await api.get(`/api/clusters?department=${departmentId}&includeInactive=${includeInactive}`);
    return response.data;
  },

  create: async (clusterData) => {
    const response = await api.post('/api/clusters', clusterData);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/api/clusters/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/api/clusters/${id}`);
    return response.data;
  },
};

export default clusterService;