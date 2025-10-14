FROM node:18

WORKDIR /app

# Copier les fichiers de config uniquement
COPY package*.json ./

# Installer les dépendances dans le conteneur
RUN npm install

# Copier le reste du code
COPY . .

EXPOSE 3000
CMD ["node", "app.js"]

