import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { installTheme } from './lib/theme';
import './styles/global.css';
import './styles/auth.css';
import './styles/app.css';

installTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
