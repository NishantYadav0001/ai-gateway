import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { Auth0Provider } from "@auth0/auth0-react";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Auth0Provider
  // Use the env variable if it exists, otherwise use the string directly
  domain={import.meta.env.VITE_AUTH0_DOMAIN || "dev-o6f4jp4nbv43fhz0.us.auth0.com"}
  clientId={import.meta.env.VITE_AUTH0_CLIENT_ID || "dUgewgoSwXtWLzX8wpaerOkI0Lik69li"}
  authorizationParams={{
    redirect_uri: window.location.origin,
    audience: "https://api.smartcache.gateway" // Keep this if you had it previously
  }}
>
  <App />
</Auth0Provider>
  </StrictMode>,
);
