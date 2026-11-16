import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Used by the host's health check: confirms the API is up and can reach the database. */
  @Get()
  async check(): Promise<{ status: "ok" }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
}
