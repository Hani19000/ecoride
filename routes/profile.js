// routes/profile.js
import express from 'express';
import { showProfile } from '../controllers/profileController.js';

const router = express.Router();

// Middleware pour vérifier l'authentification
const ensureAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/login');
};

router.get('/', ensureAuthenticated, showProfile);

export default router;
