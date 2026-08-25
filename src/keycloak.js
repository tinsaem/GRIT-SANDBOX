import Keycloak from "keycloak-js";

/* =============================================================================
   Keycloak browser client.

   Enable by setting these in the project-root .env (Vite reads VITE_* only):

     VITE_AUTH_MODE=keycloak
     VITE_KEYCLOAK_URL=http://localhost:8080
     VITE_KEYCLOAK_REALM=givt
     VITE_KEYCLOAK_CLIENT_ID=givt-frontend

   With VITE_AUTH_MODE unset or "local", this module stays dormant and GIVT's
   existing email/password screens keep working unchanged.
   ========================================================================== */

export const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || "local";
export const keycloakEnabled = AUTH_MODE === "keycloak" || AUTH_MODE === "dual";

let keycloak = null;

export function getKeycloak() {
  if (!keycloakEnabled) return null;
  if (!keycloak) {
    keycloak = new Keycloak({
      url: import.meta.env.VITE_KEYCLOAK_URL || "http://localhost:8080",
      realm: import.meta.env.VITE_KEYCLOAK_REALM || "givt",
      clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || "givt-frontend",
    });
  }
  return keycloak;
}

/**
 * Call once at startup, before rendering.
 *
 * check-sso does a silent check: if the user already has a Keycloak session
 * they are signed in transparently; if not, nothing happens and they see the
 * landing page. Using "login-required" instead would force everyone straight
 * to the Keycloak login screen, hiding your homepage — usually not what you
 * want for a platform with public marketing pages.
 */
export async function initKeycloak() {
  const kc = getKeycloak();
  if (!kc) return { authenticated: false, enabled: false };

  try {
    const authenticated = await kc.init({
      onLoad: "check-sso",
      silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
      pkceMethod: "S256",
      checkLoginIframe: false, // avoids third-party-cookie problems in Chrome
    });

    if (authenticated) {
      // Tokens live ~5 minutes. Refresh whenever fewer than 70 seconds remain.
      setInterval(() => {
        kc.updateToken(70).catch(() => {
          console.warn("Keycloak token refresh failed — signing out");
          kc.logout({ redirectUri: window.location.origin });
        });
      }, 60000);
    }

    return { authenticated, enabled: true, keycloak: kc };
  } catch (err) {
    console.error("Keycloak init failed:", err);
    return { authenticated: false, enabled: true, error: err };
  }
}

/** GIVT's single role, extracted from Keycloak's realm roles. */
export function roleFromToken(kc) {
  const roles = kc?.tokenParsed?.realm_access?.roles || [];
  if (roles.includes("Admin")) return "Admin";
  return roles.find((r) => ["Student", "Professor", "Advisor", "Employer"].includes(r)) || null;
}

/** Shape matching what AuthContext already stores, so consumers don't change. */
export function userFromToken(kc) {
  const t = kc?.tokenParsed;
  if (!t) return null;
  return {
    id: t.sub,
    keycloakId: t.sub,
    email: t.email,
    name: t.name || t.preferred_username || t.email,
    role: roleFromToken(kc),
    emailVerified: t.email_verified === true,
  };
}

export function kcLogin(redirectPath = "/dashboard") {
  getKeycloak()?.login({ redirectUri: `${window.location.origin}${redirectPath}` });
}

export function kcRegister(redirectPath = "/dashboard") {
  getKeycloak()?.register({ redirectUri: `${window.location.origin}${redirectPath}` });
}

export function kcLogout() {
  getKeycloak()?.logout({ redirectUri: window.location.origin });
}

/** Keycloak's own change-password / MFA screen — replaces building your own. */
export function kcAccountConsole() {
  const kc = getKeycloak();
  if (kc) window.location.href = kc.createAccountUrl();
}
