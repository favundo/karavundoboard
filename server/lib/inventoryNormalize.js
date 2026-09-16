/**
 * Normalisation des libellés rendus par ESET et OCS, et rapprochement avec les
 * lignes d'inventaire.
 *
 * Séparé de index.js parce que c'est la seule partie de la synchronisation qui
 * se teste sans réseau — et la plus facile à casser : trois outils nomment le
 * même Windows 11 de trois façons.
 */

/**
 * Libellé d'OS normalisé.
 *
 * ESET rend « Microsoft Windows 11 Pro », OCS « Microsoft Windows 11
 * Professionnel » ou « Windows 10 Entreprise » : trois orthographes pour deux
 * versions. Stocker le brut ferait exploser le camembert Versions Windows en
 * dizaines de parts d'un poste chacune, là où la question posée est « combien
 * de machines restent en 10 ».
 *
 * Un OS non reconnu est conservé tel quel plutôt qu'écarté : mieux vaut une
 * part exotique visible qu'une machine silencieusement rangée en « Inconnu ».
 */
function normalizeOs(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const server = /windows\s+server\s+(\d{4})(\s*r2)?/i.exec(s);
  if (server) return `Windows Server ${server[1]}${server[2] ? ' R2' : ''}`;
  const win = /windows\s+(11|10|8\.1|8|7|xp|vista)\b/i.exec(s);
  if (win) return `Windows ${win[1].toUpperCase() === 'XP' ? 'XP' : win[1]}`;
  if (/mac\s*os|macos|darwin/i.test(s)) return 'macOS';
  // Zorin et Rocky sont arrivés par le relevé du 16/09/2026 : un poste chacun,
  // que le libellé brut aurait affichés en parts séparées du camembert.
  if (/ubuntu|debian|centos|red\s*hat|fedora|rocky|alma|zorin|suse|mint|arch|linux/i.test(s)) return 'Linux';
  return s;
}

/**
 * Version d'OS d'un device ESET, liste ou détail.
 *
 * ESET ne rend QUE l'OS : activeProducts et deployedComponents sont vides sur
 * tout le parc, et son API REST n'expose aucune autre ressource (404 sur une
 * douzaine de candidates, sondé le 16/09/2026). La colonne « Application de
 * sécurité » de l'export de console vient de son moteur de rapports, qui n'a
 * pas d'équivalent REST — c'est pourquoi `eset_app` reste à la saisie manuelle.
 */
function esetDeviceOs(device) {
  return normalizeOs(
    device?.operatingSystem?.displayName ?? device?.operatingSystem?.name ?? device?.osName
  );
}

/**
 * Clés de rapprochement d'une ligne d'inventaire vers un nom de machine.
 *
 * Le DNS est la clé normale. Pour les lignes qui n'en ont pas, on reconstruit
 * les deux formes que suit le parc — port<asset> pour les portables,
 * uc<asset> pour les fixes : c'est la convention de nommage, et elle rattrape
 * les quelques dizaines de lignes où le DNS n'a jamais été saisi.
 */
function inventoryMatchKeys(row) {
  const keys = [];
  const dns = String(row.dns || '').trim().toLowerCase();
  if (dns) keys.push(dns.split('.')[0]);
  const asset = String(row.asset || '').trim().toLowerCase();
  if (asset && /^\d+$/.test(asset)) keys.push(`port${asset}`, `uc${asset}`);
  // Un poste dont le DNS EST déjà port<asset> produirait deux fois la même clé,
  // et donc deux recherches OCS identiques pour le même repli.
  return [...new Set(keys)];
}

module.exports = {
  normalizeOs,
  esetDeviceOs,
  inventoryMatchKeys,
};
