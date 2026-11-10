import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import BookingPage from './BookingPage';

beforeEach(()=>{window.scrollTo=jest.fn();});

test('a native date value is included in the reviewed WhatsApp message without a change event',()=>{
 const {container}=render(<BookingPage products={[{id:'test-truck',name:'SANY Test',image:'truck-08',brand:'SANY'}]} initialProductId="test-truck"/>);
 fireEvent.change(screen.getByRole('textbox',{name:'Ваше имя'}),{target:{value:'Тестовый клиент'}});
 fireEvent.change(screen.getByRole('textbox',{name:'Номер телефона'}),{target:{value:'0707 123 456'}});
 fireEvent.click(screen.getByRole('checkbox'));
 // Simulate a native picker/autofill that updated the field without notifying React.
 const date=container.querySelector('input[type="date"]');
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(date,'2099-12-01');
 fireEvent.click(screen.getByRole('button',{name:'Проверить заявку'}));
 expect(screen.getByRole('heading',{name:'Данные заявки'})).toBeInTheDocument();
 const url=new URL(screen.getByRole('link',{name:'Открыть WhatsApp'}).href);
 expect(url.pathname).toBe('/996707108410');
 expect(url.searchParams.get('text')).toContain('1 декабря 2099');
 expect(url.searchParams.get('text')).toContain('+996707123456');
 expect(screen.queryByText('Заявка принята')).not.toBeInTheDocument();
});

test('invalid contact details keep the visitor on the form and focus the first error',()=>{
 render(<BookingPage/>);
 fireEvent.click(screen.getByRole('button',{name:'Проверить заявку'}));
 expect(screen.getByRole('textbox',{name:'Ваше имя'})).toHaveFocus();
 expect(screen.getByRole('alert')).toHaveTextContent('Проверьте отмеченные поля.');
 expect(screen.queryByRole('link',{name:'Открыть WhatsApp'})).not.toBeInTheDocument();
});

test('native date input remains selected while other preferences change',()=>{
 const {container}=render(<BookingPage/>);
 const date=container.querySelector('input[type="date"]');
 fireEvent.input(date,{target:{value:'2099-12-01'}});
 fireEvent.change(container.querySelector('select[name="time"]'),{target:{value:'afternoon'}});
 expect(date).toHaveValue('2099-12-01');
});

test('Kyrgyzstan is selected initially and only national digits can be edited',()=>{
 const {container}=render(<BookingPage/>);
 const country=screen.getByRole('combobox',{name:'Страна номера телефона'});
 const phone=screen.getByRole('textbox',{name:'Номер телефона'});
 expect(country).toHaveValue('kg');
 expect(container.querySelector('.booking-phone-prefix')).toHaveTextContent('+996');
 expect(phone).toHaveAttribute('maxlength','9');
 fireEvent.change(phone,{target:{value:'707108410999'}});
 expect(phone).toHaveValue('707108410');
 fireEvent.change(phone,{target:{value:''}});
 expect(container.querySelector('.booking-phone-prefix')).toHaveTextContent('+996');
});

test.each([
 ['kg','+996 (707) 108-410','707108410','+996707108410','9'],
 ['ru','+7 (912) 345-67-89','9123456789','+79123456789','10'],
 ['kz','+7 (701) 234-56-78','7012345678','+77012345678','10']
])('a pasted %s number is kept complete and sent with a single country code',(country,pasted,national,canonical,maxLength)=>{
 render(<BookingPage/>);
 fireEvent.change(screen.getByRole('combobox',{name:'Страна номера телефона'}),{target:{value:country}});
 const phone=screen.getByRole('textbox',{name:'Номер телефона'});
 expect(phone).toHaveAttribute('maxlength',maxLength);
 fireEvent.paste(phone,{clipboardData:{getData:()=>pasted}});
 expect(phone).toHaveValue(national);
 fireEvent.change(screen.getByRole('textbox',{name:'Ваше имя'}),{target:{value:'Айбек'}});
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button',{name:'Проверить заявку'}));
 const url=new URL(screen.getByRole('link',{name:'Открыть WhatsApp'}).href);
 expect(url.searchParams.get('text')).toContain(`Телефон: ${canonical}`);
});

test('changing countries clears the previous number and applies the new digit limit',()=>{
 const {container}=render(<BookingPage/>);
 const phone=screen.getByRole('textbox',{name:'Номер телефона'});
 fireEvent.change(phone,{target:{value:'707108410'}});
 fireEvent.change(screen.getByRole('combobox',{name:'Страна номера телефона'}),{target:{value:'kz'}});
 expect(phone).toHaveValue('');
 expect(phone).toHaveAttribute('maxlength','10');
 expect(container.querySelector('.booking-phone-prefix')).toHaveTextContent('+7');
 fireEvent.change(phone,{target:{value:'701234'}});
 fireEvent.change(screen.getByRole('textbox',{name:'Ваше имя'}),{target:{value:'Айбек'}});
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button',{name:'Проверить заявку'}));
 expect(phone).toHaveAttribute('aria-invalid','true');
 expect(phone).toHaveFocus();
 expect(screen.queryByRole('link',{name:'Открыть WhatsApp'})).not.toBeInTheDocument();
});
