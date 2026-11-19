import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ApiErrorBody } from "@kouland/contracts";

/** True when a write failed on a unique index that covers `field`. */
export function isUniqueViolation(error: unknown, field?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  if (!field) return true;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes(field) : String(target ?? "").includes(field);
}

/** A 409 that points the form at the field that must be unique. */
export function taken(field: string, message: string): ConflictException {
  const body: ApiErrorBody = { statusCode: 409, message, fieldErrors: { [field]: ["taken"] } };
  return new ConflictException(body);
}

/** Records outside the account's platforms answer 404 too, so their existence is not revealed. */
export const notFound = (what: string) => new NotFoundException(`${what} not found.`);
