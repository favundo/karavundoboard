import { describe, expect, it } from 'vitest';
import { parseMonitors, findDock } from '../../server/lib/ocsMonitors.js';

// Relevés réels du 27/10/2026 (scripts/probe-ocs-monitors.js, mrolland).
const DELL = { CAPTION: 'DELL E2724HS', DESCRIPTION: '', MANUFACTURER: 'Dell Computer Corp.', SERIAL: '88XKH14', TYPE: 'RGB color' };
const BOE = { CAPTION: '', DESCRIPTION: '', MANUFACTURER: 'BOE Display Technology', SERIAL: '', TYPE: 'non-RGB multicolor' };
const BOE_UNKNOWN = { CAPTION: '', MANUFACTURER: 'Unknown manufacturer code BOE', SERIAL: '0', TYPE: 'non-RGB multicolor' };

describe('parseMonitors', () => {
  it('garde un écran externe avec modèle et série', () => {
    expect(parseMonitors([DELL])).toEqual({
      external: [{ manufacturer: 'Dell Computer Corp.', model: 'DELL E2724HS', serial: '88XKH14' }],
      builtIn: false,
    });
  });

  it('écarte la dalle d’un portable et le signale', () => {
    expect(parseMonitors([BOE])).toEqual({ external: [], builtIn: true });
    expect(parseMonitors([BOE_UNKNOWN])).toEqual({ external: [], builtIn: true });
  });

  it('portable docké : dalle écartée, externe gardé', () => {
    const r = parseMonitors([BOE, DELL]);
    expect(r.builtIn).toBe(true);
    expect(r.external.map(m => m.model)).toEqual(['DELL E2724HS']);
  });

  it('remplace une série factice par null', () => {
    expect(parseMonitors([{ ...DELL, SERIAL: '01010101' }]).external[0].serial).toBeNull();
    expect(parseMonitors([{ ...DELL, SERIAL: '0' }]).external[0].serial).toBeNull();
  });

  it('dédoublonne un écran remonté deux fois', () => {
    expect(parseMonitors([DELL, DELL]).external).toHaveLength(1);
  });

  it('tolère une section absente', () => {
    expect(parseMonitors(undefined)).toEqual({ external: [], builtIn: false });
  });
});

describe('findDock', () => {
  it('repère un dock DisplayLink ou nommé dock', () => {
    expect(findDock([{ NAME: 'Souris USB' }, { NAME: 'DisplayLink USB Device' }])).toBe('DisplayLink USB Device');
    expect(findDock(undefined, [{ DESCRIPTION: 'Dell Dock WD19' }])).toBe('Dell Dock WD19');
  });

  it('rend null sans dock', () => {
    expect(findDock([{ NAME: 'Clavier' }], [])).toBeNull();
  });
});
