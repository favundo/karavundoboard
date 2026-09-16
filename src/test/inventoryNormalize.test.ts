import { describe, expect, it } from 'vitest';
import {
  normalizeOs, esetDeviceOs, inventoryMatchKeys,
} from '../../server/lib/inventoryNormalize.js';

describe('normalizeOs', () => {
  it('ramène les trois orthographes du parc au même libellé', () => {
    // ESET, OCS français, OCS anglais : même machine, trois chaînes.
    expect(normalizeOs('Microsoft Windows 11 Pro')).toBe('Windows 11');
    expect(normalizeOs('Microsoft Windows 11 Professionnel')).toBe('Windows 11');
    expect(normalizeOs('Windows 11 Enterprise (64-bit)')).toBe('Windows 11');
    expect(normalizeOs('Microsoft Windows 10 Entreprise')).toBe('Windows 10');
  });

  it('distingue les serveurs des postes', () => {
    expect(normalizeOs('Microsoft Windows Server 2019 Standard')).toBe('Windows Server 2019');
    expect(normalizeOs('Windows Server 2012 R2')).toBe('Windows Server 2012 R2');
  });

  it('regroupe le hors-Windows plutôt que de le détailler', () => {
    expect(normalizeOs('macOS 14.5 Sonoma')).toBe('macOS');
    expect(normalizeOs('Ubuntu 22.04.4 LTS')).toBe('Linux');
    // Vus sur le parc le 16/09/2026, un poste chacun : sans eux, deux parts
    // d'un équipement dans le camembert.
    expect(normalizeOs('Zorin')).toBe('Linux');
    expect(normalizeOs('Rocky')).toBe('Linux');
  });

  it('garde un OS inconnu tel quel, et ne rend rien pour du vide', () => {
    // Une part exotique visible vaut mieux qu'une machine rangée en « Inconnu ».
    expect(normalizeOs('FreeBSD 14')).toBe('FreeBSD 14');
    expect(normalizeOs('')).toBeNull();
    expect(normalizeOs(null)).toBeNull();
  });
});

describe('esetDeviceOs', () => {
  it("lit l'OS quelle que soit la clé de la réponse", () => {
    expect(esetDeviceOs({ operatingSystem: { displayName: 'Microsoft Windows 11 Professionnel' } }))
      .toBe('Windows 11');
    expect(esetDeviceOs({ osName: 'Microsoft Windows 10 Entreprise' })).toBe('Windows 10');
  });

  it('rend null sur un device sans OS plutôt qu\'une chaîne vide', () => {
    // 2 devices sur 904 dans ce cas : ils déclenchent un appel de détail, et
    // s'ils restent muets leur windows_version n'est pas touchée.
    expect(esetDeviceOs({ displayName: 'port13559' })).toBeNull();
  });
});

describe('inventoryMatchKeys', () => {
  it('réduit le DNS à son nom court', () => {
    expect(inventoryMatchKeys({ dns: 'Port13559.in.karavel.com', asset: '13559' }))
      .toEqual(['port13559', 'uc13559']);
  });

  it("reconstruit les deux formes du parc quand le DNS n'a jamais été saisi", () => {
    expect(inventoryMatchKeys({ dns: '', asset: '17510' }))
      .toEqual(['port17510', 'uc17510']);
  });

  it("ne devine rien d'un asset non numérique : pas de clé, donc pas de faux rapprochement", () => {
    expect(inventoryMatchKeys({ dns: '', asset: 'EMPTY-3f2a' })).toEqual([]);
  });
});
