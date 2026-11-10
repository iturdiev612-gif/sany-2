import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BOOKING_PHONE, BOOKING_PHONE_LABEL, PHONE_COUNTRIES, nationalPhoneDigits, completeBookingPhone, bishkekToday, bookingWhatsAppUrl, createBookingMessage, formatBookingDate, isBookingDateValid } from './booking';
import './BookingPage.css';

const content = {
  ru: {
    back: 'Вернуться в каталог', eyebrow: 'SANY / БРОНИРОВАНИЕ', title: 'Ближе к вашей', accent: 'новой технике.', intro: 'Выберите модель и оставьте контакты. Подготовим заявку, которую вы отправите менеджеру в WhatsApp.',
    stepDetails: 'Ваша заявка', stepSend: 'Отправка в WhatsApp', free: 'Без предоплаты', minute: 'Около минуты', personal: 'Напрямую менеджеру',
    vehicleTitle: 'Какая техника вас интересует?', vehicle: 'Модель техники', help: 'Помогите мне выбрать', contactTitle: 'Как с вами связаться?', requiredHint: 'Поля со звёздочкой обязательны.', name: 'Ваше имя', namePlaceholder: 'Как к вам обращаться', phone: 'Номер телефона', phoneCountry: 'Страна номера телефона', kg: 'Кыргызстан', ru: 'Россия', kz: 'Казахстан', phoneHint: '{count} цифр. Код {code} уже указан.',
    wishes: 'Добавить дату и пожелания', optional: 'Необязательно', date: 'Желаемая дата осмотра', time: 'Удобное время', anytime: 'Согласуем с менеджером', morning: 'Утром', afternoon: 'После обеда', evening: 'Вечером', timezone: 'Время Кыргызстана, UTC+6. Дату и время подтвердит менеджер.', message: 'Комментарий', messagePlaceholder: 'Например: нужна техника для стройки, хочу уточнить комплектацию…',
    consent: 'Согласен(на) на передачу указанных данных менеджеру через WhatsApp для обработки моей заявки.', privacy: 'Данные формы не сохраняются в этом браузере. Заявка отправляется только после вашего подтверждения в WhatsApp.', next: 'Проверить заявку', nextHint: 'На следующем шаге можно всё проверить.',
    nameError: 'Введите имя: от 2 до 100 символов.', phoneError: 'Введите полный номер для выбранной страны: 9 цифр для Кыргызстана или 10 для России и Казахстана.', dateError: 'Выберите сегодняшнюю или будущую дату.', consentError: 'Подтвердите согласие, чтобы перейти к отправке.', messageError: 'Оставьте не более 1000 символов.', errorSummary: 'Проверьте отмеченные поля.',
    chosen: 'ВАШ ВЫБОР', helpTitle: 'Найдём подходящую технику', helpText: 'Расскажите менеджеру о вашей задаче — он поможет с выбором модели.', price: 'Цена и наличие — у менеджера', picture: 'Иллюстрация модели', details: 'Что будет дальше', after1: 'Вы проверяете заявку.', after2: 'Отправляете сообщение в WhatsApp.', after3: 'Менеджер согласует наличие и встречу.', note: 'Бронирование подтверждается менеджером. Оплата на сайте не требуется.', direct: 'Хотите обсудить лично?', call: 'Позвонить',
    reviewEyebrow: 'ЕЩЁ ОДИН ШАГ', reviewTitle: 'Проверьте', reviewAccent: 'вашу заявку.', reviewIntro: 'Всё верно? Откройте WhatsApp — сообщение уже будет заполнено.', reviewHeading: 'Данные заявки', noDate: 'Согласуем с менеджером', readyTitle: 'Осталось нажать «Отправить»', readyText: 'Кнопка откроет чат с менеджером. В WhatsApp нажмите «Отправить», чтобы он получил вашу заявку.', open: 'Открыть WhatsApp', recipient: 'Получатель', edit: 'Изменить данные', fullMessage: 'Посмотреть текст сообщения', copy: 'Скопировать текст', copied: 'Текст скопирован', copyError: 'Выделите и скопируйте текст сообщения вручную.', noWhatsapp: 'Если WhatsApp недоступен, позвоните нам:', helpChanged: 'Модель недоступна в каталоге. Менеджер поможет подобрать вариант.'
  },
  ky: {
    back: 'Каталогго кайтуу', eyebrow: 'SANY / БРОНДОО', title: 'Жаңы техникаңызга', accent: 'бир кадам жакын.', intro: 'Моделди тандап, байланыш маалыматыңызды калтырыңыз. Менеджерге WhatsApp аркылуу жөнөтүү үчүн билдирүү даярдайбыз.',
    stepDetails: 'Сиздин өтүнмө', stepSend: 'WhatsApp аркылуу жөнөтүү', free: 'Алдын ала төлөмсүз', minute: 'Бир мүнөттөй', personal: 'Түз менеджерге',
    vehicleTitle: 'Кандай техника кызыктырат?', vehicle: 'Техниканын модели', help: 'Тандоого жардам бериңиз', contactTitle: 'Сиз менен кантип байланышсак болот?', requiredHint: 'Жылдызча коюлган талаалар милдеттүү.', name: 'Атыңыз', namePlaceholder: 'Сизге кантип кайрылсак болот', phone: 'Телефон номери', phoneCountry: 'Телефон номеринин өлкөсү', kg: 'Кыргызстан', ru: 'Россия', kz: 'Казакстан', phoneHint: '{count} сан. {code} коду мурунтан көрсөтүлгөн.',
    wishes: 'Күндү жана каалоолорду кошуу', optional: 'Милдеттүү эмес', date: 'Көрүүгө каалаган күн', time: 'Ыңгайлуу убакыт', anytime: 'Менеджер менен макулдашабыз', morning: 'Эртең менен', afternoon: 'Түштөн кийин', evening: 'Кечинде', timezone: 'Кыргызстан убактысы, UTC+6. Күндү жана убакытты менеджер ырастайт.', message: 'Комментарий', messagePlaceholder: 'Мисалы: курулушка техника керек, жабдуусун тактагым келет…',
    consent: 'Өтүнмөмдү иштеп чыгуу үчүн көрсөтүлгөн маалыматты менеджерге WhatsApp аркылуу берүүгө макулмун.', privacy: 'Формадагы маалымат бул браузерде сакталбайт. Өтүнмө WhatsApp ичинде ырастагандан кийин гана жөнөтүлөт.', next: 'Өтүнмөнү текшерүү', nextHint: 'Кийинки кадамда баарын текшере аласыз.',
    nameError: 'Атыңызды жазыңыз: 2ден 100гө чейин белги.', phoneError: 'Тандалган өлкөнүн толук номерин жазыңыз: Кыргызстан үчүн 9 сан, Россия жана Казакстан үчүн 10 сан.', dateError: 'Бүгүнкү же келечектеги күндү тандаңыз.', consentError: 'Жөнөтүүгө өтүү үчүн макулдугуңузду ырастаңыз.', messageError: '1000 белгиден ашырбаңыз.', errorSummary: 'Белгиленген талааларды текшериңиз.',
    chosen: 'СИЗДИН ТАНДООҢУЗ', helpTitle: 'Ылайыктуу техника табабыз', helpText: 'Менеджерге милдетиңизди айтып бериңиз — ал моделди тандоого жардам берет.', price: 'Баасын жана бар экенин менеджерден тактаңыз', picture: 'Моделдин сүрөтү', details: 'Андан кийин эмне болот', after1: 'Өтүнмөнү текшересиз.', after2: 'WhatsApp аркылуу билдирүү жөнөтөсүз.', after3: 'Менеджер техниканы жана жолугушууну тактайт.', note: 'Брондоону менеджер ырастайт. Сайтта төлөөнүн кереги жок.', direct: 'Жеке сүйлөшкүңүз келеби?', call: 'Чалуу',
    reviewEyebrow: 'ДАГЫ БИР КАДАМ', reviewTitle: 'Өтүнмөңүздү', reviewAccent: 'текшериңиз.', reviewIntro: 'Баары туурабы? WhatsApp ачыңыз — билдирүү даяр болот.', reviewHeading: 'Өтүнмөнүн маалыматы', noDate: 'Менеджер менен макулдашабыз', readyTitle: '«Жөнөтүү» баскычын басуу калды', readyText: 'Баскыч менеджер менен чатты ачат. Өтүнмөңүз жетиши үчүн WhatsApp ичинде «Жөнөтүү» баскычын басыңыз.', open: 'WhatsApp ачуу', recipient: 'Алуучу', edit: 'Маалыматты өзгөртүү', fullMessage: 'Билдирүүнүн текстин көрүү', copy: 'Текстти көчүрүү', copied: 'Текст көчүрүлдү', copyError: 'Билдирүүнү белгилеп, кол менен көчүрүңүз.', noWhatsapp: 'WhatsApp иштебесе, бизге чалыңыз:', helpChanged: 'Модель каталогдо жок. Менеджер башкасын тандоого жардам берет.'
  },
  en: {
    back: 'Back to the catalogue', eyebrow: 'SANY / BOOKING', title: 'One step closer', accent: 'to your next vehicle.', intro: 'Choose a vehicle and leave your contact details. We will prepare a message for you to send to our manager on WhatsApp.',
    stepDetails: 'Your request', stepSend: 'Send on WhatsApp', free: 'No upfront payment', minute: 'About a minute', personal: 'Direct to a manager',
    vehicleTitle: 'Which vehicle interests you?', vehicle: 'Vehicle model', help: 'Help me choose', contactTitle: 'How can we contact you?', requiredHint: 'Fields marked with an asterisk are required.', name: 'Your name', namePlaceholder: 'What should we call you?', phone: 'Phone number', phoneCountry: 'Phone number country', kg: 'Kyrgyzstan', ru: 'Russia', kz: 'Kazakhstan', phoneHint: '{count} digits. The {code} code is already included.',
    wishes: 'Add a date and preferences', optional: 'Optional', date: 'Preferred viewing date', time: 'Preferred time', anytime: 'Arrange with the manager', morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', timezone: 'Kyrgyzstan time, UTC+6. The manager will confirm your appointment.', message: 'Comment', messagePlaceholder: 'For example: I need a truck for construction and would like to discuss the configuration…',
    consent: 'I agree to share these details with the manager through WhatsApp to process my request.', privacy: 'Form details are not saved in this browser. Your request is sent only after you confirm it in WhatsApp.', next: 'Review my request', nextHint: 'You can check everything on the next step.',
    nameError: 'Enter your name using 2 to 100 characters.', phoneError: 'Enter the complete number: 9 digits for Kyrgyzstan or 10 for Russia and Kazakhstan.', dateError: 'Choose today or a future date.', consentError: 'Confirm your consent to continue.', messageError: 'Keep your comment within 1000 characters.', errorSummary: 'Please check the highlighted fields.',
    chosen: 'YOUR CHOICE', helpTitle: 'Let’s find the right vehicle', helpText: 'Tell the manager about your project and get help choosing a model.', price: 'Ask the manager about price and availability', picture: 'Model illustration', details: 'What happens next', after1: 'Review your request.', after2: 'Send your message in WhatsApp.', after3: 'The manager confirms availability and your visit.', note: 'Your booking is confirmed by the manager. No payment is taken on this site.', direct: 'Prefer to speak to us?', call: 'Call us',
    reviewEyebrow: 'ONE MORE STEP', reviewTitle: 'Review', reviewAccent: 'your request.', reviewIntro: 'Everything correct? Open WhatsApp — your message will be ready.', reviewHeading: 'Request details', noDate: 'Arrange with the manager', readyTitle: 'Just press “Send”', readyText: 'The button opens a chat with the manager. Press “Send” in WhatsApp so they receive your request.', open: 'Open WhatsApp', recipient: 'Recipient', edit: 'Edit details', fullMessage: 'View the full message', copy: 'Copy message', copied: 'Message copied', copyError: 'Select the message and copy it manually.', noWhatsapp: 'If WhatsApp is unavailable, call us:', helpChanged: 'This model is no longer in the catalogue. The manager can help you choose another.'
  }
};

