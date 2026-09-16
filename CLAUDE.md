# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Dev server on port 8080
npm run build     # Production build
npm run lint      # ESLint
npm run test      # Vitest (single run)
npm run test:watch
./deploy.sh       # Deploy to production (requires clean git state)
```

## Architecture

React 18 + TypeScript app with three independent dashboard sections for Karavel's IT inventory:

- **Siège et Groupes** → `src/pages/Index.tsx` → table `inventory_items`
- **Réseau Agences** → `src/pages/Agency.tsx` → table `agency_inventory`
- **ABcroisière** → `src/pages/Abcroisiere.tsx` → table `abcroisiere_inventory`

Each section follows the same pattern: a page component orchestrating stats cards, a data table, charts, and action modals. Components are scoped per section under `src/components/dashboard/`, `src/components/agency/`, `src/components/abcroisiere/`.

## Supabase

Client at `src/integrations/supabase/client.ts`, types in `src/integrations/supabase/types.ts`.
All data fetching goes through custom hooks in `src/hooks/` using TanStack React Query. Mutations invalidate their query key automatically. Batch upserts are used for imports (200 items/batch for siège, 500 for agencies).

## Authentication and Sensitive Actions

Access is gated by **Authelia** in front of Nginx, backed by Active Directory
(`in.karavel.com`). The portal is served at `/authelia` on the same vhost. Two AD
groups: `karinventaire-tech` grants access, `karinventaire-admin` grants the
destructive actions. See `deploy/authelia/README.md`.

The app learns who is connected through `GET /api/me` (`server/index.js`), which
echoes the `Remote-User` / `Remote-Groups` headers Authelia sets. Consume it via
`useMe()` / `useMeAsTechnician()` in `src/hooks/useMe.ts`. `uid` is the AD
`sAMAccountName` and matches both `src/lib/technicians.ts` ids and
`support_appointments.uid_technicien` — no mapping table.

Those headers are only trustworthy because Nginx **overwrites** any client-sent
`Remote-*` and because the API listens on `127.0.0.1` only. Never bind it to
`0.0.0.0`.

**Bulk-destructive actions** (Import, Reset) are reserved for
`karinventaire-admin`: wrap their trigger in `<AdminOnly>` and add
`if (!isAdmin) return <AdminRequired onClose={onClose} />;` inside the modal —
see `src/components/AdminOnly.tsx`. Route any new bulk action through this
pattern.

This is a guardrail against mistakes, **not a security boundary**: an
authenticated technician can still call PostgREST directly with the anon key
from the browser console. A real boundary would require routing writes through
the Express API, which can check `Remote-Groups` server-side.

## Téléphonie (Axialys)

Statistiques de la ligne du support IT, onglet `Support → Téléphonie`
(`src/components/support/SupportTelephonie.tsx`).

**Le point non-évident :** l'API Axialys (`api.axialys.com`, header
`Authorization: APIKey`) **ignore les paramètres de période** `dt` / `dt_end` et
ne renvoie que **le jour courant depuis minuit** (Europe/Paris) — sondé le
11/09/2026 à 11h16 : 3398 appels, tous du 11/09, le plus ancien à 00h36, rien de
la veille. `server/scripts/probe-axialys-window.js` rejoue la mesure.

L'historique n'est donc pas rejouable : il se **constitue** par les crons de
`server/index.js`, qui écrivent dans `axialys_calls`. Ils tournent **pendant la
journée** (toutes les heures, plus une passe de clôture à 23h58) — une ingestion
nocturne ne capturerait rien, ce qui a coûté les journées du 08 au 10/09/2026.
Une journée non capturée est perdue ; seul l'export CSV peut la rattraper.

Le rattrapage du passé se fait par export CSV du portail, via
`server/scripts/import-axialys-csv.js`. Cet export ne porte ni temps d'attente
ni post-appel (colonnes `source='csv'`, moyennes d'attente à `null`).

Variables d'environnement : `AXIALYS_TOKEN` (obligatoire, sinon l'ingestion est
désactivée), `AXIALYS_GROUP` (défaut `Support IT KVL`), `AXIALYS_TZ`,
`AXIALYS_CRON` (défaut `5 * * * *`), `AXIALYS_CRON_CLOSE` (défaut `58 23 * * *`).

La ligne de log d'une passe donne les ingérés **et** le total rendu avant filtre
(`30 appels ingérés sur 3398 rendus`) : c'est ce qui distingue une journée calme
d'une ingestion en panne, les deux affichant sinon le même zéro.

Le token voit **toute** la téléphonie Karavel, relation client sous-traitée
comprise : le filtre sur le groupe est appliqué à l'ingestion, jamais à
l'affichage. Les agents de la ligne sont l'équipe TSI, **distincte** de
`src/lib/technicians.ts`.

## Synchronisation de l'inventaire (ESET / OCS)

`inventory_items.windows_version` ne se saisit plus à la main : elle est reprise
aux outils par `syncInventory()` (`server/index.js`), que déclenchent une passe
de nuit et le bouton « Maj » du camembert *Versions Windows*.

**Le périmètre s'arrête à l'OS**, et ce n'est pas un choix : **ESET ne publie pas
le produit installé**. `activeProducts` et `deployedComponents` sont vides sur
les 904 devices, et son API REST n'expose que `/v1/devices` et
`/v1/device_groups` — 404 sur une douzaine d'autres ressources, sans le moindre
401/403, donc ce n'est pas une question de droits (sondé le 16/09/2026). La
colonne « Application de sécurité » de l'export de console vient de son moteur
de rapports, qui n'a pas d'équivalent REST. `eset_app` reste donc alimentée par
l'import Excel, et le camembert *Type app. ESET* n'a **volontairement pas** de
bouton « Maj ». Décision du 16/09/2026 : on n'y revient pas, la solution
antivirus doit changer.

**Lire `/v1/devices`, jamais `/v1/device_groups/{racine}/devices`.** Le premier
rend l'objet complet, OS compris ; le second ne rend que `displayName`,
`groupUuid` et `uuid`, ce qui obligeait à un appel de détail par poste — 700
allers-retours au lieu d'une page. Les deux couvrent le même parc. Le détail
unitaire ne sert plus qu'aux rares devices sans OS (2 sur 904).

**ESET d'abord, OCS en repli.** OCS n'a pas d'endpoint de masse — deux requêtes
par poste — et ne sert donc qu'aux machines absentes d'ESET, sous le plafond
`INVENTORY_SYNC_OCS_MAX` (150). Au-delà, la passe s'arrête et le dit : un parc
soudain absent d'ESET est une panne d'ESET, pas une invitation à lancer 700
recherches OCS.

**Les libellés sont normalisés**, dans `server/lib/inventoryNormalize.js` (le
seul morceau testable sans réseau — `src/test/inventoryNormalize.test.ts`).
ESET rend « Microsoft Windows 11 Pro », OCS « Microsoft Windows 11
Professionnel » : sans normalisation le camembert éclate en parts d'un poste.
Le hors-Windows est regroupé en « Linux » / « macOS », Zorin et Rocky compris —
ils sont apparus au premier relevé réel, un poste chacun.

**Une valeur nulle n'est jamais écrite.** Un poste éteint depuis un mois sort des
outils ; effacer sa version remplacerait une donnée vieillie par une case vide.
La fraîcheur se lit sur `inventory_items.synced_at` (dernier rapprochement
*réussi*, pas dernière passe) et `sync_source`.

**Le piège, déjà payé sur Axialys :** une source en panne et un parc stable
rendent tous les deux « 0 mis à jour ». `inventory_sync_runs` enregistre donc
aussi `eset_devices`, le volume rendu AVANT rapprochement — 0 device est une
panne, 900 devices sans changement est un parc à jour. L'interface le dit aussi
(« ESET muet le … » sous le titre du camembert).

`POST /api/inventory/sync` vérifie `Remote-Groups` **côté serveur** : contrairement
aux autres actions de masse, celle-ci est une vraie barrière et pas seulement le
garde-fou `<AdminOnly>`, parce qu'elle transite par l'API Express.

Variables d'environnement : `ESET_URL` / `ESET_USER` / `ESET_PASS`, `OCS_URL` /
`OCS_USER` / `OCS_PASS`, `INVENTORY_SYNC_CRON` (défaut `30 2 * * *`),
`INVENTORY_SYNC_TZ` (défaut `Europe/Paris`), `INVENTORY_SYNC_OCS_MAX`.
Sans aucun identifiant, la synchro est désactivée et le dit au démarrage.

`server/scripts/probe-eset-fields.js` revérifie que la source tient ses
promesses : parc complet, OS toujours rempli, et ce que vaudrait le camembert
après normalisation.

Seul le siège est couvert ; `agency_inventory`, `province_inventory` et
`abcroisiere_inventory` suivront et partageront `inventory_sync_runs`
(colonne `table_name`).

## Localiser un collaborateur du réseau agences

`GET /api/ocs/user/:uid` rend les machines sur lesquelles un uid a ouvert une
session, d'après OCS, avec l'agence déduite de l'IP. Il s'exécute **en plus** des
inventaires dans la recherche rapide du support (`OcsUserResult.tsx`), pas
seulement quand ceux-ci ne rendent rien : un collaborateur peut avoir une ligne
au siège et une session relevée ailleurs, et c'est l'écart qui renseigne. Le
volet s'affiche avant le tableau — la correspondance est exacte sur l'uid, donc
plus sûre que les `ilike` des inventaires. L'appel n'est déclenché que si la
saisie ressemble à un identifiant (`looksLikeUid`), sinon chaque frappe
interrogerait OCS pour rien.

**Pourquoi ça ne peut pas venir des tables d'inventaire :** les collaborateurs
du réseau agences n'y sont **volontairement pas saisis**. Ils n'ont pas de poste
attribué et changent d'agence régulièrement — une ligne d'inventaire serait
fausse le mois suivant. Leur uid ne dit donc rien de leur localisation.

**Pourquoi pas ESET :** il est centré machine et n'expose aucun utilisateur
connecté, d'où le `loggedInUsers: null` de `/api/eset/computer`.

**OCS répond** parce que `hardware.USERID` porte la session ouverte au dernier
inventaire, et `IPADDR` l'adresse de la machine. `/computers/search?USERID=`
accepte bien ce critère : une requête, pas un parcours — le parcours complet du
parc prend 21 s pour 1177 machines (`server/scripts/probe-ocs-user.js`). `USERID`
est renseigné sur 1048 d'entre elles.

**L'agence vient du sous-réseau** (`server/lib/agencySubnet.js`, testé dans
`src/test/agencySubnet.test.ts`). `agency_inventory.sous_reseau` n'est affiché
nulle part dans l'interface et rien n'en garantit l'écriture : le rapprochement
accepte `10.12.145.0`, `10.12.145.0/24`, `10.12.145` et `10.12.145.x`, lit
`masque` quand il ressemble à un masque, et retombe sur /24 sinon. Le réseau le
plus spécifique gagne, sans quoi un /8 englobant répondrait à la place d'un /24
d'agence. L'agence est **toujours rendue avec le sous-réseau qui l'a désignée**,
pour qu'un rapprochement faux se voie au lieu de se deviner.

**Ce que la réponse vaut** — et l'interface le dit avant d'afficher la donnée :
c'est la session ouverte **au dernier inventaire**, pas une position en direct.
Quelqu'un qui a changé d'agence depuis apparaît encore à l'ancienne. L'âge est
affiché en clair et vire à l'ambre au-delà de quinze jours ; une IP de trois
semaines ne se tente pas.

La recherche OCS étant un `LIKE`, `dlelong` ramènerait `dlelong2` : la
correspondance exacte sur l'uid est revérifiée côté serveur avant de rendre quoi
que ce soit — le résultat sert à localiser une personne.

## Key Utilities

- `src/lib/parseInventory.ts` — parses Excel files with flexible French/English column name mapping
- `src/lib/exportUtils.ts` — PDF (jsPDF) and Excel (XLSX) export
- `src/lib/zapierWebhook.ts` — Zapier webhook, URL persisted in localStorage

## Deployment

`deploy.sh` pushes to GitHub then SSHs into `karinventaire01.in.karavel.com` to pull, build, and restart PM2 (`karavundoboard-front`). The script requires a clean git working tree before running.
