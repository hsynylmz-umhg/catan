import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useStore } from './store';
import { findSeat } from './storage';
import './styles.css';

// Opening an invite link for a room we already hold a seat in resumes it directly.
const params = new URLSearchParams(location.search);
const code = params.get('room')?.toUpperCase();
if (code && params.get('demo') !== '1') {
  const seat = findSeat(code);
  if (seat) useStore.getState().resumeRoom(seat.code, seat.token);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
