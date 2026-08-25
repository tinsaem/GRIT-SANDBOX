const prisma = require("../prisma/client");

/* =============================================================================
   Keycloak identity  →  local GIVT profile row.

   Keycloak owns WHO someone is. GIVT still owns what they have done: token
   wallets, skill verifications, syllabi, messages, peer-review quota. All of
   those foreign-key to users.id, so every Keycloak user needs a matching local
   row — this module keeps the two in step.

   Matching order matters:
     1. keycloakId  — the durable link once established
     2. email       — used ONCE to adopt a pre-existing local account, so
                      migrated users keep their wallet and history
     3. create      — genuinely new user

   Step 2 is what makes migration non-destructive. Without it, a migrated user
   would get a fresh empty account and lose their tokens.
   ========================================================================== */

const WALLET_START = {
  Student: 500,
  Professor: 5000,
  Advisor: 5000,
  Employer: 5000,
  Admin: 0,
};

async function syncKeycloakUser({ keycloakId, email, name, role, emailVerified }) {
  const cleanEmail = email ? email.toLowerCase().trim() : null;

  // 1. Already linked.
  let user = await prisma.user.findUnique({ where: { keycloakId } });

  if (user) {
    // Keycloak is authoritative for name, email, role and verification status.
    // Only write when something actually changed, to avoid pointless updates
    // on every single request.
    const changed =
      (cleanEmail && user.email !== cleanEmail) ||
      (name && user.name !== name) ||
      (role && user.role !== role) ||
      user.emailVerified !== Boolean(emailVerified);

    if (changed) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(cleanEmail ? { email: cleanEmail } : {}),
          ...(name ? { name } : {}),
          ...(role ? { role } : {}),
          emailVerified: Boolean(emailVerified),
        },
      });
    }

    // lastLoginAt is best-effort — never block a request on it.
    prisma.user
      .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
      .catch(() => {});

    return user;
  }

  // 2. Adopt an existing local account with the same email. This is the
  //    migration path: the person keeps their id, wallet and verifications.
  if (cleanEmail) {
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          keycloakId,
          name: name || existing.name,
          role: role || existing.role,
          emailVerified: Boolean(emailVerified),
          lastLoginAt: new Date(),
          // The local password is now dead weight — Keycloak holds credentials.
          // Nulling it prevents any future local-login path from working.
          passwordHash: null,
          verificationToken: null,
          resetToken: null,
          resetTokenExpires: null,
        },
      });
    }
  }

  // 3. Brand-new user, registered directly in Keycloak.
  const created = await prisma.user.create({
    data: {
      keycloakId,
      email: cleanEmail,
      name: name || cleanEmail || "New user",
      role: role || "Student",
      emailVerified: Boolean(emailVerified),
      isActive: true,
      passwordHash: null,
      lastLoginAt: new Date(),
    },
  });

  // Mirror signup: give the new account its starting wallet.
  await prisma.tokenWallet
    .create({ data: { userId: created.id, balance: WALLET_START[created.role] ?? 0 } })
    .catch(() => {});

  return created;
}

module.exports = { syncKeycloakUser };
