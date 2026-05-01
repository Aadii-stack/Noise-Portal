import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { getOfficerUser } from '../models/User.js';

const router = express.Router();

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').isLength({ min: 1, max: 128 })],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Invalid login input', errors: errors.array() });
    }

    const officer = getOfficerUser();
    if (req.body.email !== officer.email || req.body.password !== officer.password) {
      return res.status(401).json({ message: 'Invalid officer credentials' });
    }

    const token = jwt.sign(
      { sub: officer.id, email: officer.email, role: officer.role },
      process.env.JWT_SECRET || 'local-development-secret',
      { expiresIn: '8h' }
    );

    return res.json({ token, user: { email: officer.email, role: officer.role } });
  }
);

export default router;
