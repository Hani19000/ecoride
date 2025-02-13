// controllers/profileController.js
import * as userModel from '../models/user.js';

export const showProfile = async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  const user = await userModel.findUserById(req.session.userId);
  if (!user) {
    return res.redirect('/login');
  }
  res.render('profile', { user });
};
