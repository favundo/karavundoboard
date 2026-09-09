import { describe, expect, it } from 'vitest';
import { normaliseTicketNumber } from '@/lib/rtTicket';

describe('normaliseTicketNumber', () => {
  it('accepte le numéro seul, avec ou sans croisillon', () => {
    expect(normaliseTicketNumber('376886')).toBe('376886');
    expect(normaliseTicketNumber(' #376886 ')).toBe('376886');
  });

  it("accepte l'URL RT collée depuis le navigateur", () => {
    expect(normaliseTicketNumber('http://rt.in.karavel.com/Ticket/Display.html?id=376886'))
      .toBe('376886');
  });

  it('refuse plutôt que de deviner', () => {
    expect(normaliseTicketNumber('')).toBe('');
    expect(normaliseTicketNumber('ticket 12 ou 34')).toBe('');
    expect(normaliseTicketNumber('abc')).toBe('');
  });
});
