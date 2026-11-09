const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const aiService = require('../services/aiService');

// POST /api/ai/newsletter/generate
// Restricted to roles that already have NEWSLETTER_GENERATE on the frontend
// (Dean, Coordinator, Super Admin) — mirror that here so the permission
// isn't just a UI suggestion.
router.post('/newsletter/generate', authenticate, authorize('COORDINATOR', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const { events, tone, departmentName } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ message: 'events must be a non-empty array.' });
    }

    const draft = await aiService.generateNewsletterDraft(events, { tone, departmentName });
    return res.json(draft);
  } catch (err) {
    console.error('AI newsletter generation failed:', err.message);
    return res.status(502).json({ message: 'Could not generate newsletter draft. Please try again.' });
  }
});

// POST /api/ai/summarize
// Any authenticated user who can view events can request a summary.
router.post('/summarize', authenticate, async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) {
      return res.status(400).json({ message: 'description is required.' });
    }
    const summary = await aiService.summarizeEvent(description);
    return res.json({ summary });
  } catch (err) {
    console.error('AI summarize failed:', err.message);
    return res.status(502).json({ message: 'Could not summarize. Please try again.' });
  }
});

module.exports = router;