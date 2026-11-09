const express = require('express');
const router = express.Router();
const TemplateService = require('../services/templateService');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const logger = require('../utils/logger');
const { validateCreateTemplate } = require('../middleware/validation');

// Get all public templates (no auth required)
router.get('/public', async (req, res) => {
  try {
    const templates = await TemplateService.getPublicTemplates();

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    logger.error('Get public templates error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Create template (authenticated users)
router.post('/', authenticate, ...validateCreateTemplate, async (req, res) => {
  try {
    const { name, description, structure, category, tags, isPublic } = req.body;

    if (!name || !structure) {
      return res.status(400).json({
        success: false,
        message: 'Template name and structure are required',
      });
    }

    const template = await TemplateService.createTemplate(
      {
        name,
        description,
        structure,
        category,
        tags: tags || [],
        isPublic: isPublic || false,
      },
      req.user._id
    );

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: template,
    });
  } catch (error) {
    logger.error('Create template error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Get all templates with pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, category, page = 1, limit = 10 } = req.query;

    const filters = { status, category };

    const result = await TemplateService.getAllTemplates(
      parseInt(page),
      parseInt(limit),
      filters
    );

    res.json({
      success: true,
      data: result.templates,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Get templates error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get single template
router.get('/:id', authenticate, async (req, res) => {
  try {
    const template = await TemplateService.getTemplateById(req.params.id);

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('Get template error:', error.message);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

// Update template
router.put('/:id', authenticate, async (req, res) => {
  try {
    const template = await TemplateService.getTemplateById(req.params.id);

    if (
      template.createdBy._id.toString() !== req.user._id.toString() &&
      req.user.role !== 'SUPER_ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this template',
      });
    }

    const updatedTemplate = await TemplateService.updateTemplate(
      req.params.id,
      req.body,
      req.user._id
    );

    res.json({
      success: true,
      message: 'Template updated successfully',
      data: updatedTemplate,
    });
  } catch (error) {
    logger.error('Update template error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Delete template
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const template = await TemplateService.getTemplateById(req.params.id);

    if (
      template.createdBy._id.toString() !== req.user._id.toString() &&
      req.user.role !== 'SUPER_ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this template',
      });
    }

    const result = await TemplateService.deleteTemplate(req.params.id);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    logger.error('Delete template error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Duplicate template
router.post('/:id/duplicate', authenticate, async (req, res) => {
  try {
    const duplicated = await TemplateService.duplicateTemplate(
      req.params.id,
      req.user._id
    );

    res.status(201).json({
      success: true,
      message: 'Template duplicated successfully',
      data: duplicated,
    });
  } catch (error) {
    logger.error('Duplicate template error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Publish template
router.post('/:id/publish', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const template = await TemplateService.publishTemplate(req.params.id);

    res.json({
      success: true,
      message: 'Template published successfully',
      data: template,
    });
  } catch (error) {
    logger.error('Publish template error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Designate this template as the mandatory MPR format
router.post('/:id/set-mpr-template', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const template = await TemplateService.setAsMprTemplate(req.params.id);

    res.json({
      success: true,
      message: 'Template set as the MPR template',
      data: template,
    });
  } catch (error) {
    logger.error('Set MPR template error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/:id/unset-mpr-template', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const template = await TemplateService.unsetMprTemplate(req.params.id);

    res.json({
      success: true,
      message: 'MPR template designation removed',
      data: template,
    });
  } catch (error) {
    logger.error('Unset MPR template error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;