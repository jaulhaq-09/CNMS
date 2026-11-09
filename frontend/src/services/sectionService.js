import api from './api';

const sectionService = {
  getByCluster: async (clusterId, includeInactive = false) => {
    const response = await api.get(`/api/sections?cluster=${clusterId}&includeInactive=${includeInactive}`);
    return response.data;
  },

  create: async (sectionData) => {
    const response = await api.post('/api/sections', sectionData);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/api/sections/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/api/sections/${id}`);
    return response.data;
  },
};

export default sectionService;