import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Loading from source keeps this pure-helper suite independent of CRA/Jest.
const source = await readFile(new URL('../src/booking.js', import.meta.url), 'utf8');
const { BOOKING_PHONE, normalizeBookingPhone, bishkekToday, isBookingDateValid, createBookingMessage, bookingWhatsAppUrl } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('Kyrgyz numbers normalize to the WhatsApp-ready international format', () => {
  for (const input of ['0707 108 410', '707108410', '+996 (707) 108-410', '996707108410', '00996707108410']) {
    assert.equal(normalizeBookingPhone(input), '+996707108410', input);
  }
});

test('international numbers require an explicit international prefix', () => {
  assert.equal(normalizeBookingPhone('+44 20 7946 0123'), '+442079460123');
  assert.equal(normalizeBookingPhone('0044 20 7946 0123'), '+442079460123');
  for (const input of ['', '1234567', '1234567890123', '70710841', '070710841', '+99670710841', '+9960707108410', '+996 070 108 410', '+0 12345678', '996+707108410', '++996707108410', 'abc707108410', '+1234567890123456']) {
    assert.equal(normalizeBookingPhone(input), null, input);
  }
});

test('booking dates follow Bishkek today and reject past or impossible dates', () => {
  assert.equal(bishkekToday(new Date('2026-11-09T20:00:00Z')), '2026-11-10');
  assert.equal(isBookingDateValid('', '2026-11-09'), true);
  assert.equal(isBookingDateValid('2026-11-09', '2026-11-09'), true);
  assert.equal(isBookingDateValid('2026-11-10', '2026-11-09'), true);
  assert.equal(isBookingDateValid('2026-11-08', '2026-11-09'), false);
  assert.equal(isBookingDateValid('2026-02-30', '2026-01-01'), false);
  assert.equal(isBookingDateValid('2026-13-01', '2026-01-01'), false);
  assert.equal(isBookingDateValid('09/11/2026', '2026-01-01'), false);
});

test('WhatsApp message preserves customer, vehicle, appointment and special characters', () => {
  const message = createBookingMessage({ name: '  Айбек  ', phone: '0707 108 410', productName: 'SANY STC350C5-1', date: '2026-11-10', time: 'afternoon', message: 'Нужна 6×4 & прицеп\nМожно осмотр?' }, 'ru');
  const url = new URL(bookingWhatsAppUrl(message));
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.pathname, `/${BOOKING_PHONE}`);
  assert.equal(url.searchParams.get('text'), message);
  assert.match(message, /Имя: Айбек/);
  assert.match(message, /Телефон: \+996707108410/);
  assert.match(message, /SANY STC350C5-1/);
  assert.match(message, /После обеда \(UTC\+6\)/);
  assert.match(message, /Нужна 6×4 & прицеп\nМожно осмотр\?/);
  assert.match(message, /подтвердите наличие техники/);
});

test('all languages produce readable messages and omit empty optional fields', () => {
  for (const lang of ['ru', 'ky', 'en']) {
    const message = createBookingMessage({ name: 'Aibek', phone: '+996707108410' }, lang);
    assert.doesNotMatch(message, /undefined|null|UTC\+6/);
    assert.match(message, /Aibek/);
    assert.match(message, /\+996707108410/);
  }
  assert.match(createBookingMessage({ name: 'Aibek', phone: '+996707108410' }, 'unknown'), /Здравствуйте/);
});
