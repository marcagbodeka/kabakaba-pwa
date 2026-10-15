# kabakaba-pwa

PWA web pour utiliser Kabakaba **avant** le déploiement des apps mobiles.

## Principe

- UI alignée sur les apps Flutter réelles (`kabakaba-vendeur`, puis `kabakaba`)
- API = backend actuel (CDC V1.3)
- Apps Flutter mises à jour plus tard, séparément

## Apps

| App | Dossier | Port dev |
|---|---|---|
| Vendeur | `apps/vendor` | `5174` |
| Étudiant | `apps/student` | `5173` |

## Vendeur — démarrage

```bash
cd kabakaba-pwa
cp apps/vendor/.env.example apps/vendor/.env
# optionnel : éditer VITE_API_BASE_URL
npm install
npm run dev:vendor
```

Ouvre `http://localhost:5174`. Sur téléphone (même réseau) : `http://<IP-machine>:5174`.

## Parcours vendeur

1. Activation : téléphone + mot de passe temporaire → OTP → PIN  
2. Reconnexion : PIN  
3. Dashboard : Commandes · Portefeuille · Stats · Profil  

### Commandes (backend CDC)

| Onglet Flutter | Statuts API |
|---|---|
| Nouvelles | `CONFIRMED` |
| Préparation | `IN_PREPARATION` |
| Prêtes | `READY` |
| Historique | `RECEIVED`, `CANCELLED` |

Actions : commencer préparation → marquer prête → marquer récupérée · annuler avec motif.

## Étudiant — démarrage

```bash
cd kabakaba-pwa
cp apps/student/.env.example apps/student/.env
npm install
npm run dev:student
```

→ `http://localhost:5173`

Parcours : OTP (+ campus à l’inscription) → Accueil → cantine (menus / composer) → panier (sur place / à emporter) → commande → historique.

## Build

```bash
npm run build:vendor
npm run build:student
```

Sorties : `apps/vendor/dist` et `apps/student/dist` (PWA installables).
