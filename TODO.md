# TODO: Ajouter case RGPD obligatoire dans formulaire d'inscription

- [x] Modifier views/register.ejs : Ajouter checkbox RGPD obligatoire
- [x] Modifier app.js : Vérifier côté serveur que RGPD est accepté
- [x] Tester l'inscription

# TODO: Implémenter "Se souvenir de moi" pour la connexion

- [x] Lire views/login.ejs pour voir la checkbox
- [x] Modifier POST /login et /api/login pour ajuster maxAge si checkbox cochée
- [x] Tester la connexion

# TODO: Améliorer la page d'erreur

- [x] Modifier views/error.ejs pour la rendre plus attrayante
- [x] Uniformiser les erreurs dans app.js pour rediriger vers error.ejs
- [x] Tester les erreurs
