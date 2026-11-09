const NewsletterTemplate = require('../models/NewsletterTemplate');
const logger = require('../utils/logger');

class TemplateService {
  static async createTemplate(templateData, userId) {
    try {
      const template = new NewsletterTemplate({
        ...templateData,
        createdBy: userId,
        status: 'DRAFT',
      });

      await template.save();

      logger.info(`Template created: ${template._id}`);

      return template;
    } catch (error) {
      logger.error('Create template error:', error.message);
      throw error;
    }
  }

  // Auto-invoked when a Coordinator approves an event — builds a draft
  // template pre-populated with an Events Grid block bound to that event,
  // so Admin reviews/finishes it instead of starting from a blank canvas.
  static async createFromEvent(event, userId) {
    try {
      const templateData = {
        name: `${event.eventName} — Newsletter Draft`,
        description: `Auto-generated from the approved event "${event.eventName}".`,
        category: 'Special Event',
        structure: {
          pages: [
            {
              id: 'page-1',
              name: 'Page 1',
              blocks: [
                {
                  id: `events-grid-${Date.now()}`,
                  type: 'events-grid',
                  config: {
                    columns: 1,
                    eventsPerPage: 1,
                    showDate: true,
                    showLocation: true,
                    eventIds: [event._id],
                  },
                },
              ],
            },
          ],
        },
      };

      const template = await this.createTemplate(templateData, userId);

      logger.info(`Auto-created template ${template._id} from approved event ${event._id}`);

      return template;
    } catch (error) {
      logger.error('Create template from event error:', error.message);
      throw error;
    }
  }

  static async getTemplateById(id) {
    try {
      const template = await NewsletterTemplate.findById(id)
        .populate('createdBy', 'firstName lastName email')
        .populate('modifiedBy', 'firstName lastName email');

      if (!template) {
        throw new Error('Template not found');
      }

      return template;
    } catch (error) {
      logger.error('Get template error:', error.message);
      throw error;
    }
  }

  static async getAllTemplates(page = 1, limit = 10, filters = {}) {
    try {
      const skip = (page - 1) * limit;

      const query = {};
      if (filters.status) query.status = filters.status;
      if (filters.category) query.category = filters.category;

      const templates = await NewsletterTemplate.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate('createdBy', 'firstName lastName email');

      const total = await NewsletterTemplate.countDocuments(query);

      return {
        templates,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCount: total,
        },
      };
    } catch (error) {
      logger.error('Get templates error:', error.message);
      throw error;
    }
  }

  static async updateTemplate(id, updateData, userId) {
    try {
      const template = await NewsletterTemplate.findById(id);
      if (!template) {
        throw new Error('Template not found');
      }

      // Save current version
      if (template.structure) {
        template.previousVersions.push({
          versionNumber: template.version,
          structure: template.structure,
          compiledHtml: template.compiledHtml,
          createdAt: new Date(),
        });
        template.version += 1;
      }

      Object.assign(template, updateData);
      template.modifiedBy = userId;
      template.updatedAt = new Date();

      await template.save();

      logger.info(`Template updated: ${id}`);

      return template;
    } catch (error) {
      logger.error('Update template error:', error.message);
      throw error;
    }
  }

  static async deleteTemplate(id) {
    try {
      const template = await NewsletterTemplate.findByIdAndDelete(id);
      if (!template) {
        throw new Error('Template not found');
      }

      logger.info(`Template deleted: ${id}`);

      return { message: 'Template deleted successfully' };
    } catch (error) {
      logger.error('Delete template error:', error.message);
      throw error;
    }
  }

  static async duplicateTemplate(id, userId) {
    try {
      const originalTemplate = await NewsletterTemplate.findById(id);
      if (!originalTemplate) {
        throw new Error('Template not found');
      }

      const newTemplate = new NewsletterTemplate({
        name: `${originalTemplate.name} (Copy)`,
        description: originalTemplate.description,
        structure: originalTemplate.structure,
        compiledHtml: originalTemplate.compiledHtml,
        category: originalTemplate.category,
        tags: originalTemplate.tags,
        status: 'DRAFT',
        isPublic: originalTemplate.isPublic,
        createdBy: userId,
      });

      await newTemplate.save();

      logger.info(`Template duplicated from ${id} to ${newTemplate._id}`);

      return newTemplate;
    } catch (error) {
      logger.error('Duplicate template error:', error.message);
      throw error;
    }
  }

  static async publishTemplate(id) {
    try {
      const template = await NewsletterTemplate.findByIdAndUpdate(
        id,
        { status: 'ACTIVE', updatedAt: new Date() },
        { new: true }
      );

      if (!template) {
        throw new Error('Template not found');
      }

      logger.info(`Template published: ${id}`);

      return template;
    } catch (error) {
      logger.error('Publish template error:', error.message);
      throw error;
    }
  }

  // Only one template can be the designated MPR format at a time —
  // setting a new one automatically unsets the previous one, rather
  // than requiring the caller to manage that themselves.
  static async setAsMprTemplate(id) {
    try {
      const template = await NewsletterTemplate.findById(id);
      if (!template) {
        throw new Error('Template not found');
      }

      await NewsletterTemplate.updateMany({}, { isMprTemplate: false });

      template.isMprTemplate = true;
      template.status = 'ACTIVE';
      await template.save();

      logger.info(`Template ${id} designated as the MPR template`);

      return template;
    } catch (error) {
      logger.error('Set MPR template error:', error.message);
      throw error;
    }
  }

  static async unsetMprTemplate(id) {
    try {
      const template = await NewsletterTemplate.findByIdAndUpdate(
        id,
        { isMprTemplate: false },
        { new: true }
      );

      if (!template) {
        throw new Error('Template not found');
      }

      logger.info(`Template ${id} removed as the MPR template`);

      return template;
    } catch (error) {
      logger.error('Unset MPR template error:', error.message);
      throw error;
    }
  }

  static async getMprTemplate() {
    try {
      return await NewsletterTemplate.findOne({ isMprTemplate: true });
    } catch (error) {
      logger.error('Get MPR template error:', error.message);
      throw error;
    }
  }

  static async getPublicTemplates() {
    try {
      const templates = await NewsletterTemplate.find({
        status: 'ACTIVE',
        isPublic: true,
      }).sort({ usageCount: -1 });

      return templates;
    } catch (error) {
      logger.error('Get public templates error:', error.message);
      throw error;
    }
  }
}

module.exports = TemplateService;