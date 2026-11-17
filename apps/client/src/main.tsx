import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useStore } from './store';
import { findSeat } from './storage';
// Self-hosted type. Each file carries unicode-range subsets; only latin + latin-ext (Turkish ğ ş ı İ) are
// ever fetched here, and those are precached by the service worker (vite.config.ts).
import '@fontsource/alegreya/700.css';
import '@fontsource/alegreya/800.css';
import '@fontsource/alegreya/900.css';
import '@fontsource/alegreya/700-italic.css';
import '@fontsource/alegreya/800-italic.css';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import '@fontsource/alegreya-sans/800.css';
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
