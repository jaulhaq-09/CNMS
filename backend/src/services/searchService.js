const Event = require('../models/Event');
const Newsletter = require('../models/Newsletter');
const NewsletterTemplate = require('../models/NewsletterTemplate');
const User = require('../models/User');
const logger = require('../utils/logger');
const Publication = require('../models/Publication');
const Patent = require('../models/Patent');
const FacultyAchievement = require('../models/FacultyAchievement');
const NptelCourse = require('../models/NptelCourse');
const { getCached, setCached } = require('../utils/cache');

class SearchService {
  static async globalSearch(query, filters = {}, page = 1, limit = 10) {
    // Cache key includes every input that changes the result set, so
    // different searches/filters/pages never collide with each other.
    const cacheKey = `search:global:${query}:${JSON.stringify(filters)}:${page}:${limit}`;

    try {
      const cached = await getCached(cacheKey);
      if (cached) return cached;

      const skip = (page - 1) * limit;

      const searchOptions = {
        $text: { $search: query },
      };

      // Events search
      const eventQuery = { ...searchOptions };
      if (filters.eventType) eventQuery.eventType = filters.eventType;
      if (filters.status) eventQuery.status = filters.status;
      if (filters.department) eventQuery.department = filters.department;

      const events = await Event.find(eventQuery)
        .skip(skip)
        .limit(limit)
        .populate('department', 'name')
        .populate('createdBy', 'firstName lastName');

      const eventCount = await Event.countDocuments(eventQuery);

      // Newsletters search
      const newsletterQuery = { ...searchOptions };
      if (filters.status) newsletterQuery.status = filters.status;

      const newsletters = await Newsletter.find(newsletterQuery)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'firstName lastName');

      const newsletterCount = await Newsletter.countDocuments(newsletterQuery);

      // Templates search
      const templateQuery = { ...searchOptions };
      if (filters.status) templateQuery.status = filters.status;

      const templates = await NewsletterTemplate.find(templateQuery)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'firstName lastName');

      const templateCount = await NewsletterTemplate.countDocuments(templateQuery);

      // Publications search
      const publicationQuery = { ...searchOptions };
      if (filters.status) publicationQuery.status = filters.status;

      const publications = await Publication.find(publicationQuery)
        .skip(skip)
        .limit(limit)
        .populate('department', 'name')
        .populate('submittedBy', 'firstName lastName');

      const publicationCount = await Publication.countDocuments(publicationQuery);

      // Patents search
      const patentQuery = { ...searchOptions };
      if (filters.status) patentQuery.status = filters.status;
      if (filters.department) patentQuery.department = filters.department;

      const patents = await Patent.find(patentQuery)
        .skip(skip)
        .limit(limit)
        .populate('department', 'name')
        .populate('submittedBy', 'firstName lastName');

      const patentCount = await Patent.countDocuments(patentQuery);

      // Faculty achievements search
      const achievementQuery = { ...searchOptions };
      if (filters.status) achievementQuery.status = filters.status;
      if (filters.department) achievementQuery.department = filters.department;

      const achievements = await FacultyAchievement.find(achievementQuery)
        .skip(skip)
        .limit(limit)
        .populate('department', 'name')
        .populate('submittedBy', 'firstName lastName');

      const achievementCount = await FacultyAchievement.countDocuments(achievementQuery);

      // NPTEL courses search — no `status` field on this model, so the
      // status filter is deliberately not applied here.
      const nptelQuery = { ...searchOptions };
      if (filters.department) nptelQuery.department = filters.department;

      const nptelCourses = await NptelCourse.find(nptelQuery)
        .skip(skip)
        .limit(limit)
        .populate('department', 'name')
        .populate('faculty', 'firstName lastName');

      const nptelCount = await NptelCourse.countDocuments(nptelQuery);

      const totalResults =
        eventCount +
        newsletterCount +
        templateCount +
        publicationCount +
        patentCount +
        achievementCount +
        nptelCount;

