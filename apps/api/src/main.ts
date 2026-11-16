import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";

/** Browsers may only call the API from these origins. Outside production, the local website is allowed by default. */
function corsOrigins(): string[] {
  const configured = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  if (configured.length > 0) return configured;
  return process.env.NODE_ENV === "production" ? [] : ["http://localhost:3100"];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");

  const origins = corsOrigins();
  if (origins.length === 0) {
    logger.warn("CORS: no allowed origin. Set CORS_ORIGINS or the website cannot call this API.");
  }
  app.enableCors({ origin: origins, credentials: true });
  configureApp(app);

  // Hosts (Railway, Render…) pass the port through PORT.
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4100);
  await app.listen(port, "::");
  logger.log(`Kouland API listening on :${port}/api`);
}

void bootstrap();
