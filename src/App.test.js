import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

// Exercise the app's routing boundary independently of form internals or a backend.
jest.mock('./BookingPage', () => function BookingStub({initialProductId, onBack}) {
 return <main id="main"><h1>Booking test page</h1><output data-testid="selected-model">{initialProductId}</output><button onClick={onBack}>Return to catalogue</button></main>;
});

beforeEach(() => {
 localStorage.clear();
 window.history.replaceState({}, '', '/');
 window.scrollTo = jest.fn();
 HTMLElement.prototype.scrollIntoView = jest.fn();
 window.matchMedia = jest.fn(() => ({matches:false}));
 Object.defineProperty(window, 'crypto', {configurable:true,value:{randomUUID:()=> 'visitor-test-id'}});
 global.fetch = jest.fn().mockRejectedValue(new Error('No backend in routing test'));
});

test('a direct booking URL preserves the selected model and can return to the catalogue', async () => {
 window.history.replaceState({}, '', '/booking?product=sany-stc');
 render(<App/>);
 expect(screen.getByRole('heading', {name:'Booking test page'})).toBeInTheDocument();
 expect(screen.getByTestId('selected-model')).toHaveTextContent('sany-stc');
 fireEvent.click(screen.getByRole('button', {name:'Return to catalogue'}));
 expect(window.location.pathname).toBe('/');
 expect(window.location.hash).toBe('#catalog');
 expect(screen.queryByRole('heading', {name:'Booking test page'})).not.toBeInTheDocument();
 await waitFor(() => expect(screen.getByRole('textbox', {name:/поиск/i})).toBeInTheDocument());
});

test('a vehicle card opens its own booking even when the backend is unavailable', async () => {
 const {container}=render(<App/>);
 await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/каталог/i));
 const card=container.querySelector('.product-card');
 fireEvent.click(within(card).getByRole('button', {name:/бронир/i}));
 expect(window.location.pathname).toBe('/booking');
 expect(new URLSearchParams(window.location.search).get('product')).toBe('sitrak-lime');
 expect(screen.getByTestId('selected-model')).toHaveTextContent('sitrak-lime');
});

test('browser history events switch between catalogue and booking without a reload', async () => {
 render(<App/>);
 await act(async () => {
  window.history.replaceState({}, '', '/booking?product=howo-blue');
  window.dispatchEvent(new PopStateEvent('popstate'));
 });
 expect(screen.getByTestId('selected-model')).toHaveTextContent('howo-blue');
 await act(async () => {
  window.history.replaceState({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
 });
 expect(screen.queryByRole('heading', {name:'Booking test page'})).not.toBeInTheDocument();
 expect(screen.getByRole('textbox', {name:/поиск/i})).toBeInTheDocument();
});
