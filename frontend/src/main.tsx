import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import DispatchApp from './dispatch/DispatchApp.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DispatchApp />
  </StrictMode>,
);
