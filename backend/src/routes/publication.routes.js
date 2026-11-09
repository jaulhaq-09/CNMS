const express = require('express');
const router = express.Router();
const publicationController = require('../controllers/publicationController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { validateCreatePublication } = require('../middleware/validation');

router.post('/', authenticate, ...validateCreatePublication, publicationController.createPublication);

router.get('/', authenticate, publicationController.getAllPublications);

router.get('/:id', authenticate, publicationController.getPublicationById);

router.put('/:id', authenticate, publicationController.updatePublication);

router.delete('/:id', authenticate, publicationController.deletePublication);

router.post('/:id/submit', authenticate, publicationController.submitPublication);

router.post(
  '/:id/approve',
  authenticate,
  authorize('COORDINATOR', 'SUPER_ADMIN'),
  publicationController.approvePublication
);

router.post(
  '/:id/reject',
  authenticate,
  authorize('COORDINATOR', 'SUPER_ADMIN'),
  publicationController.rejectPublication
);

module.exports = router;