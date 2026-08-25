/* =============================================================================
   Migrate existing GIVT users into Keycloak.

     cd server
     node scripts/migrate-users-to-keycloak.js --dry-run     # inspect first
     node scripts/migrate-users-to-keycloak.js               # do it

   What it does, per user:
     • creates a Keycloak user with the same email and name
     • assigns the matching realm role
     • sets a TEMPORARY password, so the person is forced to choose a new one
       on first login
     • writes the Keycloak id back to users.keycloak_id

   What it does NOT do — and cannot:
     bcrypt hashes cannot be imported into Keycloak. There is no way to carry
     passwords across. Every user must reset. Plan the communication before
     running this in anything but development.

   Wallets, verifications, syllabi and messages are untouched — they key off
   users.id, which does not change.
   ========================================================================== */

require("dotenv").config();
const prisma = require("../prisma/client");
const crypto = require("crypto");

const KC_URL = (process.env.KEYCLOAK_URL || "http://localhost:8080").replace(/\/$/, "");
const KC_REALM = process.env.KEYCLOAK_REALM || "givt";
const KC_ADMIN_USER = process.env.KEYCLOAK_ADMIN_USER || "admin";
const KC_ADMIN_PASS = process.env.KEYCLOAK_ADMIN_PASSWORD || "admin";

const DRY_RUN = process.argv.includes("--dry-run");

function tempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  const bytes = crypto.randomBytes(16);
  return [...bytes].map((b) => chars[b % chars.length]).join("");
}

/** Admin REST API needs a token from the master realm. */
async function adminToken() {
  const res = await fetch(`${KC_URL}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "admin-cli",
      username: KC_ADMIN_USER,
      password: KC_ADMIN_PASS,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Could not authenticate against Keycloak admin API (${res.status}). ` +
        `Check KEYCLOAK_ADMIN_USER / KEYCLOAK_ADMIN_PASSWORD and that Keycloak is running at ${KC_URL}.`
    );
  }
  return (await res.json()).access_token;
}

async function kcFetch(token, path, options = {}) {
  const res = await fetch(`${KC_URL}/admin/realms/${KC_REALM}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  return res;
}

async function findRealmRole(token, name) {
  const res = await kcFetch(token, `/roles/${encodeURIComponent(name)}`);
  if (!res.ok) return null;
  return res.json();
}

async function main() {
  console.log(`\nKeycloak user migration${DRY_RUN ? "  [DRY RUN — nothing will be written]" : ""}`);
  console.log(`  Keycloak : ${KC_URL}`);
  console.log(`  Realm    : ${KC_REALM}\n`);

  const users = await prisma.user.findMany({
    where: { keycloakId: null },
    select: { id: true, email: true, name: true, role: true, emailVerified: true, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (!users.length) {
    console.log("Nothing to migrate — every user already has a keycloakId.\n");
    return;
  }

  console.log(`${users.length} user(s) to migrate:\n`);

  const token = DRY_RUN ? null : await adminToken();
  const roleCache = {};
  const credentials = [];
  let created = 0, skipped = 0, failed = 0;

  for (const u of users) {
    const label = `${u.name} <${u.email || "no-email"}> [${u.role}]`;

    if (!u.email) {
      console.log(`  SKIP  ${label} — no email address, cannot create a Keycloak user`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  WOULD CREATE  ${label}`);
      created++;
      continue;
    }

    try {
      const pw = tempPassword();
      const res = await kcFetch(token, "/users", {
        method: "POST",
        body: JSON.stringify({
          username: u.email,
          email: u.email,
          firstName: (u.name || "").split(" ")[0] || u.name,
          lastName: (u.name || "").split(" ").slice(1).join(" ") || "-",
          enabled: u.isActive,
          emailVerified: u.emailVerified,
          credentials: [{ type: "password", value: pw, temporary: true }],
        }),
      });

      if (res.status === 409) {
        // Already in Keycloak — just link it.
        const lookup = await kcFetch(token, `/users?email=${encodeURIComponent(u.email)}&exact=true`);
        const found = (await lookup.json())[0];
        if (found) {
          await prisma.user.update({ where: { id: u.id }, data: { keycloakId: found.id } });
          console.log(`  LINKED  ${label} — already existed in Keycloak`);
          created++;
        } else {
          console.log(`  FAIL  ${label} — 409 but user not found on lookup`);
          failed++;
        }
        continue;
      }

      if (!res.ok) {
        console.log(`  FAIL  ${label} — ${res.status} ${await res.text()}`);
        failed++;
        continue;
      }

      // Keycloak returns the new id in the Location header.
      const kcId = res.headers.get("location")?.split("/").pop();
      if (!kcId) {
        console.log(`  FAIL  ${label} — no id returned`);
        failed++;
        continue;
      }

      // Assign the realm role.
      if (!roleCache[u.role]) roleCache[u.role] = await findRealmRole(token, u.role);
      const role = roleCache[u.role];
      if (role) {
        await kcFetch(token, `/users/${kcId}/role-mappings/realm`, {
          method: "POST",
          body: JSON.stringify([{ id: role.id, name: role.name }]),
        });
      } else {
        console.log(`        (warning: realm role "${u.role}" not found — assign manually)`);
      }

      await prisma.user.update({ where: { id: u.id }, data: { keycloakId: kcId } });
      credentials.push({ email: u.email, name: u.name, role: u.role, temporaryPassword: pw });
      console.log(`  OK    ${label}`);
      created++;
    } catch (err) {
      console.log(`  FAIL  ${label} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n  created/linked: ${created}   skipped: ${skipped}   failed: ${failed}\n`);

  if (credentials.length) {
    const fs = require("fs");
    const file = `keycloak-temp-passwords-${Date.now()}.json`;
    fs.writeFileSync(file, JSON.stringify(credentials, null, 2));
    console.log(`  Temporary passwords written to server/${file}`);
    console.log(`  ⚠ This file contains credentials. Distribute securely, then DELETE it.`);
    console.log(`  ⚠ Make sure it is git-ignored before you commit anything.\n`);
  }
}

main()
  .catch((e) => {
    console.error("\nMigration aborted:", e.message, "\n");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
