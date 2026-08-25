const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const { syncKeycloakUser } = require("../services/userSync");

/* =============================================================================
   Dual-mode authentication.

   During migration GIVT must accept BOTH:
     • legacy tokens signed locally with JWT_SECRET (existing users stay
       logged in, nothing breaks mid-demo)
     • Keycloak tokens signed with Keycloak's private key, verified against
       its public JWKS endpoint

   The two are told apart by the token's `iss` (issuer) claim. Keycloak tokens
   carry the realm URL; local tokens have no issuer.

   Set AUTH_MODE in .env:
     local     — only legacy tokens (today's behaviour, the default)
     dual      — accept both. Use this for the whole transition.
     keycloak  — only Keycloak tokens. The end state.

   Drop-in replacement for middleware/auth.js: same exported names, same
   req.user shape, so no route handler needs editing.
   ========================================================================== */

const AUTH_MODE = process.env.AUTH_MODE || "local";
const KC_URL = (process.env.KEYCLOAK_URL || "http://localhost:8080").replace(/\/$/, "");
const KC_REALM = process.env.KEYCLOAK_REALM || "givt";
const KC_ISSUER = `${KC_URL}/realms/${KC_REALM}`;
const KC_AUDIENCE = process.env.KEYCLOAK_AUDIENCE || "givt-api";

const GIVT_ROLES = ["Student", "Professor", "Advisor", "Employer", "Admin"];

// Caches signing keys so we are not hitting Keycloak on every request.
const keys = jwksClient({
  jwksUri: `${KC_ISSUER}/protocol/openid-connect/certs`,
  cache: true,
  cacheMaxAge: 10 * 60 * 1000,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
  timeout: 8000,
});

function getSigningKey(header, callback) {
  keys.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

/** Keycloak puts realm roles in realm_access.roles. GIVT has a single role per
 *  user, so pick the first recognised one. Admin wins if several are present. */
function pickRole(claims) {
  const roles = claims?.realm_access?.roles || [];
  if (roles.includes("Admin")) return "Admin";
  return roles.find((r) => GIVT_ROLES.includes(r)) || null;
}

function verifyKeycloakToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getSigningKey,
      {
        algorithms: ["RS256"],
        issuer: KC_ISSUER,
        // Keycloak includes the audience only if the audience mapper is
        // configured (it is, in givt-realm.json). If you hit "jwt audience
        // invalid", that mapper is missing.
        audience: KC_AUDIENCE,
      },
      (err, decoded) => (err ? reject(err) : resolve(decoded))
    );
  });
}

/* ------------------------------------------------------------ main middleware */
async function authenticateToken(req, res, next) {
  const header = req.headers["authorization"];
  const token = header && header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: "Access token required" });

  // Peek at the payload without verifying, to decide which path to take.
  let unverified;
  try {
    unverified = jwt.decode(token, { complete: true });
    if (!unverified) throw new Error("undecodable");
  } catch {
    return res.status(403).json({ error: "Malformed token" });
  }

  const looksLikeKeycloak =
    typeof unverified.payload?.iss === "string" && unverified.payload.iss.includes("/realms/");

  /* ---------------------------------------------------------- Keycloak path */
  if (looksLikeKeycloak) {
    if (AUTH_MODE === "local")
      return res.status(403).json({ error: "Keycloak authentication is not enabled on this server" });

    try {
      const claims = await verifyKeycloakToken(token);
      const role = pickRole(claims);

      if (!role)
        return res.status(403).json({
          error:
            "Your account has no GIVT role assigned. Ask an administrator to assign one in Keycloak.",
        });

      // Map the Keycloak identity onto a local profile row. GIVT still owns
      // wallets, verifications and syllabi — those need a local user id.
      const localUser = await syncKeycloakUser({
        keycloakId: claims.sub,
        email: claims.email,
        name: claims.name || claims.preferred_username || claims.email,
        role,
        emailVerified: claims.email_verified === true,
      });

      if (!localUser.isActive)
        return res.status(403).json({
          error: localUser.deactivatedReason
            ? `This account has been deactivated. Reason: ${localUser.deactivatedReason}`
            : "This account has been deactivated. Please contact an administrator.",
          deactivated: true,
        });

      // Same shape the rest of the app already expects.
      req.user = {
        id: localUser.id,
        email: localUser.email,
        name: localUser.name,
        role: localUser.role,
        keycloakId: claims.sub,
        authSource: "keycloak",
      };
      return next();
    } catch (err) {
      const msg =
        err.name === "TokenExpiredError"
          ? "Session expired. Please sign in again."
          : "Invalid Keycloak token";
      if (process.env.NODE_ENV !== "production") console.error("keycloak verify:", err.message);
      return res.status(403).json({ error: msg, code: err.name });
    }
  }

  /* ------------------------------------------------------------- local path */
  if (AUTH_MODE === "keycloak")
    return res.status(403).json({
      error: "This server now requires Keycloak sign-in. Please log in again.",
      requiresKeycloak: true,
    });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token" });
    req.user = { ...decoded, authSource: "local" };
    next();
  });
}

/** Unchanged signature — every existing route keeps working. */
function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!allowed.includes(req.user.role))
      return res.status(403).json({
        error: `This action requires one of: ${allowed.join(", ")}`,
      });
    next();
  };
}

module.exports = { authenticateToken, requireRole, AUTH_MODE, KC_ISSUER };
