import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
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

/**
 * How many reverse proxies sit in front of the API (the host's load balancer, Cloudflare…). The visitor's real
 * address is then read from X-Forwarded-For, which the per-visitor rate limits need; otherwise every visitor
 * would look like the proxy and share one limit. Defaults to 1 in production and 0 (none) in development.
 */
function trustedProxyHops(): number {
  const configured = Number(process.env.TRUST_PROXY);
  if (Number.isInteger(configured) && configured >= 0 && process.env.TRUST_PROXY !== "") return configured;
  return process.env.NODE_ENV === "production" ? 1 : 0;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger("Bootstrap");

  const hops = trustedProxyHops();
  if (hops > 0) app.set("trust proxy", hops);

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
