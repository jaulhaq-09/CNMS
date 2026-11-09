const EventService = require('../services/eventService');
const NotificationService = require('../services/notificationService');
const EmailService = require('../services/emailService');
const { notifyApprovers, notifySubmitter, notifyAdminsOfApproval } = require('../services/approvalNotifier');
const { visibilityQuery, canView, canDecide, resolveScope } = require('../utils/approvalRules');
const AuditService = require('../services/auditService');
const User = require('../models/User');
const logger = require('../utils/logger');
const fs = require('fs');

exports.createEvent = async (req, res) => {
  try {
    const payload = { ...req.body };

    // Everyone except a Super Admin posts for their own department, under a
    // cluster / section they are assigned to (checked here, never trusted from
    // the request). With a single cluster it is filled in automatically.
    if (req.user.role !== 'SUPER_ADMIN') {
      payload.department = req.user.department;

      const scope = resolveScope(req.user, payload);
      if (scope.error) {
        return res.status(403).json({ success: false, message: scope.error });
      }
      payload.cluster = scope.cluster;
      payload.section = scope.section;
    }

    const event = await EventService.createEvent(payload, req.user._id);

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: event,
    });
  } catch (error) {
    logger.error('Create event error:', error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllEvents = async (req, res) => {
  try {
    const { status, eventType, department, dateFrom, dateTo, page = 1, limit = 10, search } = req.query;

    const filters = {
      status,
      eventType,
      department,
      dateFrom,
      dateTo,
      searchQuery: search,
      visibility: visibilityQuery(req.user, 'createdBy', { coDepartments: true }),
    };

    const result = await EventService.getAllEvents(filters, parseInt(page), parseInt(limit));

    res.json({
      success: true,
      data: result.events,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getEventById = async (req, res) => {
  try {
    const event = await EventService.getEventById(req.params.id);

    // Items outside the user's department are reported as "not found",
    // so their existence isn't revealed.
    if (!canView(req.user, event, 'createdBy', { coDepartments: true })) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    logger.error('Get event error:', error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const event = await EventService.getEventById(req.params.id);

    if (event.createdBy._id.toString() !== req.user._id.toString() && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this event',
      });
    }

    if (
      req.user.role !== 'SUPER_ADMIN' &&
      (req.body.cluster !== undefined || req.body.section !== undefined)
    ) {
      const scope = resolveScope(req.user, {
        cluster: req.body.cluster !== undefined ? req.body.cluster : event.cluster,
        section: req.body.section !== undefined ? req.body.section : event.section,
      });
      if (scope.error) {
        return res.status(403).json({ success: false, message: scope.error });
      }
      req.body.cluster = scope.cluster;
      req.body.section = scope.section;
    }

    // Whether the editor may bypass the draft-only rule is decided here from
    // the logged-in user's role, never from anything in the request body.
    const updatedEvent = await EventService.updateEvent(req.params.id, req.body, req.user._id, {
      isAdmin: req.user.role === 'SUPER_ADMIN',
    });

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: updatedEvent,
    });
  } catch (error) {
    logger.error('Update event error:', error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const event = await EventService.getEventById(req.params.id);

    if (event.createdBy._id.toString() !== req.user._id.toString() && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this event',
      });
    }

    const result = await EventService.deleteEvent(req.params.id);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    logger.error('Delete event error:', error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.submitEvent = async (req, res) => {
  try {
    const event = await EventService.getEventById(req.params.id);

    if (event.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only submit your own events',
      });
    }

    const updatedEvent = await EventService.submitEvent(req.params.id, req.user._id);

    const io = req.app.get('io');

    // Tell this department's approvers (bell + email). This never blocks
    // or fails the submission itself.
    await notifyApprovers({
      itemType: 'event',
      itemId: event._id,
      title: event.eventName,
      departmentId: event.department?._id || event.department,
      departmentName: event.department?.name,
      cluster: event.cluster,
      submitter: req.user,
      io,
      isResubmission: Boolean(updatedEvent._wasResubmitted),
    });

    // Co-organizing departments are informed (bell only) through their
    // coordinators. They do not approve the event.
    try {
      const coIds = (event.coDepartments || []).map((d) => d._id || d);
      if (coIds.length > 0) {
        const coCoordinators = await User.find({
          role: 'COORDINATOR',
          department: { $in: coIds },
          isActive: { $ne: false },
          _id: { $ne: req.user._id },
        }).select('_id');

        const posterName = `${req.user.firstName} ${req.user.lastName}`;
        for (const person of coCoordinators) {
          await NotificationService.createNotification(
            {
              recipient: person._id,
              sender: req.user._id,
              type: 'EVENT_SUBMITTED',
              title: 'Joint event posted with your department',
              message: `${posterName} posted "${event.eventName}" as a joint activity involving your department`,
              data: { eventId: event._id, relatedUrl: `/events/${event._id}` },
            },
            io
          );
        }
      }
    } catch (error) {
      logger.error('Co-department notification error:', error.message);
    }

    res.json({
      success: true,
      message: 'Event submitted for approval',
      data: updatedEvent,
    });
  } catch (error) {
    logger.error('Submit event error:', error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// canDecide (imported above) lets a Coordinator decide only on events from
// their own department AND cluster. Super Admin is unrestricted.
// Co-organizing departments are informed but do not approve.

// Nobody decides on their own submission, except a Super Admin.
function isOwnEvent(user, event) {
  if (user.role === 'SUPER_ADMIN') return false;
  return String(event.createdBy?._id || event.createdBy) === String(user._id);
}

exports.approveEvent = async (req, res) => {
  try {
    const { feedback } = req.body;

    const target = await EventService.getEventById(req.params.id);
    if (!canDecide(req.user, target)) {
      return res.status(403).json({
        success: false,
        message: 'You can only approve events from your own department and cluster.',
      });
    }
    if (isOwnEvent(req.user, target)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot approve an event you posted yourself. Ask another coordinator or an Admin.',
      });
    }

    const updatedEvent = await EventService.approveEvent(req.params.id, req.user._id, feedback);

    try {
      await EmailService.sendEventApprovedEmail(updatedEvent.createdBy, updatedEvent);
    } catch (emailError) {
      logger.error('Event approved email failed:', emailError.message);
    }

    await notifySubmitter({
      itemType: 'event',
      itemId: updatedEvent._id,
      title: updatedEvent.eventName,
      decision: 'APPROVED',
      submitterId: updatedEvent.createdBy?._id,
      decider: req.user,
      relatedUrl: `/events/${updatedEvent._id}`,
      io: req.app.get('io'),
    });

    await notifyAdminsOfApproval({
      itemType: 'event',
      itemId: updatedEvent._id,
      title: updatedEvent.eventName,
      departmentName: target.department?.name,
      cluster: updatedEvent.cluster || target.cluster,
      submitterName: `${updatedEvent.createdBy?.firstName || ''} ${updatedEvent.createdBy?.lastName || ''}`.trim(),
      approver: req.user,
      io: req.app.get('io'),
    });

    await AuditService.log('EVENT_APPROVED', req.user._id, 'Event', updatedEvent._id, { feedback }, updatedEvent.eventName);

    res.json({
      success: true,
      message: 'Event approved successfully',
      data: updatedEvent,
    });
  } catch (error) {
    logger.error('Approve event error:', error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.rejectEvent = async (req, res) => {
  try {
    const { feedback } = req.body;

    if (!feedback) {
      return res.status(400).json({
        success: false,
        message: 'Feedback is required for rejection',
      });
    }

    const target = await EventService.getEventById(req.params.id);
    if (!canDecide(req.user, target)) {
      return res.status(403).json({
        success: false,
        message: 'You can only reject events from your own department and cluster.',
      });
    }
    if (isOwnEvent(req.user, target)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot reject an event you posted yourself. Ask another coordinator or an Admin.',
      });
    }

    const updatedEvent = await EventService.rejectEvent(req.params.id, req.user._id, feedback);

    try {
      await EmailService.sendEventRejectedEmail(updatedEvent.createdBy, updatedEvent, feedback);
    } catch (emailError) {
      logger.error('Event rejected email failed:', emailError.message);
    }

    await notifySubmitter({
      itemType: 'event',
      itemId: updatedEvent._id,
      title: updatedEvent.eventName,
      decision: 'REJECTED',
      feedback,
      submitterId: updatedEvent.createdBy?._id,
      decider: req.user,
      relatedUrl: `/events/${updatedEvent._id}`,
      io: req.app.get('io'),
    });

    await AuditService.log('EVENT_REJECTED', req.user._id, 'Event', updatedEvent._id, { feedback }, updatedEvent.eventName);

    res.json({
      success: true,
      message: 'Event rejected',
      data: updatedEvent,
    });
  } catch (error) {
    logger.error('Reject event error:', error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Note: upload.array('photos', 5) middleware runs BEFORE this handler,
// in the route definition — this function only handles what happens
// after multer has already placed files on disk.
exports.uploadEventPhotos = async (req, res) => {
  try {
    const event = await EventService.getEventById(req.params.id);

    if (event.createdBy._id.toString() !== req.user._id.toString() && req.user.role !== 'SUPER_ADMIN') {
      (req.files || []).forEach((f) => fs.unlinkSync(f.path));
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to add photos to this event',
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No photos were uploaded',
      });
    }

    // Every photo is accepted whatever device it came from (phone, camera,
    // drone). The browser already shrinks very large files before upload.
    const validFiles = [...req.files];
    const rejected = [];
    const photoUrls = validFiles.map((f) => `/uploads/events/${f.filename}`);
    const updatedEvent = await EventService.addPhotos(req.params.id, photoUrls);

    res.status(200).json({
      success: true,
      message: rejected.length > 0
        ? `${validFiles.length} photo(s) added. ${rejected.length} rejected for low resolution.`
        : `${validFiles.length} photo(s) added successfully`,
      data: updatedEvent,
    });
  } catch (error) {
    logger.error('Upload photos error:', error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};