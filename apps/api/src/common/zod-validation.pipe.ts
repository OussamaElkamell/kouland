import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { ApiErrorBody } from "@kouland/contracts";
import type { ZodTypeAny, z } from "zod";

/**
 * Validates a request body, query or params against a schema from @kouland/contracts, so the API and the
 * website share one set of validation rules. Usage: `@Body(new ZodValidationPipe(schema)) body`.
 * Field errors are keyed by the field's path: `email`, or `customer.firstName` for nested fields.
 */
export class ZodValidationPipe<S extends ZodTypeAny> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const fieldErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join(".") || "_";
      (fieldErrors[field] ??= []).push(issue.message);
    }
    const body: ApiErrorBody = { statusCode: 400, message: "Please check the highlighted fields.", fieldErrors };
    throw new BadRequestException(body);
  }
}
