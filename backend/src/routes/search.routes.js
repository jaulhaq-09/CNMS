const express = require('express');
const router = express.Router();
const SearchService = require('../services/searchService');
const authenticate = require('../middleware/authenticate');
const logger = require('../utils/logger');

// Global search
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      q,
      eventType,
      status,
      department,
      dateFrom,
      dateTo,
      page = 1,
      limit = 10,
    } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters',
      });
    }

    const filters = {
      eventType,
      status,
      department,
      dateFrom,
      dateTo,
    };

    const result = await SearchService.globalSearch(
      q,
      filters,
      parseInt(page),
      parseInt(limit)
    );

    res.json({
      success: true,
      data: result.results,
      counts: result.counts,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Search error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Search events
router.get('/events', authenticate, async (req, res) => {
  try {
    const {
      q,
      eventType,
      status,
      department,
      dateFrom,
      dateTo,
      page = 1,
      limit = 10,
    } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters',
      });
    }

    const filters = {
      eventType,
      status,
      department,
      dateFrom,
      dateTo,
    };

    const result = await SearchService.searchEvents(
      q,
      filters,
      parseInt(page),
      parseInt(limit)
    );

    res.json({
      success: true,
      data: result.results,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Search events error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Search newsletters
router.get('/newsletters', authenticate, async (req, res) => {
  try {
    const { q, status, dateFrom, dateTo, page = 1, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters',
      });
    }

    const filters = {
      status,
      dateFrom,
      dateTo,
    };

    const result = await SearchService.searchNewsletters(
      q,
      filters,
      parseInt(page),
      parseInt(limit)
    );

    res.json({
      success: true,
      data: result.results,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Search newsletters error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Search templates
router.get('/templates', authenticate, async (req, res) => {
  try {
    const { q, status, category, page = 1, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters',
      });
    }

    const filters = {
      status,
      category,
    };

    const result = await SearchService.searchTemplates(
      q,
      filters,
      parseInt(page),
      parseInt(limit)
    );

    res.json({
      success: true,
      data: result.results,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Search templates error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Search publications
router.get('/publications', authenticate, async (req, res) => {
  try {
    const { q, status, page = 1, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters',
      });
    }

    const filters = { status };

    const result = await SearchService.searchPublications(q, filters, parseInt(page), parseInt(limit));

    res.json({
      success: true,
      data: result.results,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Search publications error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});
// Search patents
router.get('/patents', authenticate, async (req, res) => {
  try {
    const { q, status, department, page = 1, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters',
      });
    }

    const filters = { status, department };

    const result = await SearchService.searchPatents(q, filters, parseInt(page), parseInt(limit));

    res.json({
      success: true,
      data: result.results,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Search patents error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Search faculty achievements
router.get('/faculty-achievements', authenticate, async (req, res) => {
  try {
    const { q, status, department, page = 1, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters',
      });
    }

    const filters = { status, department };

    const result = await SearchService.searchFacultyAchievements(q, filters, parseInt(page), parseInt(limit));

    res.json({
      success: true,
      data: result.results,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Search achievements error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Search NPTEL courses
router.get('/nptel-courses', authenticate, async (req, res) => {
  try {
    const { q, department, page = 1, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters',
      });
    }

    const filters = { department };

    const result = await SearchService.searchNptelCourses(q, filters, parseInt(page), parseInt(limit));

    res.json({
      success: true,
      data: result.results,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Search NPTEL courses error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get search suggestions
router.get('/suggestions', authenticate, async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        data: {
          events: [],
          newsletters: [],
          templates: [],
          publications: [],
          patents: [],
          achievements: [],
          nptelCourses: [],
        },
      });
    }

    const suggestions = await SearchService.getSearchSuggestions(q, parseInt(limit));

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    logger.error('Get suggestions error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;