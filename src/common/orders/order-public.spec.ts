import {
  customerWhatsappMessage,
  newReference,
  normalizePhone,
  parseReference,
  publicStatus,
  samePhone,
  whatsappLink,
} from './order-public';

describe('normalizePhone', () => {
  it.each([
    ['0555123456', '0555123456'],
    ['05 55 12 34 56', '0555123456'],
    ['+213555123456', '0555123456'],
    ['00213 555-12-34-56', '0555123456'],
    ['(0)31.92.12.34', '031921234'],
    ['+33 6 12 34 56 78', null],
    ['031921234', '031921234'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it('rejects text that is not an Algerian number', () => {
    expect(normalizePhone('hello')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });

  it('matches the same line however it is typed', () => {
    expect(samePhone('+213 555 12 34 56', '0555123456')).toBe(true);
    expect(samePhone('0555123456', '0555123457')).toBe(false);
    expect(samePhone('nonsense', 'nonsense')).toBe(false);
  });
});

describe('order reference', () => {
  it('is the prefix and six digits, never a leading zero', () => {
    for (let i = 0; i < 500; i++) {
      expect(newReference('BY')).toMatch(/^BY-[1-9]\d{5}$/);
    }
  });

  it('reads back what customers type', () => {
    expect(parseReference('BY-482193', 'BY')).toBe('BY-482193');
    expect(parseReference('by 482193', 'BY')).toBe('BY-482193');
    expect(parseReference(' 482193 ', 'BY')).toBe('BY-482193');
    expect(parseReference('XX-482193', 'BY')).toBeNull();
    expect(parseReference('BY-4821', 'BY')).toBeNull();
    expect(parseReference('', 'BY')).toBeNull();
  });
});

describe('publicStatus', () => {
  it('walks the four timeline steps', () => {
    expect(publicStatus('pending')).toMatchObject({ step: 0, label: 'في انتظار التأكيد', cancelled: false });
    expect(publicStatus('confirmed')).toMatchObject({ step: 1, cancelled: false });
    expect(publicStatus('shipped')).toMatchObject({ step: 2, label: 'تم الشحن' });
    expect(publicStatus('delivered')).toMatchObject({ step: 3, label: 'تم التسليم' });
  });

  it('marks cancelled orders and never throws on an unknown status', () => {
    expect(publicStatus('cancelled')).toMatchObject({ cancelled: true, label: 'أُلغي الطلب' });
    expect(publicStatus('weird').status).toBe('pending');
  });
});

describe('whatsapp', () => {
  it('builds a wa.me link with an encoded message and digits-only number', () => {
    expect(whatsappLink('+213 777 88', 'سلام')).toBe(`https://wa.me/21377788?text=${encodeURIComponent('سلام')}`);
  });

  it('puts the order number and the books in the message', () => {
    const msg = customerWhatsappMessage({
      reference: 'BY-482193',
      firstName: 'محمد',
      lastName: 'بن علي',
      items: [{ title: 'رياض الصالحين', quantity: 2 }],
    });
    expect(msg).toContain('BY-482193');
    expect(msg).toContain('رياض الصالحين × 2');
  });
});
