import { Body, Controller, Get, Injectable, Module, Param, Patch, Post, Query } from "@nestjs/common";
import { departmentInputSchema, type Department } from "@kouland/contracts";
import type { z } from "zod";
import { CurrentUser, type AuthUser } from "../auth/auth-user";
import { AdminOnly, Crm, RequireAccess } from "../auth/crm.guard";
import { isUniqueViolation, notFound, taken } from "../common/prisma-errors";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";

type DepartmentInput = z.output<typeof departmentInputSchema>;

/** Teams tickets are assigned to. Administrators manage the list; departments are deactivated, never deleted. */
@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(includeInactive: boolean): Promise<Department[]> {
    const rows = await this.prisma.department.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { tickets: { where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"] } } } } } },
    });
    return rows.map(({ _count, createdAt: _c, updatedAt: _u, ...row }) => ({ ...row, openTickets: _count.tickets }));
  }

  async save(id: string | null, input: DepartmentInput): Promise<Department> {
    if (id && !(await this.prisma.department.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Department");
    try {
      const row = id ? await this.prisma.department.update({ where: { id }, data: input }) : await this.prisma.department.create({ data: input });
      return (await this.list(true)).find((department) => department.id === row.id)!;
    } catch (error) {
      if (isUniqueViolation(error, "name")) throw taken("name", "A department with this name already exists.");
      throw error;
    }
  }
}

@Controller("departments")
@Crm()
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  /** Active departments; `?all=1` adds inactive ones for administrators. */
  @Get()
  @RequireAccess("TICKETS", "VIEW")
  list(@CurrentUser() user: AuthUser, @Query("all") all?: string): Promise<Department[]> {
    return this.departments.list(user.role === "ADMIN" && (all === "1" || all === "true"));
  }

  @Post()
  @AdminOnly()
  create(@Body(new ZodValidationPipe(departmentInputSchema)) body: DepartmentInput): Promise<Department> {
    return this.departments.save(null, body);
  }

  @Patch(":id")
  @AdminOnly()
  update(@Param("id") id: string, @Body(new ZodValidationPipe(departmentInputSchema)) body: DepartmentInput): Promise<Department> {
    return this.departments.save(id, body);
  }
}

@Module({ controllers: [DepartmentsController], providers: [DepartmentsService] })
export class DepartmentsModule {}
