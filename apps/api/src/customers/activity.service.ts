import { Injectable } from "@nestjs/common";
import type { ActivityType, Prisma } from "@prisma/client";
import type { Activity } from "@kouland/contracts";
import { PrismaService } from "../prisma/prisma.service";

type Client = Prisma.TransactionClient | PrismaService;

export const ACTIVITY_SELECT = {
  id: true,
  type: true,
  body: true,
  data: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
  opportunity: { select: { id: true, title: true } },
  ticket: { select: { id: true, number: true, subject: true } },
  call: { select: { id: true, direction: true, status: true, durationSec: true, notes: true } },
} satisfies Prisma.ActivitySelect;

export function toActivity(row: Prisma.ActivityGetPayload<{ select: typeof ACTIVITY_SELECT }>): Activity {
  return {
    ...row,
    data: row.data && typeof row.data === "object" && !Array.isArray(row.data) ? (row.data as Record<string, unknown>) : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Writes events into a customer's history. Pass the transaction client so the event commits with the change. */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  record(
    event: {
      customerId: string;
      type: ActivityType;
      /** Who did it; left out for events from the website. */
      userId?: string | null;
      opportunityId?: string;
      ticketId?: string;
      body?: string;
      data?: Prisma.InputJsonObject;
    },
    client: Client = this.prisma,
  ) {
    return client.activity.create({ data: event, select: { id: true } });
  }
}
