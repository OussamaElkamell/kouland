import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import {
  appointmentInputSchema,
  appointmentListQuerySchema,
  taskInputSchema,
  taskListQuerySchema,
  taskStatusInputSchema,
  type Appointment,
  type Page,
  type Task,
} from "@kouland/contracts";
import type { z } from "zod";
import { CurrentUser, type AuthUser } from "../auth/auth-user";
import { Crm, RequireAccess } from "../auth/crm.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AgendaService } from "./agenda.service";

@Controller("tasks")
@Crm()
export class TasksController {
  constructor(private readonly agenda: AgendaService) {}

  @Get()
  @RequireAccess("TASKS", "VIEW")
  list(@CurrentUser() user: AuthUser, @Query(new ZodValidationPipe(taskListQuerySchema)) query: z.output<typeof taskListQuerySchema>): Promise<Page<Task>> {
    return this.agenda.listTasks(user, query);
  }

  @Post()
  @RequireAccess("TASKS", "EDIT")
  create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(taskInputSchema)) body: z.output<typeof taskInputSchema>): Promise<Task> {
    return this.agenda.createTask(user, body);
  }

  @Put(":id")
  @RequireAccess("TASKS", "EDIT")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body(new ZodValidationPipe(taskInputSchema)) body: z.output<typeof taskInputSchema>): Promise<Task> {
    return this.agenda.updateTask(user, id, body);
  }

  /** Mark done or pending again. */
  @Patch(":id/status")
  @RequireAccess("TASKS", "EDIT")
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(taskStatusInputSchema)) body: z.output<typeof taskStatusInputSchema>,
  ): Promise<Task> {
    return this.agenda.setTaskStatus(user, id, body.status);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequireAccess("TASKS", "MANAGE")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.agenda.removeTask(user, id);
  }
}

@Controller("appointments")
@Crm()
export class AppointmentsController {
  constructor(private readonly agenda: AgendaService) {}

  @Get()
  @RequireAccess("TASKS", "VIEW")
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(appointmentListQuerySchema)) query: z.output<typeof appointmentListQuerySchema>,
  ): Promise<Page<Appointment>> {
    return this.agenda.listAppointments(user, query);
  }

  @Post()
  @RequireAccess("TASKS", "EDIT")
  create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(appointmentInputSchema)) body: z.output<typeof appointmentInputSchema>): Promise<Appointment> {
    return this.agenda.createAppointment(user, body);
  }

  @Put(":id")
  @RequireAccess("TASKS", "EDIT")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(appointmentInputSchema)) body: z.output<typeof appointmentInputSchema>,
  ): Promise<Appointment> {
    return this.agenda.updateAppointment(user, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequireAccess("TASKS", "MANAGE")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.agenda.removeAppointment(user, id);
  }
}
