import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { initKeycloak, keycloakEnabled } from "./keycloak";

/* Keycloak must finish its silent SSO check BEFORE React renders, otherwise
   the first paint shows a logged-out UI and then flickers. When
   VITE_AUTH_MODE is unset or "local" this is a no-op. */
async function boot() {
  if (keycloakEnabled) {
    try { await initKeycloak(); }
    catch (e) { console.error("Keycloak init failed, falling back to local auth:", e); }
  }
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
boot();
