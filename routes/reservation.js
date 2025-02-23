import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;

const router = express.Router();
const pool = new Pool();

// Middleware pour vérifier si l'utilisateur est connecté
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Route pour réserver un trajet
router.post('/reserver-trajet', isAuthenticated, async (req, res) => {
    const { trajetId, credits } = req.body;
    const userId = req.session.user.id;

    try {
        // Début de la transaction
        await pool.query('BEGIN');

        // 1. Vérifier si l'utilisateur a assez de crédits
        const userCredits = await pool.query(
            'SELECT COALESCE(montant, 20) as montant FROM credits WHERE user_id = $1 FOR UPDATE',
            [userId]
        );

        // Si l'utilisateur n'a pas d'entrée dans la table credits, en créer une
        if (!userCredits.rows[0]) {
            await pool.query(
                'INSERT INTO credits (user_id, montant) VALUES ($1, 20) ON CONFLICT (user_id) DO NOTHING',
                [userId]
            );
            userCredits.rows[0] = { montant: 20 };
        }

        if (userCredits.rows[0].montant < credits) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ 
                error: 'Crédits insuffisants',
                credits_disponibles: userCredits.rows[0].montant,
                credits_necessaires: credits
            });
        }

        // 2. Vérifier s'il reste des places disponibles
        const trajet = await pool.query(
            'SELECT nombre_de_places, chauffeur_id FROM trajet WHERE id = $1 FOR UPDATE',
            [trajetId]
        );

        // Compter le nombre de réservations existantes
        const reservationsCount = await pool.query(
            'SELECT COUNT(*) FROM reservations WHERE trajet_id = $1',
            [trajetId]
        );

        const placesRestantes = trajet.rows[0].nombre_de_places - parseInt(reservationsCount.rows[0].count);

        if (placesRestantes <= 0) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ 
                error: 'Plus de places disponibles' 
            });
        }

        // 3. Vérifier si l'utilisateur n'a pas déjà réservé ce trajet
        const existingReservation = await pool.query(
            'SELECT id FROM reservations WHERE trajet_id = $1 AND user_id = $2',
            [trajetId, userId]
        );

        if (existingReservation.rows.length > 0) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ 
                error: 'Vous avez déjà réservé ce trajet' 
            });
        }

        // 4. Créer la réservation
        await pool.query(
            'INSERT INTO reservations (trajet_id, user_id, credits_utilises, statut) VALUES ($1, $2, $3, $4)',
            [trajetId, userId, credits, 'confirmé']
        );

        // 5. Mettre à jour les crédits de l'utilisateur
        await pool.query(
            'UPDATE credits SET montant = montant - $1 WHERE user_id = $2',
            [credits, userId]
        );

        // 6. Mettre à jour le nombre de places disponibles
        await pool.query(
            'UPDATE trajet SET nombre_de_places = nombre_de_places - 1 WHERE id = $1',
            [trajetId]
        );

        // 7. Mettre à jour les crédits dans la session
        req.session.user.credits = userCredits.rows[0].montant - credits;

        // Valider la transaction
        await pool.query('COMMIT');

        res.json({
            success: true,
            message: 'Réservation confirmée',
            newCredits: req.session.user.credits
        });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Erreur lors de la réservation:', err);
        res.status(500).json({ 
            error: 'Une erreur est survenue lors de la réservation' 
        });
    }
});

export default router;
