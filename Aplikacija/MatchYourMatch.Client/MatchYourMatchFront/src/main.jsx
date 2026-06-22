import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { I18nProvider } from './context/I18nContext.jsx';
import { installSessionExpiryInterceptor } from './services/sessionExpiry.js';

function hasMicrosoftAuthResponse() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const hasState = query.has('state') || hash.has('state');
  const hasResult = query.has('code') || hash.has('code') || query.has('error') || hash.has('error');
  return window.location.pathname === '/' && hasState && hasResult;
}

async function bootstrap() {
  const root = document.getElementById('root');
  if (hasMicrosoftAuthResponse()) {
    document.title = 'Microsoft Authentication';
    root.textContent = 'Completing Microsoft sign-in...';
    try {
      const { broadcastResponseToMainFrame } = await import('@azure/msal-browser/redirect-bridge');
      await broadcastResponseToMainFrame();
    } catch (error) {
      console.error('Microsoft authentication callback failed:', error);
      root.textContent = 'Microsoft sign-in could not be completed. Close this window and try again.';
    }
    return;
  }

  installSessionExpiryInterceptor();
  createRoot(root).render(
    <StrictMode>
      <ThemeProvider>
        <I18nProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </I18nProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

bootstrap();
