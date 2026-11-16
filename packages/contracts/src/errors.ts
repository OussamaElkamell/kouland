import { z } from "zod";

/** Shape of every error response the API returns. `fieldErrors` is set for validation failures (HTTP 400). */
export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  message: z.string(),
  fieldErrors: z.record(z.array(z.string())).optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
