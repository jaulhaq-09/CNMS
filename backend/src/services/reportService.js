const Report = require('../models/Report');
const User = require('../models/User');
const ExportService = require('./exportService');
const logger = require('../utils/logger');

// Which export method builds each report type.
const REPORT_EXPORTERS = {
  EVENTS: 'exportEvents',
  NEWSLETTERS: 'exportNewsletters',
  PUBLICATIONS: 'exportPublications',
  PATENTS: 'exportPatents',
  ACHIEVEMENTS: 'exportFacultyAchievements',
  NPTEL: 'exportNptelCourses',
};

class ReportService {
  static async createReport(reportData, userId) {
    try {
      const report = new Report({
        ...reportData,
        owner: userId,
      });

      await report.save();

      logger.info(`Report created: ${report._id}`);

      return report;
    } catch (error) {
      logger.error('Create report error:', error.message);
      throw error;
    }
  }

  static async getReportById(id) {
    try {
      const report = await Report.findById(id).populate('owner', 'firstName lastName email');

      if (!report) {
        throw new Error('Report not found');
      }

      return report;
    } catch (error) {
      logger.error('Get report error:', error.message);
      throw error;
    }
  }

  static async getAllReports(userId, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;

      const reports = await Report.find({ owner: userId })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate('owner', 'firstName lastName');

      const total = await Report.countDocuments({ owner: userId });

      return {
        reports,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCount: total,
        },
      };
    } catch (error) {
      logger.error('Get reports error:', error.message);
      throw error;
    }
  }

  static async updateReport(id, updateData, userId) {
    try {
      const report = await Report.findById(id);

      if (!report) {
        throw new Error('Report not found');
      }

      if (report.owner.toString() !== userId.toString()) {
        throw new Error('Unauthorized');
      }

      // Whitelist: never let a request body overwrite owner, scheduling, history, etc.
      const EDITABLE = ['name', 'description', 'type', 'filters', 'columns', 'metrics', 'format', 'settings'];
      EDITABLE.forEach((key) => {
        if (updateData[key] !== undefined) report[key] = updateData[key];
      });
      report.updatedAt = new Date();

      await report.save();

      logger.info(`Report updated: ${id}`);

      return report;
    } catch (error) {
      logger.error('Update report error:', error.message);
      throw error;
    }
  }

  static async deleteReport(id, userId) {
    try {
      const report = await Report.findById(id);

      if (!report) {
        throw new Error('Report not found');
      }

      if (report.owner.toString() !== userId.toString()) {
        throw new Error('Unauthorized');
      }

      await Report.findByIdAndDelete(id);

      logger.info(`Report deleted: ${id}`);

      return { message: 'Report deleted successfully' };
    } catch (error) {
      logger.error('Delete report error:', error.message);
      throw error;
    }
  }

  // Builds the filters and PDF metadata for a report. Anyone other than a
  // Super Admin is forced to their own department, so a saved or scheduled
  // report can never reach beyond what its owner is allowed to see.
  static async resolveExportInputs(report) {
    const plain = typeof report.toObject === 'function' ? report.toObject() : report;
    const ownerId = plain.owner?._id || plain.owner;

    const owner = await User.findById(ownerId).select('role department isActive');
    if (!owner || owner.isActive === false) {
      throw new Error('The owner of this report is no longer active.');
    }

    const filters = { ...(plain.filters || {}) };
    if (owner.role !== 'SUPER_ADMIN') {
      if (!owner.department) {
        throw new Error('Your account has no department assigned.');
      }
      filters.department = String(owner.department);
    }

    const meta = {
      name: plain.name,
      description: plain.description,
      settings: plain.settings || {},
    };

    return { filters, meta };
  }

  static async generateReportData(report, { record = true } = {}) {
    try {
      let data;

      const { filters, meta } = await this.resolveExportInputs(report);

      const exporter = REPORT_EXPORTERS[report.type];
      if (!exporter) {
        throw new Error('This report type is no longer supported. Please create a new report.');
      }
      data = await ExportService[exporter](filters, report.format, meta);

      // A test/preview run (record: false) must not touch lastGenerated or the
      // history, or it would make the scheduler skip that day's real run.
      if (!record) return data;

      // Update last generated
      report.lastGenerated = {
        date: new Date(),
        fileName: `${report.name}_${Date.now()}.${report.format.toLowerCase()}`,
        size: Buffer.byteLength(data),
      };

      // Add to history
      report.generationHistory.push({
        date: new Date(),
        fileName: report.lastGenerated.fileName,
        size: report.lastGenerated.size,
        status: 'SUCCESS',
      });

      await report.save();

      return data;
    } catch (error) {
      logger.error('Generate report error:', error.message);
      throw error;
    }
  }

  static async scheduleReport(reportId, userId) {
    try {
      const report = await Report.findById(reportId);

      if (!report) {
        throw new Error('Report not found');
      }

      if (report.owner.toString() !== userId.toString()) {
        throw new Error('Unauthorized');
      }

      report.scheduling.enabled = true;
      await report.save();

      logger.info(`Report scheduled: ${reportId}`);

      return report;
    } catch (error) {
      logger.error('Schedule report error:', error.message);
      throw error;
    }
  }

  static async unscheduleReport(reportId, userId) {
    try {
      const report = await Report.findById(reportId);

      if (!report) {
        throw new Error('Report not found');
      }

      if (report.owner.toString() !== userId.toString()) {
        throw new Error('Unauthorized');
      }

      report.scheduling.enabled = false;
      await report.save();

      logger.info(`Report unscheduled: ${reportId}`);

      return report;
    } catch (error) {
      logger.error('Unschedule report error:', error.message);
      throw error;
    }
  }
}

module.exports = ReportService;