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

BEGIN;


CREATE TABLE IF NOT EXISTS credits (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  montant INTEGER NOT NULL DEFAULT 20,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='users' AND column_name='credits'
  ) THEN
    INSERT INTO credits (user_id, montant)
    SELECT id, COALESCE(credits, 20) FROM users
    ON CONFLICT (user_id) DO UPDATE SET montant = EXCLUDED.montant;

    ALTER TABLE users DROP COLUMN IF EXISTS credits;
  END IF;
END $$;

ALTER TABLE IF NOT EXISTS reservations
  ADD COLUMN IF NOT EXISTS places INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='reservations' AND constraint_name='uniq_user_trajet'
  ) THEN
    ALTER TABLE reservations
      ADD CONSTRAINT uniq_user_trajet UNIQUE (trajet_id, user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trajet' AND column_name='places') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trajet' AND column_name='nombre_de_places') THEN
    ALTER TABLE trajet RENAME COLUMN places TO nombre_de_places;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION create_credits_row() RETURNS trigger AS $$
BEGIN
  INSERT INTO credits(user_id, montant)
  VALUES (NEW.id, 20)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_after_insert_credits ON users;

CREATE TRIGGER trg_users_after_insert_credits
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_credits_row();



COMMIT;

app.use(express.static("/"));
app.use(express.json()); 