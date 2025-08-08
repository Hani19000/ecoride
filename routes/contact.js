import express from 'express';
import Contact from '../models/contact.js';

const router = express.Router();

// POST /contact
router.post('/', async (req, res) => {
  console.log("📥 Données reçues :", req.body); // <- log debug

  try {
    const { email, message } = req.body;

    if (!email || !message) {
      console.log("❌ Champs manquants");
      return res.status(400).json({ error: 'Email et message sont requis' });
    }

    console.log("💾 Sauvegarde dans MongoDB...");
    const nouveauContact = new Contact({ email, message });
    await nouveauContact.save();
    console.log("✅ Sauvegarde réussie");

    res.redirect('/index.html?success=1');
  } catch (error) {
    console.error('Erreur enregistrement contact :', error);
    res.redirect('/index.html?error=1');
  }
});

export default router;
