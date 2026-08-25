// Demo/seed data for GIVT — creates one verified account per role plus sample
// company, verification, and advising-pathway records so a fresh development
// database has something to click through immediately.
//
// Run: npm run db:seed   (from server/, or `npm run db:seed` at the repo root)
// Safe to re-run — uses upserts and never duplicates its fixtures.
// This seed is for development/demo databases only, never production.

const bcrypt = require("bcrypt");
const prisma = require("./client");

const DEMO_PASSWORD = "Passw0rd!"; // same password for every seeded account — for demo use only

const DEMO_USERS = [
  { name: "Sam Rivera",   email: "student@givt.demo",   role: "Student" },
  { name: "Dr. Ana Osei", email: "professor@givt.demo", role: "Professor" },
  { name: "Jordan Lee",   email: "advisor@givt.demo",   role: "Advisor" },
  { name: "Casey Kim",    email: "employer@givt.demo",  role: "Employer" },
  // Formerly the Peer account. Peer is now a Student capability, so this is
  // simply a second student who can peer-review the first.
  { name: "Riley Chen",   email: "peer@givt.demo",      role: "Student" },
  { name: "System Admin", email: "admin@givt.demo",     role: "Admin" },
];

async function upsertUser({ name, email, role }) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name, email, role, passwordHash, emailVerified: true, isActive: true },
  });

  const startBalance = role === "Admin" ? 0 : role === "Professor" ? 5500 : 500;
  await prisma.tokenWallet.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, balance: startBalance },
  });

  return user;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a production database. Use a development database instead.");
  }

  const users = {};
  for (const u of DEMO_USERS) {
    const user = await upsertUser(u);
    users[u.email] = user;
    // Keep the first user for each role so the named Student fixture remains
    // Sam Rivera rather than being replaced by the peer-capable student.
    if (!users[u.role]) users[u.role] = user;
    console.log(`  ✓ ${u.role.padEnd(10)} ${u.email}`);
  }

  const company = await prisma.company.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Emory Healthcare",
      sector: "Healthcare & HealthTech",
      profile: "Regional academic health system — test storyline employer for the GIVT MVP.",
      createdBy: users.Employer.id,
      locked: true,
      useCases: {
        create: [
          { useCaseId: "clinical-nlp", description: "Clinical note summarization and coding assistance using NLP." },
          { useCaseId: "predictive-readmission", description: "Predictive modeling for 30-day readmission risk." },
        ],
      },
    },
  });
  console.log(`  ✓ Company      ${company.name}`);

  await prisma.skillVerification.upsert({
    where: {
      studentId_verifierId_skillName: {
        studentId: users.Student.id,
        verifierId: users.Professor.id,
        skillName: "Clinical Data Modeling",
      },
    },
    update: {},
    create: {
      studentId: users.Student.id,
      verifierId: users.Professor.id,
      skillName: "Clinical Data Modeling",
      verifierRole: "Professor",
      confidence: 1,
      comment: "Demonstrated strong grasp of FHIR resource modeling in directed study.",
    },
  });
  console.log("  ✓ Skill verification  Clinical Data Modeling → Sam Rivera");

  const riseIntake = await prisma.advisingIntake.upsert({
    where: { id: "00000000-0000-0000-0000-000000000101" },
    update: {
      studentId: users.Student.id,
      pathway: "rise",
      details: {
        course: "HINF 3200 · Clinical Information Systems",
        standing: "D / 62%, with two assignments missing",
        challenges: "Struggling to connect FHIR resource modeling to the clinical workflow examples in class.",
        support: "Attended one office-hour session and joined a study group.",
        goal: "Pass the course and rebuild confidence before the next term.",
      },
      guidance: "1. Immediate next steps\nConfirm remaining deadlines with the instructor and ask whether the missing assignments can still be completed.\n\n2. This-week study plan\nBlock three focused sessions to map each FHIR resource to a real clinical workflow, then review the mappings with the study group.\n\n3. Conversations and support to request\nAsk the instructor for feedback on one completed example and request tutoring support for the next assignment.\n\n4. Confidence reset\nFocus on the next available action rather than the current grade; track each completed step with your advisor.",
    },
    create: {
      id: "00000000-0000-0000-0000-000000000101",
      studentId: users.Student.id,
      pathway: "rise",
      details: {
        course: "HINF 3200 · Clinical Information Systems",
        standing: "D / 62%, with two assignments missing",
        challenges: "Struggling to connect FHIR resource modeling to the clinical workflow examples in class.",
        support: "Attended one office-hour session and joined a study group.",
        goal: "Pass the course and rebuild confidence before the next term.",
      },
      guidance: "1. Immediate next steps\nConfirm remaining deadlines with the instructor and ask whether the missing assignments can still be completed.\n\n2. This-week study plan\nBlock three focused sessions to map each FHIR resource to a real clinical workflow, then review the mappings with the study group.\n\n3. Conversations and support to request\nAsk the instructor for feedback on one completed example and request tutoring support for the next assignment.\n\n4. Confidence reset\nFocus on the next available action rather than the current grade; track each completed step with your advisor.",
    },
  });
  console.log(`  ✓ Rise intake         ${riseIntake.pathway} → ${DEMO_USERS[0].name}`);

  const industryIntake = await prisma.advisingIntake.upsert({
    where: { id: "00000000-0000-0000-0000-000000000102" },
    update: {
      studentId: users.Student.id,
      pathway: "substitute",
      details: {
        targetCourse: "Introduction to Data Analytics",
        industry: "Built a clinic readmission dashboard during a summer internship using SQL, Python, and Tableau; presented findings to a quality-improvement team.",
        activities: "Led the campus health-data club and organized three peer workshops on data visualization.",
        evidence: "Dashboard portfolio, internship supervisor contact, project brief, and workshop materials.",
        skills: "SQL, data visualization, stakeholder communication, clinical workflow analysis, and project leadership.",
      },
      guidance: "1. Relevant evidence\nThe internship dashboard and supervisor contact provide direct evidence of applied analytics work in a healthcare setting.\n\n2. Possible learning-outcome connections\nThe experience may connect to data preparation, analysis, visualization, and communicating findings to stakeholders.\n\n3. Materials to prepare\nBring the portfolio, project brief, supervisor information, workshop materials, and a short explanation of the decisions behind the dashboard.\n\n4. Advisor discussion questions\nAsk which learning outcomes must be demonstrated, what formal review process applies, and whether additional assessment is required. Credit is not guaranteed.",
    },
    create: {
      id: "00000000-0000-0000-0000-000000000102",
      studentId: users.Student.id,
      pathway: "substitute",
      details: {
        targetCourse: "Introduction to Data Analytics",
        industry: "Built a clinic readmission dashboard during a summer internship using SQL, Python, and Tableau; presented findings to a quality-improvement team.",
        activities: "Led the campus health-data club and organized three peer workshops on data visualization.",
        evidence: "Dashboard portfolio, internship supervisor contact, project brief, and workshop materials.",
        skills: "SQL, data visualization, stakeholder communication, clinical workflow analysis, and project leadership.",
      },
      guidance: "1. Relevant evidence\nThe internship dashboard and supervisor contact provide direct evidence of applied analytics work in a healthcare setting.\n\n2. Possible learning-outcome connections\nThe experience may connect to data preparation, analysis, visualization, and communicating findings to stakeholders.\n\n3. Materials to prepare\nBring the portfolio, project brief, supervisor information, workshop materials, and a short explanation of the decisions behind the dashboard.\n\n4. Advisor discussion questions\nAsk which learning outcomes must be demonstrated, what formal review process applies, and whether additional assessment is required. Credit is not guaranteed.",
    },
  });
  console.log(`  ✓ Industry intake     ${industryIntake.pathway} → ${DEMO_USERS[0].name}`);

  console.log("\nSeed complete. Demo accounts use the development-only password defined in seed.js.\n");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
