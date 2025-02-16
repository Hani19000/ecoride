import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt"
import path from "path";

const saltRounds = 10;
const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "users",
  password: "19000",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

app.get("/profile", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  res.render("profile", { user: req.session.user });
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.post("/register", async (req, res) => {
  const { username: email, password, nom, prenom, address, departement, ville } = req.body;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (checkResult.rows.length > 0) {
      return res.send("Email already exists. Try logging in.");
    }

    // 🔒 Hachage du mot de passe
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await db.query(
      "INSERT INTO users (email, password, nom, prenom, address, departement, ville) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [email, hashedPassword, nom, prenom, address, departement, ville]
    );

    const user = result.rows[0];

    // 🔄 Passer les infos utilisateur à profile.ejs
    res.render("profile.ejs", { user });

  } catch (err) {
    console.log(err);
    res.status(500).send("Erreur serveur");
  }
});


app.post("/api/register", async (req, res) => {
  const { username: email, password, nom, prenom, address, departement, ville } = req.body;
  
  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: "Email already exists. Try logging in." });
    } else {
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      await db.query(
        "INSERT INTO users (email, password, nom, prenom, address, departement, ville) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [email, hashedPassword, nom, prenom, address, departement, ville]
      );
      res.status(201).json({ message: "User registered successfully!" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/login", async (req, res) => {
  const { username: email, password } = req.body;

  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (result.rows.length === 0) {
      return res.send("Utilisateur non trouvé");
    }

    const user = result.rows[0];

    // 🔄 Vérification sécurisée avec bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.send("Mot de passe incorrect");
    }

    // ✅ Si le mot de passe est correct, rendre le profil
    res.render("profile.ejs", { user });

  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur");
  }
});



app.post("/api/login", async (req, res) => {
  const { username: email, password } = req.body;

  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const isMatch = await bcrypt.compare(password, user.password);

      if (isMatch) {
        res.json({ message: "Login successful", user });
      } else {
        res.status(401).json({ message: "Incorrect password" });
      }
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});


// ✅ Route pour afficher les trajets disponibles
app.get("/trajets", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*, u.nom AS chauffeur_nom, v.marque, v.modele
       FROM trajet t
       JOIN users u ON t.chauffeur_id = u.id
       LEFT JOIN vehicule v ON t.vehicule_id = v.id`
    );
    res.render("trajets", { trajets: result.rows });
  } catch (err) {
    console.error("Erreur lors de la récupération des trajets:", err);
    res.status(500).send("Erreur serveur");
  }
});

// ✅ Route pour enregistrer un trajet depuis profile.ejs
app.post("/trajets", async (req, res) => {
  console.log("Données reçues:", req.body); // Debugging

  const {
    depart, destination, dateTrajet,dureetrajet, heureDepart, heureArrivee, places, prix} = req.body;
  const chauffeur_id = req.session?.user?.id || 1; // Remplace par l'ID de session réelle

  if (!depart || !destination) {
    console.error("Erreur : Lieu de départ ou destination manquant !");
    return res.status(400).send("Erreur : Tous les champs sont requis !");
  }

  try {
    await db.query(
      `INSERT INTO trajet (lieu_depart, destination, date_du_trajet, duree_du_trajet,heure_depart, heure_arrivee, nombre_de_places, prix_par_place, chauffeur_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [depart, destination, dateTrajet, dureetrajet, heureDepart, heureArrivee, places, prix, chauffeur_id]
    );
    res.redirect("/trajets");
  } catch (err) {
    console.error("Erreur lors de l'ajout du trajet:", err);
    res.status(500).send("Erreur lors de l'ajout du trajet");
  }
});

//détails trajets//

// Débogage de la requête pour vérifier pourquoi le trajet n'est pas trouvé

// Vérification de la réponse HTTP pour comprendre pourquoi "Trajet non trouvé" s'affiche

app.get("/details/:id", async (req, res) => {
  const trajetId = req.params.id;
  
  if (isNaN(trajetId)) {
      console.error("❌ Erreur: ID du trajet invalide -", trajetId);
      return res.status(400).render("details", { error: "ID du trajet invalide", trajet: null, user: req.session ? req.session.user : null });
  }
  
  console.log("ID du trajet reçu:", trajetId);

  try {
      const result = await db.query(
          `SELECT t.*, u.nom AS chauffeur_nom, u.prenom AS chauffeur_prenom,
                  v.plaque_immatriculation, v.date_premiere_immatriculation, v.marque, 
                  v.modele, v.couleur, v.nombre_places_disponibles
           FROM trajet t
           JOIN users u ON t.chauffeur_id = u.id
           LEFT JOIN vehicule v ON t.vehicule_id = v.id
           WHERE t.id = $1`, [trajetId]
      );
      
      console.log("Résultat brut de la requête:", result);
      console.log("Résultat des lignes retournées:", result.rows);
      
      if (!result.rows || result.rows.length === 0) {
          console.log("⚠️ Trajet non trouvé dans la base de données. Vérifiez si l'ID existe.");
          return res.render("details", { error: "Trajet non trouvé", trajet: {}, user: req.session ? req.session.user : null });
      }

      const trajet = result.rows[0];
      console.log("✅ Trajet récupéré:", trajet);
      res.render("details", { trajet, user: req.session ? req.session.user : null });
  } catch (error) {
      console.error("❌ Erreur récupération du trajet:", error);
      res.status(500).render("details", { error: "Erreur serveur", trajet: {}, user: req.session ? req.session.user : null });
  }
});








app.post("/participer/:id", async (req, res) => {
  if (!req.session.user) {
      return res.redirect("/login");
  }

  const userId = req.session.user.id;
  try {
      const trajetResult = await pool.query("SELECT places, prix_par_place, chauffeur_id FROM trajet WHERE id = $1", [req.params.id]);
      if (trajetResult.rows.length === 0) {
          return res.status(404).send("Trajet non trouvé");
      }

      const trajet = trajetResult.rows[0];
      if (trajet.places <= 0) {
          return res.send("Désolé, il n'y a plus de place disponible.");
      }

      const userResult = await pool.query("SELECT credits FROM users WHERE id = $1", [userId]);
      const userCredits = userResult.rows[0].credits;

      if (userCredits < trajet.prix_par_place) {
          return res.send("Vous n'avez pas assez de crédits.");
      }

      // Double confirmation
      if (!req.body.confirmation) {
          return res.render("confirmation", { trajet, user: req.session.user });
      }

      // Mise à jour des crédits et places disponibles
      await pool.query("UPDATE users SET credits = credits - $1 WHERE id = $2", [trajet.prix_par_place, userId]);
      await pool.query("UPDATE trajet SET places = places - 1 WHERE id = $1", [req.params.id]);
      await pool.query("INSERT INTO reservations (trajet_id, passager_id) VALUES ($1, $2)", [req.params.id, userId]);

      res.redirect("/index");
  } catch (error) {
      console.error("Erreur lors de la réservation :", error);
      res.status(500).send("Erreur serveur");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