      const result = {
        results: {
          events,
          newsletters,
          templates,
          publications,
          patents,
          achievements,
          nptelCourses,
        },
        counts: {
          events: eventCount,
          newsletters: newsletterCount,
          templates: templateCount,
          publications: publicationCount,
          patents: patentCount,
          achievements: achievementCount,
          nptelCourses: nptelCount,
          total: totalResults,
        },
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalResults / limit),
          totalCount: totalResults,
        },
      };

      // Short TTL — same reasoning as analytics caching: no invalidation
      // hook on content approval yet, so keep staleness bounded instead
      // of eliminating it entirely.
      await setCached(cacheKey, result, 30);

      return result;
    } catch (error) {
      logger.error('Global search error:', error.message);
      throw error;
    }
  }
  static async searchEvents(query, filters = {}, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const searchQuery = { $text: { $search: query } };

      if (filters.eventType) searchQuery.eventType = filters.eventType;
      if (filters.status) searchQuery.status = filters.status;
      if (filters.department) searchQuery.department = filters.department;
      if (filters.dateFrom || filters.dateTo) {
        searchQuery.eventDate = {};
        if (filters.dateFrom) searchQuery.eventDate.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) searchQuery.eventDate.$lte = new Date(filters.dateTo);
      }

      const events = await Event.find(searchQuery)
        .skip(skip)
        .limit(limit)
        .sort({ score: { $meta: 'textScore' } })
        .populate('department', 'name')
        .populate('createdBy', 'firstName lastName');

      const total = await Event.countDocuments(searchQuery);

      return {
        results: events,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCount: total,
        },
      };
    } catch (error) {
      logger.error('Search events error:', error.message);
      throw error;
    }
  }

  static async searchNewsletters(query, filters = {}, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const searchQuery = { $text: { $search: query } };

      if (filters.status) searchQuery.status = filters.status;
      if (filters.dateFrom || filters.dateTo) {
        searchQuery.createdAt = {};
        if (filters.dateFrom) searchQuery.createdAt.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) searchQuery.createdAt.$lte = new Date(filters.dateTo);
      }

      const newsletters = await Newsletter.find(searchQuery)
        .skip(skip)
        .limit(limit)
        .sort({ score: { $meta: 'textScore' } })
        .populate('createdBy', 'firstName lastName');

      const total = await Newsletter.countDocuments(searchQuery);

      return {
        results: newsletters,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCount: total,
        },
      };
    } catch (error) {
      logger.error('Search newsletters error:', error.message);
      throw error;
    }
  }

  static async searchTemplates(query, filters = {}, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const searchQuery = { $text: { $search: query } };

      if (filters.status) searchQuery.status = filters.status;
      if (filters.category) searchQuery.category = filters.category;

      const templates = await NewsletterTemplate.find(searchQuery)
        .skip(skip)
        .limit(limit)
        .sort({ score: { $meta: 'textScore' } })
        .populate('createdBy', 'firstName lastName');

      const total = await NewsletterTemplate.countDocuments(searchQuery);

      return {
        results: templates,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCount: total,
        },
      };
    } catch (error) {
      logger.error('Search templates error:', error.message);
      throw error;
    }
  }

  static async searchPublications(query, filters = {}, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const searchQuery = { $text: { $search: query } };

      if (filters.status) searchQuery.status = filters.status;

      const publications = await Publication.find(searchQuery)
        .skip(skip)
        .limit(limit)
        .sort({ score: { $meta: 'textScore' } })
        .populate('department', 'name')
        .populate('submittedBy', 'firstName lastName');

      const total = await Publication.countDocuments(searchQuery);

      return {
        results: publications,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCount: total,
        },
      };
    } catch (error) {
      logger.error('Search publications error:', error.message);
      throw error;
    }
  }

  static async searchPatents(query, filters = {}, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const searchQuery = { $text: { $search: query } };

      if (filters.status) searchQuery.status = filters.status;
      if (filters.department) searchQuery.department = filters.department;

      const patents = await Patent.find(searchQuery)
        .skip(skip)
        .limit(limit)
        .sort({ score: { $meta: 'textScore' } })
        .populate('department', 'name')
        .populate('submittedBy', 'firstName lastName');

      const total = await Patent.countDocuments(searchQuery);

      return {
        results: patents,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCount: total,
        },
      };
    } catch (error) {
      logger.error('Search patents error:', error.message);
      throw error;
    }
  }

  static async searchFacultyAchievements(query, filters = {}, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const searchQuery = { $text: { $search: query } };

      if (filters.status) searchQuery.status = filters.status;
      if (filters.department) searchQuery.department = filters.department;

      const achievements = await FacultyAchievement.find(searchQuery)
        .skip(skip)
        .limit(limit)
        .sort({ score: { $meta: 'textScore' } })
        .populate('department', 'name')
        .populate('submittedBy', 'firstName lastName');

      const total = await FacultyAchievement.countDocuments(searchQuery);

      return {
        results: achievements,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCount: total,
        },
      };
    } catch (error) {
      logger.error('Search achievements error:', error.message);
      throw error;
    }
  }

  static async searchNptelCourses(query, filters = {}, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const searchQuery = { $text: { $search: query } };

      if (filters.department) searchQuery.department = filters.department;

      const nptelCourses = await NptelCourse.find(searchQuery)
        .skip(skip)
        .limit(limit)
        .sort({ score: { $meta: 'textScore' } })
        .populate('department', 'name')
        .populate('faculty', 'firstName lastName');

      const total = await NptelCourse.countDocuments(searchQuery);

      return {
        results: nptelCourses,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCount: total,
        },
      };
    } catch (error) {
      logger.error('Search NPTEL courses error:', error.message);
      throw error;
    }
  }
  static async getSearchSuggestions(query, limit = 5) {
    try {
      const searchQuery = { $text: { $search: query } };

      const eventSuggestions = await Event.find(searchQuery)
        .limit(limit)
        .select('eventName')
        .lean();

      const newsletterSuggestions = await Newsletter.find(searchQuery)
        .limit(limit)
        .select('name')
        .lean();

      const templateSuggestions = await NewsletterTemplate.find(searchQuery)
        .limit(limit)
        .select('name')
        .lean();

      const publicationSuggestions = await Publication.find(searchQuery)
        .limit(limit)
        .select('title')
        .lean();

      const patentSuggestions = await Patent.find(searchQuery)
        .limit(limit)
        .select('title')
        .lean();

      const achievementSuggestions = await FacultyAchievement.find(searchQuery)
        .limit(limit)
        .select('title')
        .lean();

      const nptelSuggestions = await NptelCourse.find(searchQuery)
        .limit(limit)
        .select('courseName')
        .lean();

      return {
        events: eventSuggestions.map((e) => ({ type: 'event', text: e.eventName, id: e._id })),
        newsletters: newsletterSuggestions.map((n) => ({ type: 'newsletter', text: n.name, id: n._id })),
        templates: templateSuggestions.map((t) => ({ type: 'template', text: t.name, id: t._id })),
        publications: publicationSuggestions.map((p) => ({ type: 'publication', text: p.title, id: p._id })),
        patents: patentSuggestions.map((p) => ({ type: 'patent', text: p.title, id: p._id })),
        achievements: achievementSuggestions.map((a) => ({ type: 'achievement', text: a.title, id: a._id })),
        nptelCourses: nptelSuggestions.map((n) => ({ type: 'nptel', text: n.courseName, id: n._id })),
      };
    } catch (error) {
      logger.error('Get suggestions error:', error.message);
      return { events: [], newsletters: [], templates: [], publications: [], patents: [], achievements: [], nptelCourses: [] };
    }
  }
}

module.exports = SearchService;