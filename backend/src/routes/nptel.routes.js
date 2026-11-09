const express = require('express');
const router = express.Router();
const NptelCourse = require('../models/NptelCourse');
const authenticate = require('../middleware/authenticate');
const logger = require('../utils/logger');
const { validateNptelCourse } = require('../middleware/validation');
const uploadCertificate = require('../middleware/uploadCertificate');

router.post(
  '/',
  authenticate,
  (req, res, next) => {
    uploadCertificate.single('certificate')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  ...validateNptelCourse,
  async (req, res) => {
    try {
      const payload = { ...req.body };
      if (typeof payload.certificateEarned === 'string') {
        payload.certificateEarned = payload.certificateEarned === 'true';
      }

      if (req.file) {
        payload.certificateUrl = `/uploads/certificates/${req.file.filename}`;
        payload.certificateFileName = req.file.originalname;
        payload.certificateEarned = true;
      }

      const course = new NptelCourse({
        ...payload,
        faculty: req.user._id,
        department: req.user.department,
      });

      await course.save();
      await course.populate('faculty', 'firstName lastName email');
      await course.populate('department', 'name');

      logger.info(`NPTEL course logged: ${course._id} by ${req.user.email}`);

      res.status(201).json({
        success: true,
        message: 'Course logged successfully',
        data: course,
      });
    } catch (error) {
      logger.error('Create NPTEL course error:', error.message);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.get('/', authenticate, async (req, res) => {
  try {
    const { department, faculty, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (department) query.department = department;
    if (faculty) query.faculty = faculty;

    const courses = await NptelCourse.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .populate('faculty', 'firstName lastName email')
      .populate('department', 'name');

    const total = await NptelCourse.countDocuments(query);

    res.json({
      success: true,
      data: courses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalCount: total,
      },
    });
  } catch (error) {
    logger.error('Get NPTEL courses error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.put(
  '/:id',
  authenticate,
  (req, res, next) => {
    uploadCertificate.single('certificate')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const course = await NptelCourse.findById(req.params.id);
      if (!course) {
        return res.status(404).json({ success: false, message: 'Course not found' });
      }

      if (course.faculty.toString() !== req.user._id.toString() && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update this entry',
        });
      }

      const allowed = ['courseName', 'platform', 'duration', 'startDate', 'completionDate', 'certificateEarned', 'score'];
      allowed.forEach((field) => {
        if (req.body[field] !== undefined) {
          if (field === 'certificateEarned' && typeof req.body[field] === 'string') {
            course[field] = req.body[field] === 'true';
          } else {
            course[field] = req.body[field];
          }
        }
      });

      if (req.file) {
        course.certificateUrl = `/uploads/certificates/${req.file.filename}`;
        course.certificateFileName = req.file.originalname;
        course.certificateEarned = true;
      }

      course.updatedAt = new Date();
      await course.save();

      res.json({
        success: true,
        message: 'Course updated successfully',
        data: course,
      });
    } catch (error) {
      logger.error('Update NPTEL course error:', error.message);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.post(
  '/:id/certificate',
  authenticate,
  (req, res, next) => {
    uploadCertificate.single('certificate')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const course = await NptelCourse.findById(req.params.id);
      if (!course) {
        return res.status(404).json({ success: false, message: 'Course not found' });
      }

      if (course.faculty.toString() !== req.user._id.toString() && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update this entry',
        });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No certificate file provided' });
      }

      course.certificateUrl = `/uploads/certificates/${req.file.filename}`;
      course.certificateFileName = req.file.originalname;
      course.certificateEarned = true;
      course.updatedAt = new Date();
      await course.save();

      res.json({
        success: true,
        message: 'Certificate uploaded successfully',
        data: course,
      });
    } catch (error) {
      logger.error('Upload certificate error:', error.message);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const course = await NptelCourse.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (course.faculty.toString() !== req.user._id.toString() && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this entry',
      });
    }

    await NptelCourse.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Course entry deleted successfully' });
  } catch (error) {
    logger.error('Delete NPTEL course error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;