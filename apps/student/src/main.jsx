import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { bindDeferredInstall } from './lib/deferredInstall';
import { installTheme } from './lib/theme';
import './styles/global.css';
import './styles/auth.css';
import './styles/app.css';

bindDeferredInstall();
installTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
