import { describe, expect, it } from 'vitest';
import { ipToInt, prefixLength, buildSubnets, matchSubnet } from '../../server/lib/agencySubnet.js';

const rows = [
  { agence: 'Lyon Part-Dieu', sous_reseau: '10.12.145.0',     masque: '255.255.255.0' },
  { agence: 'Lyon Part-Dieu', sous_reseau: '10.12.145.0',     masque: '255.255.255.0' }, // doublon
  { agence: 'Nantes Centre',  sous_reseau: '10.12.146.0/24',  masque: '' },
  { agence: 'Lille',          sous_reseau: '10.13.20',        masque: null },
  { agence: 'Siège',          sous_reseau: '10.0.0.0',        masque: '255.0.0.0' },
];

describe('ipToInt', () => {
  it('accepte les écritures partielles du champ sous_reseau', () => {
    // La colonne n'est affichée nulle part : rien ne garantit sa forme.
    expect(ipToInt('10.12.145.0')).toBe(ipToInt('10.12.145'));
    expect(ipToInt('10.12.145.0/24')).toBe(ipToInt('10.12.145.0'));
    expect(ipToInt('10.12.145.x')).toBe(ipToInt('10.12.145.0'));
  });

  it('refuse ce qui n\'est pas une adresse', () => {
    expect(ipToInt('')).toBeNull();
    expect(ipToInt('agence de Lyon')).toBeNull();
    expect(ipToInt('300.1.1.1')).toBeNull();
  });
});

describe('prefixLength', () => {
  it('lit le masque, puis la notation CIDR, puis retombe sur /24', () => {
    expect(prefixLength('10.12.145.0', '255.255.255.0')).toBe(24);
    expect(prefixLength('10.12.145.0', '255.255.254.0')).toBe(23);
    expect(prefixLength('10.0.0.0', '255.0.0.0')).toBe(8);
    expect(prefixLength('10.12.145.0/27', '')).toBe(27);
    expect(prefixLength('10.12.145.0', null)).toBe(24);
  });

  it('ignore un masque fantaisiste plutôt que de calculer un réseau absurde', () => {
    // 255.0.255.0 n'est pas une suite de 1 puis de 0 : ce n'est pas un masque.
    expect(prefixLength('10.12.145.0', '255.0.255.0')).toBe(24);
  });
});

describe('buildSubnets + matchSubnet', () => {
  const nets = buildSubnets(rows);

  it('déduplique les postes qui partagent le sous-réseau de leur agence', () => {
    expect(nets).toHaveLength(4);
  });

  it('retrouve l\'agence depuis une IP relevée par OCS', () => {
    // L'IP réelle de la sonde du 16/09/2026.
    expect(matchSubnet('10.12.145.222', nets)?.agence).toBe('Lyon Part-Dieu');
    expect(matchSubnet('10.12.146.7', nets)?.agence).toBe('Nantes Centre');
    expect(matchSubnet('10.13.20.55', nets)?.agence).toBe('Lille');
  });

  it('préfère le réseau le plus spécifique', () => {
    // 10.12.145.222 tombe aussi dans le 10.0.0.0/8 du siège : sans le tri par
    // masque, on annoncerait la mauvaise implantation.
    expect(matchSubnet('10.12.145.222', nets)?.agence).toBe('Lyon Part-Dieu');
    // Une IP du /8 et d'aucun /24 revient bien au siège.
    expect(matchSubnet('10.99.99.1', nets)?.agence).toBe('Siège');
  });

  it('rend null plutôt que de deviner', () => {
    expect(matchSubnet('192.168.1.10', nets)).toBeNull();
    expect(matchSubnet(null, nets)).toBeNull();
    expect(matchSubnet('10.12.145.222', [])).toBeNull();
  });

  it('écarte les lignes inexploitables sans faire tomber le reste', () => {
    const noisy = buildSubnets([
      ...rows,
      { agence: 'Sans réseau', sous_reseau: '', masque: '' },
      { agence: '', sous_reseau: '10.14.0.0', masque: '' },
    ]);
    expect(noisy).toHaveLength(4);
  });
});
