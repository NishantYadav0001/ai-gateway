import React from 'react';
import ReactDOM from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Auth0Provider
      // Hardcoded public keys to bypass Hugging Face build-time traps
      domain="dev-o6f4jp4nbv43fhz0.us.auth0.com"
      clientId="PASTE_YOUR_ACTUAL_CLIENT_ID_HERE" 
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: "https://api.smartcache.gateway"
      }}
      useRefreshTokens={true}
      cacheLocation="localstorage"
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>
);