function BookingIcon({ name, size = 20 }) {
  const paths = {
    arrow: 'M5 12h14m-5-5 5 5-5 5', back: 'M19 12H5m5-5-5 5 5 5', check: 'm5 12 4 4L19 6', clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2', shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm-4 9 3 3 5-6', phone: 'M21 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.1 5.2 2 2 0 0 1 5.1 3h3l2 5-2.5 2.5a16 16 0 0 0 5.9 5.9L16 14Z', whatsapp: 'M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5Zm-11-5-1 1c0 4 2.5 6.5 6.5 7l1-1.5-2-1-1 1c-1.5-.5-2.5-1.5-3-3l1-1-1.5-2.5Z', chevron: 'm6 9 6 6 6-6', copy: 'M8 8h13v13H8ZM16 8V3H3v13h5', truck: 'M3 6h12v12H3ZM15 10h4l3 4v4h-7M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z'
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.arrow} /></svg>;
}

export default function BookingPage({ products = [], lang = 'ru', onBack, initialProductId = '' }) {
  const text = content[lang] || content.ru;
  const [values, setValues] = useState({ productId: initialProductId, name: '', phone: '', phoneCountry: 'kg', date: '', time: '', message: '', consent: false });
  const [errors, setErrors] = useState({});
  const [stage, setStage] = useState('details');
  const [copyStatus, setCopyStatus] = useState('');
  const headingRef = useRef(null);
  const formRef = useRef(null);
  const options = useMemo(() => products.filter(product => product.visible !== false), [products]);
  const product = options.find(item => item.id === values.productId);
  const unknownProduct = Boolean(values.productId && !product);
  const phoneCountry = PHONE_COUNTRIES.find(country => country.id === values.phoneCountry) || PHONE_COUNTRIES[0];
  const fullPhone = completeBookingPhone(values.phone, values.phoneCountry);
  const message = stage === 'review' ? createBookingMessage({ ...values, phone: fullPhone, productName: product?.name }, lang) : '';
  const today = bishkekToday();

  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [stage]);
  useEffect(() => {
    setValues(current => ({ ...current, productId: initialProductId || '' }));
  }, [initialProductId]);

  function update(event) {
    const { name, value, checked, type } = event.target;
    if (name === 'phoneCountry') {
      setValues(current => ({ ...current, phoneCountry: value, phone: '' }));
      setErrors(current => ({ ...current, phone: undefined }));
      return;
    }
    const nextValue = name === 'phone' ? nationalPhoneDigits(value, values.phoneCountry) : type === 'checkbox' ? checked : value;
    setValues(current => ({ ...current, [name]: nextValue }));
    setErrors(current => ({ ...current, [name]: undefined }));
  }

  function pastePhone(event) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text');
    const input = event.currentTarget;
    const isFullNumber = /^\s*(?:\+|00)/.test(pasted) || pasted.replace(/\D/g, '').length >= phoneCountry.length;
    const raw = isFullNumber ? pasted : input.value.slice(0, input.selectionStart ?? input.value.length) + pasted + input.value.slice(input.selectionEnd ?? input.value.length);
    const digits = nationalPhoneDigits(raw, values.phoneCountry);
    setValues(current => ({ ...current, phone: digits }));
    setErrors(current => ({ ...current, phone: pasted.trim() && !digits ? 'phoneError' : undefined }));
  }

  function review(event) {
    event.preventDefault();
    // Read the submitted fields as well as React state so browser autofill and
    // native date pickers are included even when they do not emit a change event.
    const fields = new FormData(event.currentTarget);
    const submitted = Object.fromEntries(['productId', 'name', 'phone', 'phoneCountry', 'date', 'time', 'message'].map(key => [key, String(fields.get(key) || '')]));
    submitted.consent = fields.get('consent') === 'on';
    setValues(submitted);
    const nextErrors = {};
    if (submitted.name.trim().length < 2 || submitted.name.trim().length > 100) nextErrors.name = 'nameError';
    if (!completeBookingPhone(submitted.phone, submitted.phoneCountry)) nextErrors.phone = 'phoneError';
    if (!isBookingDateValid(submitted.date, today) || formRef.current?.elements.namedItem('date')?.validity.badInput) nextErrors.date = 'dateError';
    if (submitted.message.length > 1000) nextErrors.message = 'messageError';
    if (!submitted.consent) nextErrors.consent = 'consentError';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const first = formRef.current?.elements.namedItem(Object.keys(nextErrors)[0]);
      first?.closest('details')?.setAttribute('open', '');
      first?.focus();
      return;
    }
    setStage('review');
    setCopyStatus('');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopyStatus('copied');
    } catch { setCopyStatus('copyError'); }
  }

  function fieldError(name) {
    return errors[name] ? <span className="booking-field-error" id={`booking-${name}-error`}>{text[errors[name]]}</span> : null;
  }

  const describe = (name, hint) => [hint, errors[name] && `booking-${name}-error`].filter(Boolean).join(' ') || undefined;
  return <main className="booking-page" id="main">
    <div className="booking-container container">
      <div className="booking-topline">
        <a href="/#catalog" className="booking-back" onClick={event => { if (onBack) { event.preventDefault(); onBack(); } }}><BookingIcon name="back" size={17} />{text.back}</a>
        <ol className="booking-progress" aria-label={text.eyebrow}>
          <li className={stage === 'details' ? 'current' : 'complete'} aria-current={stage === 'details' ? 'step' : undefined}><span>{stage === 'review' ? <BookingIcon name="check" size={13} /> : '01'}</span>{text.stepDetails}</li>
          <li className={stage === 'review' ? 'current' : ''} aria-current={stage === 'review' ? 'step' : undefined}><span>02</span>{text.stepSend}</li>
        </ol>
      </div>

      <header className="booking-intro">
        <p className="eyebrow"><span className="yellow-line" />{stage === 'details' ? text.eyebrow : text.reviewEyebrow}</p>
        <h1 ref={headingRef} tabIndex={-1}>{stage === 'details' ? text.title : text.reviewTitle}<br /><span>{stage === 'details' ? text.accent : text.reviewAccent}</span></h1>
        <p>{stage === 'details' ? text.intro : text.reviewIntro}</p>
        <ul className="booking-benefits"><li><BookingIcon name="shield" size={16} />{text.free}</li><li><BookingIcon name="clock" size={16} />{text.minute}</li><li><BookingIcon name="whatsapp" size={16} />{text.personal}</li></ul>
      </header>

      <div className="booking-layout">
        <div className="booking-main-column">
          {stage === 'details' ? <form ref={formRef} className="booking-form" onSubmit={review} noValidate>
            <fieldset className="booking-section">
              <legend><span>01</span>{text.vehicleTitle}</legend>
              <label htmlFor="booking-product">{text.vehicle}</label>
              <select id="booking-product" name="productId" value={product?.id || ''} onChange={update}>
                <option value="">{text.help}</option>
                {options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {unknownProduct && <p className="booking-hint" role="status">{text.helpChanged}</p>}
            </fieldset>

            <fieldset className="booking-section">
              <legend><span>02</span>{text.contactTitle}</legend>
              <p className="booking-required-hint">{text.requiredHint}</p>
              <div className="booking-fields-row">
                <div className="booking-field"><label htmlFor="booking-name">{text.name} <span aria-hidden="true">*</span></label><input id="booking-name" name="name" autoComplete="name" required minLength={2} maxLength={100} value={values.name} onChange={update} placeholder={text.namePlaceholder} aria-invalid={Boolean(errors.name)} aria-describedby={describe('name')} />{fieldError('name')}</div>
                <div className="booking-field">
                  <label htmlFor="booking-phone">{text.phone} <span aria-hidden="true">*</span></label>
                  <select className="booking-phone-country" name="phoneCountry" aria-label={text.phoneCountry} value={values.phoneCountry} onChange={update} autoComplete="off">
                    {PHONE_COUNTRIES.map(country => <option key={country.id} value={country.id}>{text[country.id]}</option>)}
                  </select>
                  <div className="booking-phone-number" data-invalid={Boolean(errors.phone)}>
                    <span className="booking-phone-prefix" aria-hidden="true">{phoneCountry.code}</span>
                    <input id="booking-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" required maxLength={phoneCountry.length} pattern={`[1-9][0-9]{${phoneCountry.length - 1}}`} value={values.phone} onChange={update} onPaste={pastePhone} placeholder={phoneCountry.example.replace(/\s/g, '')} aria-invalid={Boolean(errors.phone)} aria-describedby={describe('phone', 'booking-phone-hint')} />
                  </div>
                  {fieldError('phone')}
                  <span className="booking-hint" id="booking-phone-hint">{text.phoneHint.replace('{count}', phoneCountry.length).replace('{code}', phoneCountry.code)}</span>
                </div>
              </div>
            </fieldset>

            <details className="booking-wishes">
              <summary><span>{text.wishes}<small>{text.optional}</small></span><BookingIcon name="chevron" size={20} /></summary>
              <div className="booking-wishes-content">
                <div className="booking-fields-row">
                  <div className="booking-field"><label htmlFor="booking-date">{text.date}</label><input id="booking-date" type="date" name="date" min={today} value={values.date} onInput={update} onChange={update} aria-invalid={Boolean(errors.date)} aria-describedby={describe('date', 'booking-timezone')} />{fieldError('date')}</div>
                  <div className="booking-field"><label htmlFor="booking-time">{text.time}</label><select id="booking-time" name="time" value={values.time} onChange={update} aria-describedby="booking-timezone"><option value="">{text.anytime}</option>{['morning', 'afternoon', 'evening'].map(time => <option key={time} value={time}>{text[time]}</option>)}</select></div>
                </div>
                <p className="booking-hint" id="booking-timezone">{text.timezone}</p>
                <div className="booking-field"><label htmlFor="booking-message">{text.message}</label><textarea id="booking-message" name="message" rows={3} maxLength={1000} value={values.message} onChange={update} placeholder={text.messagePlaceholder} aria-invalid={Boolean(errors.message)} aria-describedby={describe('message')} />{fieldError('message')}</div>
              </div>
            </details>

            <div className="booking-submit-section">
              <label className="booking-consent" htmlFor="booking-consent"><input type="checkbox" id="booking-consent" name="consent" checked={values.consent} onChange={update} required aria-invalid={Boolean(errors.consent)} aria-describedby={describe('consent')} /><span>{text.consent}</span></label>
              {fieldError('consent')}
              {Object.values(errors).some(Boolean) && <p className="booking-error-summary" role="alert">{text.errorSummary}</p>}
              <button type="submit" className="button primary booking-next">{text.next}<BookingIcon name="arrow" size={20} /></button>
              <p className="booking-next-hint">{text.nextHint}</p>
              <p className="booking-privacy"><BookingIcon name="shield" size={16} /><span>{text.privacy}</span></p>
            </div>
          </form> : <section className="booking-review" aria-label={text.reviewHeading}>
            <div className="booking-review-heading"><h2>{text.reviewHeading}</h2><button type="button" className="booking-edit" onClick={() => { setStage('details'); setCopyStatus(''); }}>{text.edit}</button></div>
            <dl className="booking-review-list">
              <div><dt>{text.vehicle}</dt><dd>{product?.name || text.help}</dd></div>
              <div><dt>{text.name}</dt><dd>{values.name.trim()}</dd></div>
              <div><dt>{text.phone}</dt><dd>{fullPhone}</dd></div>
              <div><dt>{text.date}</dt><dd>{values.date ? formatBookingDate(values.date, lang) : text.noDate}</dd></div>
              {values.time && <div><dt>{text.time}</dt><dd>{text[values.time]} · UTC+6</dd></div>}
              {values.message.trim() && <div><dt>{text.message}</dt><dd className="booking-review-comment">{values.message.trim()}</dd></div>}
            </dl>
            <div className="booking-whatsapp-notice"><span className="booking-whatsapp-mark"><BookingIcon name="whatsapp" size={24} /></span><div><h3>{text.readyTitle}</h3><p>{text.readyText}</p></div></div>
            <a href={bookingWhatsAppUrl(message)} className="button primary booking-next"><BookingIcon name="whatsapp" size={22} />{text.open}<BookingIcon name="arrow" size={20} /></a>
            <p className="booking-recipient">{text.recipient}: <strong>{BOOKING_PHONE_LABEL}</strong></p>
            <details className="booking-message-preview"><summary>{text.fullMessage}<BookingIcon name="chevron" size={17} /></summary><pre>{message}</pre><button type="button" className="booking-copy" onClick={copyMessage}><BookingIcon name="copy" size={16} />{text.copy}</button>{copyStatus && <p role="status">{text[copyStatus]}</p>}</details>
            <p className="booking-call-fallback">{text.noWhatsapp} <a href={`tel:+${BOOKING_PHONE}`}>{BOOKING_PHONE_LABEL}</a></p>
          </section>}
        </div>

        <aside className="booking-sidebar" aria-label={text.chosen}>
          <div className="booking-vehicle-card">
            <p className="booking-card-eyebrow">{text.chosen}<span>SANY / COLLECTION</span></p>
            <div className="booking-vehicle-image">{product ? <img src={`/assets/${product.image}.webp`} alt={product.name} width="1536" height="1024" /> : <div className="booking-choose-art"><BookingIcon name="truck" size={70} /><span>SANY</span></div>}<span>{product ? text.picture : 'TRUCKS & MACHINERY'}</span></div>
            <div className="booking-vehicle-info"><span>{product?.brand || 'SANY / SITRAK / HOWO'}</span><h2>{product?.name || text.helpTitle}</h2>{product ? <p>{[product.axles, product.color?.[lang]].filter(Boolean).join(' · ')}</p> : <p>{text.helpText}</p>}<div className="booking-price-note"><span className="booking-status-dot" />{text.price}</div></div>
          </div>
          <div className="booking-expectations"><h3>{text.details}</h3><ol>{[text.after1, text.after2, text.after3].map((item, index) => <li key={item}><span>0{index + 1}</span>{item}</li>)}</ol><p><BookingIcon name="shield" size={17} /><span>{text.note}</span></p></div>
          <div className="booking-contact-card"><div><p>{text.direct}</p><a href={`tel:+${BOOKING_PHONE}`}>{BOOKING_PHONE_LABEL}</a></div><a className="booking-call-button" href={`tel:+${BOOKING_PHONE}`} aria-label={`${text.call}: ${BOOKING_PHONE_LABEL}`}><BookingIcon name="phone" size={20} /></a></div>
        </aside>
      </div>
    </div>
  </main>;
}
