CREATE TABLE users(
id SERIAL PRIMARY KEY,
email VARCHAR(100) NOT NULL UNIQUE,
password VARCHAR(100),
nom VARCHAR(100),
prenom VARCHAR(100),
address VARCHAR(100),
departement VARCHAR(100),
ville VARCHAR(100)
)

CREATE TABLE vehicule (
    id SERIAL PRIMARY KEY,
    plaque_immatriculation VARCHAR(100) NOT NULL UNIQUE,
    date_premiere_immatriculation VARCHAR(100) NOT NULL UNIQUE,
    marque VARCHAR(100) NOT NULL,
    modele VARCHAR(100) NOT NULL,
    couleur VARCHAR(100),
    nombre_places_disponibles INTEGER NOT NULL,
    preferences VARCHAR(100)
);

CREATE TABLE preference (
    id SERIAL PRIMARY KEY,
    animal VARCHAR(100),
    fumeur VARCHAR(100)
);

CREATE TABLE trajet (
    id SERIAL PRIMARY KEY,
    lieu_depart VARCHAR(100) NOT NULL,
    lieu_arrivee VARCHAR(100) NOT NULL,
    date_du_trajet DATE NOT NULL,
    heure_du_trajet TIME NOT NULL,
    nombre_de_places INTEGER NOT NULL,
    nombre_places_disponibles INTEGER NOT NULL,
    prix_par_place DECIMAL(10,2) NOT NULL
);

CREATE TABLE role (
    id SERIAL PRIMARY KEY,
    chauffeur VARCHAR(100) NOT NULL,
    passager VARCHAR(100) NOT NULL,
);

ALTER TABLE trajet
ADD COLUMN heure_depart TIME,
ADD COLUMN heure_arrivee TIME;

-- Supprimer la table credits si elle existe déjà
DROP TABLE IF EXISTS credits CASCADE;

-- Recréer la table credits
CREATE TABLE credits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    montant INTEGER NOT NULL DEFAULT 20,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insérer les crédits pour tous les utilisateurs existants
INSERT INTO credits (user_id, montant)
SELECT id, 20
FROM users
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    trajet_id INTEGER REFERENCES trajet(id),
    user_id INTEGER REFERENCES users(id),
    date_reservation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    credits_utilises INTEGER NOT NULL,
    statut VARCHAR(20) DEFAULT 'confirmé',
    CONSTRAINT fk_trajet FOREIGN KEY (trajet_id) REFERENCES trajet(id),
    CONSTRAINT fk_user_reservation FOREIGN KEY (user_id) REFERENCES users(id)
);

app.use(express.static("/"));
app.use(express.json()); 