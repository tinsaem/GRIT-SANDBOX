// This project now uses Prisma for database migrations.
// Run one of these commands from the server/ directory:
//
//   npx prisma migrate dev --name init   ← development (creates migration history)
//   npx prisma db push                   ← quick sync without migration history
//   npx prisma migrate deploy            ← production
//   npx prisma studio                    ← visual DB browser
//
// Or use the npm scripts:
//   npm run migrate      ← prisma migrate dev
//   npm run db:push      ← prisma db push
//   npm run db:studio    ← prisma studio

console.log("Prisma migrations — run: npx prisma migrate dev --name init");
process.exit(0);
