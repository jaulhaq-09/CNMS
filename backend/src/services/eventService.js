const Event = require('../models/Event');
const logger = require('../utils/logger');

class EventService {
  static async createEvent(eventData, userId) {
    try {
      const event = new Event({
        ...eventData,
        createdBy: userId,
        organizer: userId,
        status: 'DRAFT',
      });

      await event.save();
      await event.populate('department', 'name');
      await event.populate('createdBy', 'firstName lastName email');

      logger.info(`Event created: ${event._id}`);

      return event;
    } catch (error) {
      logger.error('Create event error:', error.message);
      throw error;
    }
  }

  static async getEventById(id) {
    try {
      const event = await Event.findById(id)
        .populate('department', 'name')
        .populate('coDepartments', 'name')
        .populate('createdBy', 'firstName lastName email')
        .populate('organizer', 'firstName lastName email')
        .populate('approvalHistory.approver', 'firstName lastName email');

      if (!event) {
        throw new Error('Event not found');
      }

      return event;
    } catch (error) {
      logger.error('Get event error:', error.message);
      throw error;
    }
  }

  static async getAllEvents(filters = {}, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const query = {};

      if (filters.status) query.status = filters.status;
      if (filters.eventType) query.eventType = filters.eventType;
      if (filters.department) query.department = filters.department;
      if (filters.dateFrom || filters.dateTo) {
        query.eventDate = {};
        if (filters.dateFrom) query.eventDate.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.eventDate.$lte = new Date(filters.dateTo);
      }
      if (filters.searchQuery) {
        query.$text = { $search: filters.searchQuery };
      }

      // Limit the results to what this user is allowed to see (if given).
      const finalQuery =
        filters.visibility && Object.keys(filters.visibility).length > 0
          ? { $and: [query, filters.visibility] }
          : query;

      let queryBuilder = Event.find(finalQuery)
        .skip(skip)
        .limit(limit)
        .sort({ eventDate: -1 })
        .populate('department', 'name')
        .populate('createdBy', 'firstName lastName');

      const events = await queryBuilder;
      const total = await Event.countDocuments(finalQuery);

      return {
        events,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCount: total,
        },
      };
    } catch (error) {
      logger.error('Get events error:', error.message);
      throw error;
    }
  }

  static async updateEvent(id, updateData, userId) {
    try {
      const event = await Event.findById(id);
      if (!event) {
        throw new Error('Event not found');
      }

      if (!['DRAFT', 'REJECTED'].includes(event.status) && !updateData.isAdmin) {
        throw new Error('Can only edit draft or rejected events');
      }

      Object.assign(event, updateData);
      event.updatedAt = new Date();

      await event.save();

      logger.info(`Event updated: ${id}`);

      return event;
    } catch (error) {
      logger.error('Update event error:', error.message);
      throw error;
    }
  }

  static async submitEvent(id, userId) {
    try {
      const event = await Event.findById(id);
      if (!event) {
        throw new Error('Event not found');
      }

      if (!['DRAFT', 'REJECTED'].includes(event.status)) {
        throw new Error('Only draft or rejected events can be submitted');
      }

      const wasRejected = event.status === 'REJECTED';
      event.status = 'SUBMITTED';
      event.approvalHistory.push({
        action: wasRejected ? 'RESUBMITTED' : 'SUBMITTED',
        timestamp: new Date(),
      });

      await event.save();

      logger.info(`Event ${wasRejected ? 'resubmitted' : 'submitted'} for approval: ${id}`);

      event._wasResubmitted = wasRejected;
      return event;
    } catch (error) {
      logger.error('Submit event error:', error.message);
      throw error;
    }
  }

  static async approveEvent(id, approverId, feedback = '') {
    try {
      const event = await Event.findById(id);
      if (!event) {
        throw new Error('Event not found');
      }

      if (event.status !== 'SUBMITTED') {
        throw new Error('Can only approve submitted events');
      }

      event.status = 'APPROVED';
      event.approvalHistory.push({
        approver: approverId,
        action: 'APPROVED',
        feedback,
        timestamp: new Date(),
      });

      await event.save();
      await event.populate('createdBy', 'firstName lastName email');

      logger.info(`Event approved: ${id}`);

      return event;
    } catch (error) {
      logger.error('Approve event error:', error.message);
      throw error;
    }
  }

  static async rejectEvent(id, approverId, feedback = '') {
    try {
      const event = await Event.findById(id);
      if (!event) {
        throw new Error('Event not found');
      }

      if (!feedback) {
        throw new Error('Feedback is required for rejection');
      }

      if (event.status !== 'SUBMITTED') {
        throw new Error('Can only reject submitted events');
      }

      event.status = 'REJECTED';
      event.approvalHistory.push({
        approver: approverId,
        action: 'REJECTED',
        feedback,
        timestamp: new Date(),
      });

      await event.save();
      await event.populate('createdBy', 'firstName lastName email');

      logger.info(`Event rejected: ${id}`);

      return event;
    } catch (error) {
      logger.error('Reject event error:', error.message);
      throw error;
    }
  }

  static async deleteEvent(id) {
    try {
      const event = await Event.findByIdAndDelete(id);
      if (!event) {
        throw new Error('Event not found');
      }

      logger.info(`Event deleted: ${id}`);

      return { message: 'Event deleted successfully' };
    } catch (error) {
      logger.error('Delete event error:', error.message);
      throw error;
    }
  }

  static async addPhotos(id, photoUrls) {
    try {
      const event = await Event.findById(id);
      if (!event) {
        throw new Error('Event not found');
      }

      photoUrls.forEach((url) => {
        event.photos.push({ url, uploadedAt: new Date() });
      });

      await event.save();

      logger.info(`${photoUrls.length} photo(s) added to event ${id}`);

      return event;
    } catch (error) {
      logger.error('Add photos error:', error.message);
      throw error;
    }
  }

}

module.exports = EventService;