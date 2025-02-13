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

router.get('/', async (req, res) => {
    if (!req.session.userId) {
      return res.redirect('/login');
    }
    const user = await userModel.findUserById(req.session.userId);
    res.render('profile', { user });
  });
  

export default router;
