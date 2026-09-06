try {
  process.loadEnvFile(".env");
} catch {
  // .env not present; assume env vars are set some other way
}

// Deliberately doesn't import from "@/lib/users": that module (and others under
// src/lib) is guarded with `import "server-only"`, which throws when loaded outside
// Next's bundler — as happens here, since this script runs under plain tsx/Node.

async function main() {
  const [{ db, schema }, { eq }, bcrypt, { newId }] = await Promise.all([
    import("../src/db/client"),
    import("drizzle-orm"),
    import("bcryptjs"),
    import("../src/lib/ids"),
  ]);

  const [, , email, password, name, role] = process.argv;

  if (!email || !password || !name) {
    console.error("Usage: npm run seed:user -- <email> <password> <name> [admin|member]");
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase();
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, normalizedEmail)).limit(1);
  if (existing[0]) {
    console.error(`A user with email ${normalizedEmail} already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = newId("usr");

  await db.insert(schema.users).values({
    id,
    email: normalizedEmail,
    passwordHash,
    name,
    role: role === "admin" ? "admin" : "member",
    createdAt: new Date(),
  });

  console.log(`Created user ${normalizedEmail} (${role === "admin" ? "admin" : "member"})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
