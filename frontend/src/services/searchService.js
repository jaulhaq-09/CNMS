import api from './api';

const searchService = {
  globalSearch: async (query, filters = {}, page = 1, limit = 10) => {
    const params = new URLSearchParams({
      q: query,
      page,
      limit,
      ...filters,
    });
    const response = await api.get(`/api/search?${params}`);
    return response.data;
  },

  searchEvents: async (query, filters = {}, page = 1, limit = 10) => {
    const params = new URLSearchParams({
      q: query,
      page,
      limit,
      ...filters,
    });
    const response = await api.get(`/api/search/events?${params}`);
    return response.data;
  },

  searchNewsletters: async (query, filters = {}, page = 1, limit = 10) => {
    const params = new URLSearchParams({
      q: query,
      page,
      limit,
      ...filters,
    });
    const response = await api.get(`/api/search/newsletters?${params}`);
    return response.data;
  },

  searchTemplates: async (query, filters = {}, page = 1, limit = 10) => {
    const params = new URLSearchParams({
      q: query,
      page,
      limit,
      ...filters,
    });
    const response = await api.get(`/api/search/templates?${params}`);
    return response.data;
  },

  searchPublications: async (query, filters = {}, page = 1, limit = 10) => {
    const params = new URLSearchParams({ q: query, page, limit, ...filters });
    const response = await api.get(`/api/search/publications?${params}`);
    return response.data;
  },

  searchPatents: async (query, filters = {}, page = 1, limit = 10) => {
    const params = new URLSearchParams({ q: query, page, limit, ...filters });
    const response = await api.get(`/api/search/patents?${params}`);
    return response.data;
  },

  searchFacultyAchievements: async (query, filters = {}, page = 1, limit = 10) => {
    const params = new URLSearchParams({ q: query, page, limit, ...filters });
    const response = await api.get(`/api/search/faculty-achievements?${params}`);
    return response.data;
  },

  searchNptelCourses: async (query, filters = {}, page = 1, limit = 10) => {
    const params = new URLSearchParams({ q: query, page, limit, ...filters });
    const response = await api.get(`/api/search/nptel-courses?${params}`);
    return response.data;
  },

  getSuggestions: async (query, limit = 5) => {
    const params = new URLSearchParams({ q: query, limit });
    const response = await api.get(`/api/search/suggestions?${params}`);
    return response.data;
  },
};

export default searchService;