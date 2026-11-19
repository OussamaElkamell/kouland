/**
 * Creates a CRM administrator account (or resets an existing account's password and makes it an administrator).
 *
 *   pnpm --filter @kouland/api build
 *   pnpm --filter @kouland/api create-admin
 *
 * Asks for the email, name and password. To run it without questions (on a server), pass --email and --name and
 * put the password in the ADMIN_PASSWORD environment variable. Reads DATABASE_URL like the API.
 */
import { PrismaClient } from "@prisma/client";
import { createUserSchema, PASSWORD_MIN } from "@kouland/contracts";
import { createInterface } from "node:readline";
import { hashPassword } from "../auth/password";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // Print the question, then hide what is typed.
    const write = (rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput.bind(rl);
    let asked = false;
    (rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput = (text: string) => {
      if (!asked) {
        asked = true;
        write(text);
      }
    };
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    }),
  );
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile?.(".env");
  } catch {
    // No .env file: the environment already has DATABASE_URL (on a server).
  }
  const email = (argument("email") ?? (await ask("Email: "))).toLowerCase();
  const name = argument("name") ?? (await ask("Name: "));
  let password = process.env.ADMIN_PASSWORD ?? "";
  if (!password) {
    password = await ask(`Password (at least ${PASSWORD_MIN} characters): `, true);
    if ((await ask("Repeat the password: ", true)) !== password) throw new Error("The passwords do not match.");
  }

  const parsed = createUserSchema.safeParse({ email, name, password, role: "ADMIN", access: { CUSTOMERS: null, SALES: null } });
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
    throw new Error(`Invalid input (${problems}).`);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
    if (existing) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: existing.id },
          data: { name: parsed.data.name, passwordHash, role: "ADMIN", isActive: true, allPlatforms: true },
        }),
        prisma.session.deleteMany({ where: { userId: existing.id } }),
      ]);
      console.log(`Updated ${parsed.data.email}: administrator, new password set, signed out everywhere.`);
    } else {
      await prisma.user.create({
        data: { email: parsed.data.email, name: parsed.data.name, passwordHash, role: "ADMIN", allPlatforms: true },
      });
      console.log(`Created administrator ${parsed.data.email}. Sign in at /admin/login.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
