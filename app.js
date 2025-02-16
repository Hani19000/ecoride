import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt"

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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

app.get("/profile", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  res.render("profile", { user: req.session.user });
});

function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
}


// Mise à jour de app.js pour gérer l'ajout de voyage

app.post("/add-trip", ensureAuthenticated, async (req, res) => {
  const user = req.session.user;

  // Vérification de l'utilisateur et de ses crédits
  if (!user || !user.credits || user.credits < 2) {
    return res.status(400).send("Crédits insuffisants pour saisir un voyage.");
  }

  const { departure, arrival, price, vehicle } = req.body;
  let vehicleId;

  try {
    await db.query("BEGIN");

    // Vérification si l'utilisateur ajoute un nouveau véhicule
    if (vehicle === "new") {
      const { newMarque, newModele, newCouleur } = req.body;
      const vehicleResult = await db.query(
        "INSERT INTO vehicles (user_id, marque, modele, couleur) VALUES ($1, $2, $3, $4) RETURNING id",
        [user.id, newMarque, newModele, newCouleur]
      );
      vehicleId = vehicleResult.rows[0].id;
    } else {
      vehicleId = vehicle;
    }

    // Déduire 2 crédits de l'utilisateur
    const newCredits = user.credits - 2;
    await db.query("UPDATE users SET credits = $1 WHERE id = $2", [newCredits, user.id]);

    // Ajouter le voyage
    const tripResult = await db.query(
      "INSERT INTO trips (user_id, departure, arrival, price, vehicle_id, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [user.id, departure, arrival, price, vehicleId, "En attente"]
    );

    await db.query("COMMIT");

    // Mettre à jour la session utilisateur
    user.credits = newCredits;
    if (!user.trips) user.trips = [];
    user.trips.push(tripResult.rows[0]);
    req.session.user = user;

    res.redirect("/profile");
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Erreur lors de l'ajout du voyage:", err);
    res.status(500).send("Erreur serveur lors de l'ajout du voyage");
  }
});


