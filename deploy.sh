#!/bin/bash
set -e

SERVER="ext-favundo@karinventaire01.in.karavel.com"
APP_DIR="/opt/karavundoboard"
PM2_APP="karavundobard-front"

echo "╔══════════════════════════════════════╗"
echo "║        Déploiement en production     ║"
echo "╚══════════════════════════════════════╝"

# Vérification : pas de changements non commités
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "⚠️  Des changements locaux ne sont pas commités."
  echo "   Commitez d'abord vos modifications avant de déployer."
  exit 1
fi

echo ""
echo "▶ Push vers GitHub..."
git push origin main
echo "  ✓ Push effectué"

echo ""
echo "▶ Déploiement sur le serveur..."
ssh "$SERVER" "
  set -e
  cd $APP_DIR
  echo '  → git pull...'
  git pull
  echo '  → npm ci...'
  npm ci
  echo '  → npm run build...'
  npm run build
  echo '  → redémarrage PM2...'
  pm2 restart $PM2_APP
"

echo ""
echo "✅ Déploiement terminé — https://karinventaire01.in.karavel.com"
