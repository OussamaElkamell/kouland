import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { ApiErrorBody } from "@kouland/contracts";
import { platformScope, type AuthUser } from "../auth/auth-user";
import { notFound } from "../common/prisma-errors";
import { PrismaService } from "../prisma/prisma.service";

/** Customers the account may see: those linked to one of its platforms (all customers when it has every platform). */
export function customerScopeWhere(user: AuthUser): Prisma.CustomerWhereInput {
  const scope = platformScope(user);
  return scope ? { platforms: { some: { platformId: { in: scope } } } } : {};
}

/** Record-level checks shared by the customer and sales modules. */
@Injectable()
export class CustomerAccess {
  constructor(private readonly prisma: PrismaService) {}

  /** The customer, or 404 when it does not exist or is outside the account's platforms. */
  async visibleCustomer(user: AuthUser, id: string): Promise<{ id: string; displayName: string; stage: "PROSPECT" | "CUSTOMER" }> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, ...customerScopeWhere(user) },
      select: { id: true, displayName: true, stage: true },
    });
    if (!customer) throw notFound("Customer");
    return customer;
  }

  /**
   * Checks platform ids sent by a form: they must exist and be active, and a manager or employee can only use
   * their own platforms. Returns them without duplicates.
   */
  async checkPlatforms(user: AuthUser, ids: string[], field = "platformIds"): Promise<string[]> {
    const unique = [...new Set(ids)];
    const scope = platformScope(user);
    if (scope && unique.some((id) => !scope.includes(id))) throw new ForbiddenException("You do not have access to this platform.");
    if (unique.length === 0) return unique;
    const found = await this.prisma.platform.count({ where: { id: { in: unique }, isActive: true } });
    if (found !== unique.length) {
      const body: ApiErrorBody = { statusCode: 400, message: "One of the platforms does not exist or is inactive.", fieldErrors: { [field]: ["invalid"] } };
      throw new BadRequestException(body);
    }
    return unique;
  }
}
