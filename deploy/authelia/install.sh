#!/usr/bin/env bash
#
# Installe Authelia sur karinventaire01.
#
# À lancer DEPUIS LE SERVEUR, une fois les commits déployés :
#
#   cd /opt/karavundoboard/deploy/authelia && sudo ./install.sh
#
# Le script génère les secrets, demande le mot de passe du compte de service
# sans l'afficher, valide la configuration AVANT de démarrer quoi que ce soit,
# puis lance le conteneur. Il ne touche pas à Nginx : c'est l'étape suivante,
# volontairement séparée (voir README, étape 3).

set -euo pipefail

IMAGE=authelia/authelia:4.38
DEST=${AUTHELIA_DEST:-/opt/authelia}   # surchargeable pour un essai à blanc
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

red()  { printf '\033[31m%s\033[0m\n' "$*"; }
grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
info() { printf '\033[1m▶ %s\033[0m\n' "$*"; }

command -v docker  >/dev/null || { red "docker introuvable"; exit 1; }
# python3 sert au pré-vol du bind ET au remplissage de la configuration.
command -v python3 >/dev/null || { red "python3 introuvable — requis par ce script"; exit 1; }
command -v curl    >/dev/null || { red "curl introuvable — requis pour vérifier le démarrage"; exit 1; }
docker compose version >/dev/null 2>&1 || { red "le plugin 'docker compose' est requis"; exit 1; }

# ── Ne jamais écraser une installation déjà configurée ──────────────────────
if [[ -f "$DEST/configuration.yml" ]] && [[ "${1:-}" != "--force" ]]; then
  red "$DEST/configuration.yml existe déjà."
  echo "  Ce fichier contient des secrets : le script refuse de l'écraser."
  echo "  Pour repartir de zéro malgré tout : sudo ./install.sh --force"
  exit 1
fi

info "Récupération de l'image $IMAGE"
docker pull -q "$IMAGE"

# ── Secrets ─────────────────────────────────────────────────────────────────
info "Génération des secrets"
# `authelia crypto rand` préfixe sa sortie par « Random Value: ». Garder le
# préfixe injecterait un deux-points dans le YAML et casserait le fichier.
gen() {
  docker run --rm "$IMAGE" authelia crypto rand --length 64 --charset alphanumeric \
    | tail -1 | sed 's/^Random Value: *//' | tr -d '\r\n'
}
SESSION_SECRET=$(gen)
STORAGE_KEY=$(gen)
grn "  2 secrets générés"

# ── Mot de passe du compte de service ───────────────────────────────────────
# Saisi ici, jamais en argument : un argument resterait visible dans ps et dans
# l'historique du shell.
read -rsp "Mot de passe de cs-karinventaire@in.karavel.com : " AD_PASS; echo
[[ -n "$AD_PASS" ]] || { red "mot de passe vide"; exit 1; }

# ── Pré-vol : UNE seule tentative de bind ───────────────────────────────────
# Indispensable. Le conteneur a une politique de redémarrage, et Authelia sort
# en « fatal » si le bind LDAP échoue au démarrage : un mot de passe erroné se
# transforme en boucle de tentatives contre l'AD, ce qui VERROUILLE le compte de
# service en quelques secondes. On vérifie donc avec un essai unique, avant.
PREFLIGHT="$SRC/../../scripts/test-ad-bind.py"
if [[ -f "$PREFLIGHT" ]]; then
  info "Vérification du bind AD (une seule tentative)"
  if ! MDP="$AD_PASS" LOGINS='' GROUPES='' python3 "$PREFLIGHT"; then
    red "Bind refusé — rien n'a été installé, aucune autre tentative n'a été faite."
    echo "  Corriger le mot de passe avant de relancer."
    exit 1
  fi
  grn "  bind accepté"
else
  red "AVERTISSEMENT : $PREFLIGHT introuvable, le mot de passe n'a pas été vérifié."
  echo "  Un mot de passe erroné verrouillera le compte de service au démarrage."
  read -rp "  Continuer quand même ? [o/N] " go
  [[ "$go" == "o" ]] || exit 1
fi

# ── Assemblage ──────────────────────────────────────────────────────────────
info "Écriture de $DEST"
mkdir -p "$DEST"
cp "$SRC/docker-compose.yml" "$DEST/"

export SESSION_SECRET STORAGE_KEY AD_PASS
python3 - "$SRC/configuration.yml" "$DEST/configuration.yml" <<'PY'
import sys, os
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
for ph, env in [('À_REMPLIR_SECRET_SESSION', 'SESSION_SECRET'),
                ('À_REMPLIR_CLE_CHIFFREMENT_STOCKAGE', 'STORAGE_KEY'),
                ('À_REMPLIR_MDP_COMPTE_DE_SERVICE', 'AD_PASS')]:
    val = os.environ[env]
    if ph not in s:
        sys.exit(f"placeholder {ph} absent du modèle — modèle et script désynchronisés")
    s = s.replace(ph, val)
# Ne contrôler que les lignes actives : le commentaire d'en-tête mentionne
# « À_REMPLIR » sans être un placeholder.
restants = [l for l in s.splitlines()
            if 'À_REMPLIR' in l and not l.lstrip().startswith('#')]
if restants:
    sys.exit("des placeholders subsistent :\n  " + "\n  ".join(restants))
open(dst, 'w', encoding='utf-8').write(s)
PY
chmod 600 "$DEST/configuration.yml"
grn "  configuration.yml écrit (chmod 600)"

# ── Validation AVANT démarrage ──────────────────────────────────────────────
info "Validation de la configuration"
if ! docker run --rm -v "$DEST/configuration.yml:/config/configuration.yml:ro" \
       "$IMAGE" authelia validate-config --config /config/configuration.yml; then
  red "Configuration invalide — rien n'a été démarré."
  exit 1
fi

# ── Démarrage ───────────────────────────────────────────────────────────────
info "Démarrage du conteneur"
cd "$DEST"
docker compose up -d

info "Attente du démarrage"
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9091/authelia/ 2>/dev/null || echo 000)
  if [[ "$code" == "200" ]]; then
    grn "  portail joignable en local (HTTP $code)"
    break
  fi
  sleep 1
done

if [[ "${code:-000}" != "200" ]]; then
  red "Le portail ne répond pas sur 127.0.0.1:9091/authelia après 30 s."
  echo "  Journal :"
  docker compose logs --tail 30 authelia
  exit 1
fi

# Un échec de bind LDAP n'empêche pas Authelia de démarrer : il ne se voit qu'à
# la première connexion. On le remonte tout de suite.
if docker compose logs authelia 2>&1 | grep -qi "ldap"; then
  red "Le journal mentionne LDAP — le bind AD échoue probablement :"
  docker compose logs authelia 2>&1 | grep -i ldap | tail -5
  echo
  echo "  Vérifier le mot de passe du compte de service, puis :"
  echo "    cd $DEST && sudo docker compose down && sudo $SRC/install.sh --force"
fi

echo
grn "Authelia est démarré."
echo
echo "ÉTAPE SUIVANTE — publier le portail dans Nginx, et RIEN d'autre :"
echo "  1. ajouter le bloc « location /authelia » de nginx-karavundoboard.conf"
echo "  2. nginx -t && systemctl reload nginx"
echo "  3. ouvrir https://karinventaire01.in.karavel.com/authelia et se connecter"
echo
echo "L'application reste accessible normalement pendant cette validation."
echo "Ne protéger les autres locations qu'une fois la connexion réussie."
