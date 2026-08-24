# Authentification Active Directory — karavundoboard

Portail **Authelia** devant Nginx, adossé à l'Active Directory `in.karavel.com`.
Les techniciens saisissent leur identifiant et leur mot de passe AD ;
l'appartenance à un groupe AD décide de l'accès.

Ce dossier est un **modèle versionné**. La version remplie vit sur le serveur et
contient des secrets : elle ne doit jamais revenir dans git.

---

## État du raccordement AD — validé le 2026-08-24

Vérifié par bind réel depuis le poste de dev (`scripts/test-ad-bind.py`) :

| | |
|---|---|
| Contrôleur | `ad02.in.karavel.com:636` — LDAPS, bind accepté |
| Base DN | `DC=in,DC=karavel,DC=com` |
| Compte de service | `cs-karinventaire@in.karavel.com` — **forme UPN obligatoire** |
| Techniciens résolus | 7/7, `sAMAccountName` identique à l'identifiant applicatif |
| `karinventaire-tech` | 6 membres |
| `karinventaire-admin` | 1 membre (`ext-favundo`) |

**Le `sAMAccountName` correspond exactement aux `id` de `src/lib/technicians.ts`.**
C'est ce qui permet de relier l'utilisateur connecté à son planning
(`support_appointments.uid_technicien`) sans table de correspondance.

> ⚠️ L'AD **refuse** le `sAMAccountName` nu (`cs-karinventaire`) en bind simple.
> Il répond `invalid credentials (49)`, exactement comme pour un mot de passe
> faux. Toujours utiliser la forme `compte@in.karavel.com`.

---

## Ce qu'il reste à fournir

4 valeurs, **toutes secrètes**, à renseigner directement sur le serveur :

| Placeholder | Origine |
|---|---|
| `À_REMPLIR_MDP_COMPTE_DE_SERVICE` | mot de passe de `cs-karinventaire` |
| `À_REMPLIR_SECRET_JWT` | généré (étape 2) |
| `À_REMPLIR_SECRET_SESSION` | généré (étape 2) |
| `À_REMPLIR_CLE_CHIFFREMENT_STOCKAGE` | généré (étape 2) |

---

## Procédure de déploiement

L'ordre compte. **On valide le portail avant de brancher `auth_request`** :
l'inverse coupe l'accès à tout le monde si Authelia ne démarre pas.

### Étape 1 — Enregistrement DNS

`auth.in.karavel.com` n'existe pas encore. Il faut le créer :

```
auth.in.karavel.com.  A  10.12.8.12
```

(ou un CNAME vers `karinventaire01.in.karavel.com`)

Le certificat TLS en place est un **wildcard `*.in.karavel.com`** (Sectigo) :
il couvre déjà ce sous-domaine, aucun certificat à demander.

> ⚠️ Ce certificat **expire le 16 septembre 2026**. Après cette date, l'appli
> *et* le portail tombent ensemble. À renouveler indépendamment de ce chantier.

### Étape 2 — Secrets

```bash
for s in jwt_secret session_secret storage_encryption_key; do
  echo "$s: $(docker run --rm authelia/authelia:4.38 \
    authelia crypto rand --length 64 --charset alphanumeric | tail -1)"
done
```

### Étape 3 — Installer Authelia

```bash
sudo mkdir -p /opt/authelia && cd /opt/authelia
# y copier configuration.yml et docker-compose.yml
# puis remplacer les 4 À_REMPLIR dans configuration.yml
sudo chmod 600 configuration.yml       # il contient désormais des secrets

docker compose up -d
docker compose logs -f authelia        # attendre « Startup complete »
```

Si les logs mentionnent LDAP, c'est que le bind échoue : reprendre le mot de
passe du compte de service avant d'aller plus loin.

### Étape 4 — Publier le portail, et RIEN d'autre

Ajouter le vhost `auth.in.karavel.com` (voir `nginx-karavundoboard.conf`), puis :

```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Valider maintenant, avant de toucher au vhost de l'appli :** ouvrir
`https://auth.in.karavel.com`, se connecter avec son compte AD. Une connexion
réussie prouve d'un coup le DNS, le certificat, le bind AD et les groupes.

Tant que cette page ne fonctionne pas, ne pas passer à l'étape 5.

### Étape 5 — Protéger l'application

1. Déposer `authelia-authrequest.conf` dans `/etc/nginx/snippets/`.
2. Dans le vhost `karinventaire01`, ajouter le bloc
   `location = /internal/authelia/authz` (voir `nginx-karavundoboard.conf`).
3. Ajouter **une seule ligne** dans chaque `location` à protéger — `/`, `/api/`
   et celle qui sert PostgREST :

   ```nginx
   include /etc/nginx/snippets/authelia-authrequest.conf;
   ```

   > Ne pas recopier les `proxy_pass` de `nginx-karavundoboard.conf` : ce sont
   > des exemples, et le port de PostgREST y est une supposition. **Garder les
   > `proxy_pass` existants**, n'ajouter que la ligne `include`.

4. `sudo nginx -t && sudo systemctl reload nginx`

> ⚠️ **Ne pas exempter la location PostgREST.** Les policies RLS sont toutes en
> `USING (true)` et la clé anon est lisible dans le bundle JS : c'est le seul
> endroit qui protège réellement les données. Exemptée, l'authentification ne
> protège que l'apparence de l'application.

### Étape 6 — Boucler côté application

`server/index.js` fait `app.listen(PORT)`, donc écoute sur `0.0.0.0`. Tant que
c'est le cas, n'importe qui sur le réseau interne peut joindre
`karinventaire01:3001` **en contournant Nginx** et envoyer l'en-tête
`Remote-User` de son choix. Doit devenir :

```js
app.listen(PORT, '127.0.0.1', () => { … });
```

---

## Si l'accès est coupé

Le scénario à connaître avant de commencer, pas pendant.

**Symptôme :** plus personne n'entre, y compris toi.

**Retour arrière immédiat** — commenter les lignes `include` ajoutées à
l'étape 5, puis :

```bash
sudo nginx -t && sudo systemctl reload nginx
```

L'application redevient accessible sans authentification en quelques secondes.
Authelia peut continuer de tourner, il n'est plus sur le chemin.

**Causes les plus fréquentes :**

| Symptôme | Cause probable |
|---|---|
| Boucle de redirection vers le portail | `session.cookies.domain` ne couvre pas le vhost |
| Connexion acceptée puis « accès refusé » | compte absent de `karinventaire-tech` |
| Erreur LDAP au démarrage | mot de passe du compte de service, ou `tls.skip_verify` |
| 502 sur le portail | conteneur arrêté — `docker compose ps` |

---

## Ensuite : la personnalisation

Une fois le portail en place, l'application récupère l'identité via un endpoint
`GET /api/me` renvoyant `Remote-User` / `Remote-Groups` en JSON — un SPA ne peut
pas lire les en-têtes de sa propre page. Un contexte React `useMe()` les expose,
ce qui débloque : filtre « mes RDV », technicien pré-sélectionné à la prise de
rendez-vous, « mes arrivées », mise en avant dans le podium des stats, et le
remplacement du mot de passe `admin2024` codé en dur dans
`src/components/dashboard/PinModal.tsx` par le groupe `karinventaire-admin`.
