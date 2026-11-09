import api from './api';

const exportService = {
  exportEvents: async (filters = {}, format = 'CSV') => {
    const params = new URLSearchParams({ format, ...filters });
    const response = await api.get(`/api/export/events?${params}`, {
      responseType: 'blob',
    });
    return response;
  },

  exportNewsletters: async (filters = {}, format = 'CSV') => {
    const params = new URLSearchParams({ format, ...filters });
    const response = await api.get(`/api/export/newsletters?${params}`, {
      responseType: 'blob',
    });
    return response;
  },

  exportPublications: async (filters = {}, format = 'CSV') => {
    const params = new URLSearchParams({ format, ...filters });
    const response = await api.get(`/api/export/publications?${params}`, {
      responseType: 'blob',
    });
    return response;
  },

  exportPatents: async (filters = {}, format = 'CSV') => {
    const params = new URLSearchParams({ format, ...filters });
    const response = await api.get(`/api/export/patents?${params}`, {
      responseType: 'blob',
    });
    return response;
  },

  exportFacultyAchievements: async (filters = {}, format = 'CSV') => {
    const params = new URLSearchParams({ format, ...filters });
    const response = await api.get(`/api/export/faculty-achievements?${params}`, {
      responseType: 'blob',
    });
    return response;
  },

  exportNptelCourses: async (filters = {}, format = 'CSV') => {
    const params = new URLSearchParams({ format, ...filters });
    const response = await api.get(`/api/export/nptel-courses?${params}`, {
      responseType: 'blob',
    });
    return response;
  },

  downloadFile: (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

export default exportService;