import express from 'express';
import sanitizeHtml from 'sanitize-html';
import { body, param, query, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { normalizeReport, reportStatuses, vehicleTypes, violationTypes, zoneTypes } from '../models/Report.js';
import { createReport, getPublicStats, getReport, listReports, updateReport } from '../services/reportStore.js';

const router = express.Router();

const clean = (value) => sanitizeHtml(value || '', { allowedTags: [], allowedAttributes: {} }).trim();

router.post(
  '/',
  [
    body('videoUrl').isURL({ require_protocol: true }),
    body('vehicleType').isIn(vehicleTypes),
    body('violationType').isIn(violationTypes),
    body('zoneType').isIn(zoneTypes),
    body('noiseLevel').isInt({ min: 30, max: 120 }),
    body('location.latitude').isFloat({ min: -90, max: 90 }),
    body('location.longitude').isFloat({ min: -180, max: 180 }),
    body('description').isLength({ min: 5, max: 1000 }).withMessage('Description must be at least 5 characters long'),
    body('citizenContact').isLength({ min: 3, max: 120 }).withMessage('Contact details are required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Report validation failed', errors: errors.array() });
      }

      const report = normalizeReport({
        ...req.body,
        description: clean(req.body.description),
        citizenContact: clean(req.body.citizenContact),
        location: {
          ...req.body.location,
          address: clean(req.body.location?.address)
        }
      });
      const created = await createReport(report);
      return res.status(201).json(created);
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  '/',
  requireAuth,
  [
    query('status').optional({ values: 'falsy' }).isIn(reportStatuses),
    query('violationType').optional({ values: 'falsy' }).isIn(violationTypes),
    query('zoneType').optional({ values: 'falsy' }).isIn(zoneTypes)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Invalid filters', errors: errors.array() });
      }
      const reports = await listReports(req.query);
      return res.json({ reports });
    } catch (error) {
      return next(error);
    }
  }
);

router.get('/stats/public', async (_req, res, next) => {
  try {
    const stats = await getPublicStats();
    return res.json({ stats });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', [param('id').isString().isLength({ min: 4 })], async (req, res, next) => {
  try {
    const report = await getReport(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });
    return res.json({ report });
  } catch (error) {
    return next(error);
  }
});

router.patch(
  '/:id',
  requireAuth,
  [
    param('id').isString().isLength({ min: 4 }),
    body('status').optional().isIn(reportStatuses),
    body('assignedOfficer').optional().isLength({ max: 120 }),
    body('notes').optional().isLength({ max: 2000 })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Update validation failed', errors: errors.array() });
      }
      const updates = {
        ...(req.body.status ? { status: req.body.status } : {}),
        ...(typeof req.body.assignedOfficer === 'string' ? { assignedOfficer: clean(req.body.assignedOfficer) } : {}),
        ...(typeof req.body.notes === 'string' ? { notes: clean(req.body.notes) } : {})
      };
      const report = await updateReport(req.params.id, updates);
      if (!report) return res.status(404).json({ message: 'Report not found' });
      return res.json({ report });
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
