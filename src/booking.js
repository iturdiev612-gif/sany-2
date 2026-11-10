export const BOOKING_PHONE = '996707108410';
export const BOOKING_PHONE_LABEL = '+996 707 108 410';

export const PHONE_COUNTRIES = [
  { id: 'kg', code: '+996', length: 9, example: '707 108 410' },
  { id: 'ru', code: '+7', length: 10, example: '912 345 67 89' },
  { id: 'kz', code: '+7', length: 10, example: '701 234 56 78' }
];

// Strip a complete dialing/trunk prefix; never strip a matching partial number.
export function nationalPhoneDigits(value, countryId = 'kg') {
  const country = PHONE_COUNTRIES.find(item => item.id === countryId);
  if (!country) return '';
  const input = String(value || '').trim();
  const prefix = country.code.slice(1);
  let digits = input.replace(/\D/g, '');
  if (input.includes('+') && (!input.startsWith('+') || (input.match(/\+/g) || []).length !== 1)) return '';
  if (input.startsWith('+') || digits.startsWith('00')) {
    const international = input.startsWith('+') ? digits : digits.slice(2);
    if (!international.startsWith(prefix)) return '';
    digits = international.slice(prefix.length);
  } else if (digits.length === country.length + prefix.length && digits.startsWith(prefix)) {
    digits = digits.slice(prefix.length);
  } else if (digits.length === country.length + 1 && digits.startsWith(countryId === 'kg' ? '0' : '8')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, country.length);
}

export function completeBookingPhone(value, countryId = 'kg') {
  const country = PHONE_COUNTRIES.find(item => item.id === countryId);
  const digits = String(value || '');
  if (!country || !new RegExp(`^[1-9][0-9]{${country.length - 1}}$`).test(digits)) return null;
  return country.code + digits;
}

// Accept local Kyrgyz numbers as well as explicitly international numbers.
export function normalizeBookingPhone(value) {
  const input = String(value || '').trim();
  if (!input || !/^[+\d\s().-]+$/.test(input) || (input.match(/\+/g) || []).length > 1 || (input.includes('+') && !input.startsWith('+'))) return null;
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('00') && !input.startsWith('+')) digits = digits.slice(2);
  else if (!input.startsWith('+')) {
    if (digits.length === 10 && digits.startsWith('0')) digits = `996${digits.slice(1)}`;
    else if (digits.length === 9 && !digits.startsWith('0')) digits = `996${digits}`;
    else if (!(digits.length === 12 && digits.startsWith('996'))) return null;
  }
  if (digits.length < 7 || digits.length > 15 || digits.startsWith('0')) return null;
  if (digits.startsWith('996') && (digits.length !== 12 || digits[3] === '0')) return null;
  return `+${digits}`;
}

export function bishkekToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Bishkek', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = key => parts.find(item => item.type === key).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function isBookingDateValid(value, today = bishkekToday()) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value && value >= today;
}

export function formatBookingDate(value, lang = 'ru') {
  if (!value) return '';
  const locale = lang === 'en' ? 'en' : 'ru';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bishkek' }).format(new Date(`${value}T12:00:00Z`));
}

const messageCopy = {
  ru: { title: 'Здравствуйте! Хочу забронировать технику / записаться на осмотр.', name: 'Имя', phone: 'Телефон', model: 'Модель', help: 'Нужна помощь с выбором', date: 'Желаемая дата', time: 'Время', morning: 'Утром', afternoon: 'После обеда', evening: 'Вечером', comment: 'Комментарий', confirm: 'Пожалуйста, подтвердите наличие техники и время встречи.' },
  ky: { title: 'Саламатсызбы! Техниканы брондоп / көрүүгө жазылгым келет.', name: 'Аты-жөнү', phone: 'Телефон', model: 'Модель', help: 'Тандоого жардам керек', date: 'Каалаган күн', time: 'Убакыт', morning: 'Эртең менен', afternoon: 'Түштөн кийин', evening: 'Кечинде', comment: 'Комментарий', confirm: 'Техниканын бар экенин жана жолугушуу убактысын ырастап бериңиз.' },
  en: { title: 'Hello! I would like to reserve a vehicle / arrange a viewing.', name: 'Name', phone: 'Phone', model: 'Vehicle', help: 'Please help me choose', date: 'Preferred date', time: 'Time', morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', comment: 'Comment', confirm: 'Please confirm vehicle availability and the appointment time.' }
};

export function createBookingMessage(values, lang = 'ru') {
  const text = messageCopy[lang] || messageCopy.ru;
  const lines = [text.title, '', `${text.name}: ${String(values.name || '').trim()}`, `${text.phone}: ${normalizeBookingPhone(values.phone) || String(values.phone || '').trim()}`, `${text.model}: ${values.productName || text.help}`];
  if (values.date) lines.push(`${text.date}: ${formatBookingDate(values.date, lang)}`);
  if (['morning', 'afternoon', 'evening'].includes(values.time)) lines.push(`${text.time}: ${text[values.time]} (UTC+6)`);
  if (String(values.message || '').trim()) lines.push(`${text.comment}: ${String(values.message).trim()}`);
  lines.push('', text.confirm);
  return lines.join('\n');
}

export function bookingWhatsAppUrl(message) {
  return `https://wa.me/${BOOKING_PHONE}?text=${encodeURIComponent(message)}`;
}
