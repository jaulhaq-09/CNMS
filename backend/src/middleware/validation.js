const { body, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array().map((err) => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

const validateLogin = [
  body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }).toLowerCase(),
  body('password').isLength({ min: 6 }).trim(),
  handleValidationErrors,
];

const validateRegister = [
  body('firstName').trim().isLength({ min: 2, max: 50 }),
  body('lastName').trim().isLength({ min: 2, max: 50 }),
  body('email').isEmail().normalizeEmail().toLowerCase(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  handleValidationErrors,
];

const validateMongoId = [
  param('id').isMongoId().withMessage('Invalid ID format'),
  handleValidationErrors,
];

const validateCreateEvent = [
  body('eventName').trim().notEmpty().withMessage('Event name is required').isLength({ max: 200 }),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 5000 }),
  body('eventType')
    .isIn(['Conference', 'Workshop', 'Seminar', 'Sports', 'Cultural', 'Academic', 'Social', 'Other'])
    .withMessage('Invalid event type'),
  body('eventDate').isISO8601().withMessage('Valid event date is required'),
  body('cluster').optional().trim().isLength({ max: 100 }),
  body('section').optional().trim().isLength({ max: 100 }),
  body('expectedAttendance')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Expected attendance must be a positive number'),
  body('budget').optional().isFloat({ min: 0 }),
  handleValidationErrors,
];

const validateCreatePublication = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 500 }),
  body('authors').isArray({ min: 1 }).withMessage('At least one author is required'),
  body('authors.*').trim().notEmpty().withMessage('Author name cannot be empty'),
  body('publicationType')
    .isIn(['JOURNAL', 'CONFERENCE', 'BOOK', 'BOOK_CHAPTER'])
    .withMessage('Invalid publication type'),
  body('venueName')
    .custom((value, { req }) => {
      if (req.body.publicationType === 'BOOK') return true;
      return typeof value === 'string' && value.trim().length > 0;
    })
    .withMessage('Journal / conference / book title is required'),
  body('doi').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  body('indexing').optional().isArray(),
  body('publicationYear')
    .optional({ checkFalsy: true })
    .isInt({ min: 1900, max: 2100 })
    .withMessage('Publication year must be between 1900 and 2100'),
  body('volume').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('issue').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('pages').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('publisher').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  body('editors').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  body('edition').optional({ checkFalsy: true }).trim().isLength({ max: 50 }),
  body('isbn').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  handleValidationErrors,
];

const validateCreateTemplate = [
  body('name').trim().notEmpty().withMessage('Template name is required').isLength({ max: 200 }),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('category').optional().trim().isLength({ max: 100 }),
  handleValidationErrors,
];

const validateCreateReport = [
  body('name').trim().notEmpty().withMessage('Report name is required').isLength({ max: 200 }),
  body('type')
    .isIn(['EVENTS', 'NEWSLETTERS', 'TEMPLATES', 'ACTIVITY', 'CUSTOM'])
    .withMessage('Invalid report type'),
  body('format').optional().isIn(['PDF', 'CSV', 'EXCEL', 'JSON']),
  handleValidationErrors,
];

const validateCreateDepartment = [
  body('name').trim().notEmpty().withMessage('Department name is required').isLength({ max: 200 }),
  body('code').trim().notEmpty().withMessage('Department code is required').isLength({ max: 20 }),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email format'),
  handleValidationErrors,
];

const validateCreateUser = [
  body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }).withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').trim().notEmpty().isLength({ max: 50 }),
  body('lastName').trim().notEmpty().isLength({ max: 50 }),
  body('role').isIn(['SUPER_ADMIN', 'COORDINATOR', 'FACULTY', 'GUEST']).withMessage('Please choose a role'),
  handleValidationErrors,
];

const validateNptelCourse = [
  body('courseName').trim().notEmpty().withMessage('Course name is required').isLength({ max: 300 }),
  body('startDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid start date'),
  body('completionDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid completion date'),
  handleValidationErrors,
];

const validateCreatePatent = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 500 }),
  body('inventors').isArray({ min: 1 }).withMessage('At least one inventor is required'),
  body('inventors.*').trim().notEmpty().withMessage('Inventor name cannot be empty'),
  body('grantingAuthority')
    .trim()
    .notEmpty()
    .withMessage('Granting authority is required')
    .isLength({ max: 300 }),
  body('grantStatus')
    .isIn(['APPLIED', 'PUBLISHED', 'GRANTED'])
    .withMessage('Invalid grant status'),
  body('patentNumber').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('filingDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid filing date'),
  body('grantDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid grant date'),
  handleValidationErrors,
];

const validateCreateAchievement = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 500 }),
  body('category')
    .isIn(['GRANT', 'CERTIFICATION', 'COMMITTEE_ROLE', 'AWARD', 'OTHER'])
    .withMessage('Invalid achievement category'),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 5000 }),
  body('achievementDate').isISO8601().withMessage('Valid achievement date is required'),
  body('awardingBody').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
  body('amount').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  handleValidationErrors,
];

const validateRecovery = [
  body('identifier').trim().notEmpty().withMessage('Email or phone is required').isLength({ max: 120 }),
  handleValidationErrors,
];

const validateGenerateNewsletter = [
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('templateId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid template ID'),
  handleValidationErrors,
];

module.exports = {
  handleValidationErrors,
  validateLogin,
  validateRegister,
  validateMongoId,
  validateCreateEvent,
  validateCreatePublication,
  validateCreateTemplate,
  validateCreateReport,
  validateCreateDepartment,
  validateCreateUser,
  validateNptelCourse,
  validateCreatePatent,
  validateCreateAchievement,
  validateGenerateNewsletter,
  validateRecovery,
};