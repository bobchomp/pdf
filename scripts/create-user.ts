try {
  process.loadEnvFile(".env");
} catch {
  // .env not present; assume env vars are set some other way
}

async function main() {
  const { createUser } = await import("../src/lib/users");
  const [, , email, password, name, role] = process.argv;

  if (!email || !password || !name) {
    console.error("Usage: npm run seed:user -- <email> <password> <name> [admin|member]");
    process.exit(1);
  }

  const user = await createUser({
    email,
    password,
    name,
    role: role === "admin" ? "admin" : "member",
  });

  console.log(`Created user ${user?.email} (${user?.role})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
