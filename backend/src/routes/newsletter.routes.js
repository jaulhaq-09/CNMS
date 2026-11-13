const express = require('express');
const router = express.Router();
const newsletterController = require('../controllers/newsletterController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { validateGenerateNewsletter, validateMongoId } = require('../middleware/validation');

// Coordinators manage their own department's newsletters; Super Admin manages all.
// The department check itself lives in the controller.
router.post(
  '/generate',
  authenticate,
  authorize('SUPER_ADMIN'),
  validateGenerateNewsletter,
  newsletterController.generateNewsletter
);

router.post(
  '/from-consolidated-report',
  authenticate,
  authorize('SUPER_ADMIN'),
  newsletterController.generateFromConsolidatedReport
);

// Everyone signed in can list; the controller limits what each role sees.
router.get('/', authenticate, newsletterController.getAllNewsletters);

router.get('/:id', authenticate, validateMongoId, newsletterController.getNewsletterById);

router.post(
  '/:id/schedule',
  authenticate,
  authorize('COORDINATOR', 'SUPER_ADMIN'),
  validateMongoId,
  newsletterController.scheduleNewsletter
);

router.post(
  '/:id/publish',
  authenticate,
  authorize('COORDINATOR', 'SUPER_ADMIN'),
  validateMongoId,
  newsletterController.publishNewsletter
);

router.delete(
  '/:id',
  authenticate,
  authorize('COORDINATOR', 'SUPER_ADMIN'),
  validateMongoId,
  newsletterController.deleteNewsletter
);

module.exports = router;