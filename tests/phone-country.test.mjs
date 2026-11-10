import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/booking.js',import.meta.url),'utf8');
const {PHONE_COUNTRIES,nationalPhoneDigits,completeBookingPhone,createBookingMessage}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('phone choices expose Kyrgyzstan, Russia and Kazakhstan with national digit limits',()=>{
 for(const [id,code,length] of [['kg','996',9],['ru','7',10],['kz','7',10]]){
  const country=PHONE_COUNTRIES.find(item=>item.id===id);
  assert.ok(country,`${id} is selectable`);
  assert.equal(country.code.replace(/\D/g,''),code);
  assert.equal(country.length,length);
 }
});

test('Kyrgyz national, domestic and full pasted phone numbers produce the same digits',()=>{
 for(const value of ['707108410','0707 108 410','+996 707 108 410','996707108410','00996 (707) 108-410']){
  const national=nationalPhoneDigits(value,'kg');
  assert.equal(national,'707108410',value);
  assert.equal(completeBookingPhone(national,'kg'),'+996707108410',value);
 }
});

test('Russian and Kazakh phone numbers keep exactly one shared +7 prefix',()=>{
 for(const [country,national] of [['ru','9991234567'],['kz','7071084100']]){
  for(const value of [national,`8${national}`,`7${national}`,`+7 ${national}`,`007${national}`]){
   const digits=nationalPhoneDigits(value,country);
   assert.equal(digits,national,`${country}: ${value}`);
   assert.equal(completeBookingPhone(digits,country),`+7${national}`);
  }
 }
});

test('partial numbers beginning with a country-code-like sequence are not stripped',()=>{
 assert.equal(nationalPhoneDigits('996123','kg'),'996123');
 assert.equal(nationalPhoneDigits('996123456','kg'),'996123456');
 assert.equal(nationalPhoneDigits('707108','ru'),'707108');
 assert.equal(nationalPhoneDigits('7071084100','kz'),'7071084100');
});

test('national input accepts digits only and enforces each country length cap',()=>{
 assert.equal(nationalPhoneDigits('a707 b108 c410','kg'),'707108410');
 assert.equal(nationalPhoneDigits('70710841099','kg'),'707108410');
 assert.equal(nationalPhoneDigits('9991234567999','ru'),'9991234567');
 assert.equal(nationalPhoneDigits('7071084100999','kz'),'7071084100');
});

test('incomplete or excessive national numbers cannot create a completed phone',()=>{
 for(const [country,national] of [['kg','707108410'],['ru','9991234567'],['kz','7071084100']]){
  assert.equal(completeBookingPhone('',country),null);
  assert.equal(completeBookingPhone(national.slice(0,-1),country),null);
  assert.equal(completeBookingPhone(national+'1',country),null);
 }
});

test('Kyrgyzstan is the default country and the code survives an empty editable field',()=>{
 assert.equal(nationalPhoneDigits('+996 707 108 410'),'707108410');
 assert.equal(completeBookingPhone('707108410'),'+996707108410');
 assert.equal(nationalPhoneDigits(''),'');
 assert.equal(completeBookingPhone(''),null);
});

test('explicit incompatible and repeated country codes do not become valid local numbers',()=>{
 assert.equal(nationalPhoneDigits('+44 20 7946 0123','kg'),'');
 assert.equal(nationalPhoneDigits('+996 707 108 410','ru'),'');
 assert.equal(nationalPhoneDigits('+7 701 234 5678','kg'),'');
 assert.equal(nationalPhoneDigits('+996+996707108410','kg'),'');
 assert.equal(completeBookingPhone('012345678','kg'),null);
});

test('the review message uses the completed number without adding a second prefix',()=>{
 for(const [country,national,expected] of [['kg','707108410','+996707108410'],['ru','9991234567','+79991234567'],['kz','7071084100','+77071084100']]){
  const canonical=completeBookingPhone(national,country);
  const message=createBookingMessage({name:'Айбек',phone:canonical},'ru');
  assert.ok(message.includes(`Телефон: ${expected}`));
  assert.ok(!message.includes('+996996'));
 }
});
