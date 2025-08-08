import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;

const router = express.Router();
const pool = new Pool();

function isAuthenticated(req, res, next) {
  if (req.session?.user?.id) return next();
  return res.redirect('/login');
}

/** PAGE FORMULAIRE (GET) **/
router.get('/:trajetId', isAuthenticated, async (req, res) => {
  const trajetId = parseInt(req.params.trajetId, 10);

  try {
    const trajetRes = await pool.query(`
      SELECT t.*, u.nom AS chauffeur_nom, u.prenom AS chauffeur_prenom
      FROM trajet t
      LEFT JOIN users u ON u.id = t.chauffeur_id
      WHERE t.id = $1
    `, [trajetId]);

    if (trajetRes.rowCount === 0) {
      return res.status(404).render('error', { message: "Trajet introuvable" });
    }

    const trajet = trajetRes.rows[0];

    // Compter les places déjà réservées
    const resResas = await pool.query(
      'SELECT COALESCE(SUM(places), 0) AS nb FROM reservations WHERE trajet_id = $1',
      [trajetId]
    );
    const dejaReservees = parseInt(resResas.rows[0].nb) || 0;

    const placesRestantes = (trajet.nombre_de_places ?? trajet.places) - dejaReservees;
    if (placesRestantes <= 0) {
      return res.status(400).render('error', { message: "Plus de places disponibles." });
    }

    res.render('reservation-form', { trajet, placesRestantes });
  } catch (err) {
    console.error('Erreur chargement formulaire réservation:', err);
    res.status(500).render('error', { message: "Erreur lors du chargement du formulaire." });
  }
});

/** SOUMISSION (POST) **/
router.post('/:trajetId', isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  const trajetId = parseInt(req.params.trajetId, 10);
  const nbPlaces = Math.max(1, parseInt(req.body.places || '1', 10));

  try {
    await pool.query('BEGIN');

    // Verrouiller le trajet (sécurité)
    const trajetRes = await pool.query(`
      SELECT id, chauffeur_id, prix_par_place, nombre_de_places
      FROM trajet
      WHERE id = $1
      FOR UPDATE
    `, [trajetId]);

    if (trajetRes.rowCount === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).render('error', { message: "Trajet introuvable" });
    }
    const trajet = trajetRes.rows[0];

    if (trajet.chauffeur_id === userId) {
      await pool.query('ROLLBACK');
      return res.status(400).render('error', { message: "Vous ne pouvez pas réserver votre propre trajet." });
    }

    // Places restantes
    const resaSum = await pool.query(
      'SELECT COALESCE(SUM(places), 0) AS nb FROM reservations WHERE trajet_id = $1 FOR UPDATE',
      [trajetId]
    );
    const dejaReservees = parseInt(resaSum.rows[0].nb) || 0;
    const placesRestantes = trajet.nombre_de_places - dejaReservees;

    if (placesRestantes < nbPlaces) {
      await pool.query('ROLLBACK');
      return res.status(400).render('error', { message: "Plus assez de places disponibles." });
    }

    // Crédits utilisateur (verrouillage)
    const creditRes = await pool.query(
      'SELECT montant FROM credits WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    let credits = creditRes.rowCount ? creditRes.rows[0].montant : null;
    if (credits === null) {
      await pool.query(
        'INSERT INTO credits(user_id, montant) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
        [userId, 20]
      );
      credits = 20;
    }

    const total = trajet.prix_par_place * nbPlaces;
    if (credits < total) {
      await pool.query('ROLLBACK');
      return res.status(400).render('error', { message: "Crédits insuffisants." });
    }

    // Réservation (éviter doublon user/trajet)
    await pool.query(`
      INSERT INTO reservations (trajet_id, user_id, places, credits_utilises)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (trajet_id, user_id) DO NOTHING
    `, [trajetId, userId, nbPlaces, total]);

    // Déduction crédits + places
    await pool.query(
      'UPDATE credits SET montant = montant - $1 WHERE user_id = $2',
      [total, userId]
    );
    await pool.query(
      'UPDATE trajet SET nombre_de_places = nombre_de_places - $1 WHERE id = $2',
      [nbPlaces, trajetId]
    );

    // Rafraîchir la session
    const refresh = await pool.query('SELECT montant FROM credits WHERE user_id = $1', [userId]);
    req.session.user.credits = refresh.rows[0].montant;

    await pool.query('COMMIT');

    return res.redirect(`/details/${trajetId}?success=reservation`);
  } catch (err) {
    console.error('Erreur lors de la réservation:', err);
    try { await pool.query('ROLLBACK'); } catch {}
    res.status(500).render('error', { message: "Erreur lors de la réservation." });
  }
});

export default router;
