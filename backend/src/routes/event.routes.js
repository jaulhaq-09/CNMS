const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { validateCreateEvent } = require('../middleware/validation');
const upload = require('../middleware/upload');

router.post(
  '/',
  authenticate,
  authorize('FACULTY', 'COORDINATOR', 'SUPER_ADMIN'),
  ...validateCreateEvent,
  eventController.createEvent
);

router.get('/', authenticate, eventController.getAllEvents);

router.get('/:id', authenticate, eventController.getEventById);

router.put('/:id', authenticate, eventController.updateEvent);

router.delete('/:id', authenticate, eventController.deleteEvent);

router.post('/:id/submit', authenticate, eventController.submitEvent);

router.post(
  '/:id/approve',
  authenticate,
  authorize('COORDINATOR', 'SUPER_ADMIN'),
  eventController.approveEvent
);

router.post(
  '/:id/reject',
  authenticate,
  authorize('COORDINATOR', 'SUPER_ADMIN'),
  eventController.rejectEvent
);

// Multer's own errors (wrong file type, too large, too many files) are
// handled inline here rather than in the controller, since they occur
// during middleware execution before the controller ever runs.
router.post('/:id/photos', authenticate, (req, res) => {
  upload.array('photos', 5)(req, res, (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({
        success: false,
        message: uploadErr.message,
      });
    }
    eventController.uploadEventPhotos(req, res);
  });
});

module.exports = router;