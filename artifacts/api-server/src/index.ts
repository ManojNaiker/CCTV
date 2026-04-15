import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app";
import { logger } from "./lib/logger";
import { ensureDatabaseExists, runMigrations, db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { startScheduler } from "./lib/scheduler";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "./migrations");

async function seedDefaultAdmin() {
  try {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, "admin"));
    if (!existing) {
      await db.insert(usersTable).values({
        username: "admin",
        fullName: "Administrator",
        email: "admin@lightfinance.com",
        role: "admin",
        passwordHash: Buffer.from("admin@123").toString("base64"),
        isActive: true,
      });
      logger.info("Default admin user created (admin / admin@123)");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed default admin user");
  }
}

logger.info("Ensuring database exists...");
ensureDatabaseExists()
  .then(() => {
    logger.info("Running database migrations...");
    return runMigrations(migrationsFolder);
  })
  .then(async () => {
    logger.info("Database migrations complete");
    await seedDefaultAdmin();
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
      startScheduler();
    });
  })
  .catch((err) => {
    logger.error({ err }, "Database migration failed");
    process.exit(1);
  });
