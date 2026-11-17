import {
  apiErrorSchema,
  APPLICATION_FORM_FIELDS,
  contactMessageReceiptSchema,
  jobApplicationReceiptSchema,
  type ContactMessageReceipt,
  type CreateContactMessageInput,
  type JobApplicationInput,
  type JobApplicationReceipt,
} from "@kouland/contracts";

/** Thrown for every non-2xx response and for network failures (status 0). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Per-field validation messages, when the API rejected the input. */
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  /** API root including the `/api` prefix, e.g. `http://localhost:4100/api`. */
  baseUrl: string;
  fetch?: typeof fetch;
}

interface Parser<T> {
  parse(data: unknown): T;
}

/** A JSON body, or a multipart form (for file uploads; the browser sets its Content-Type). */
type RequestBody = { json: unknown } | { form: FormData };

export function createApiClient({ baseUrl, fetch: fetchImpl = fetch }: ApiClientOptions) {
  const root = baseUrl.replace(/\/+$/, "");

  async function request<T>(method: string, path: string, parser: Parser<T>, body?: RequestBody): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${root}${path}`, {
        method,
        headers: body && "json" in body ? { "Content-Type": "application/json" } : undefined,
        body: body === undefined ? undefined : "json" in body ? JSON.stringify(body.json) : body.form,
      });
    } catch {
      throw new ApiError(0, "Could not reach the server. Check your connection and try again.");
    }
    const data: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const error = apiErrorSchema.safeParse(data);
      throw error.success
        ? new ApiError(error.data.statusCode, error.data.message, error.data.fieldErrors)
        : new ApiError(response.status, "Something went wrong. Please try again.");
    }
    return parser.parse(data);
  }

  return {
    contact: {
      send: (input: CreateContactMessageInput): Promise<ContactMessageReceipt> =>
        request("POST", "/contact", contactMessageReceiptSchema, { json: input }),
    },
    careers: {
      /** Sends a job application with its CV. `locale` is the website language (en, fr or es). */
      apply: (input: JobApplicationInput, cv: Blob, cvName: string, locale: string): Promise<JobApplicationReceipt> => {
        const form = new FormData();
        form.append(APPLICATION_FORM_FIELDS.application, JSON.stringify(input));
        form.append(APPLICATION_FORM_FIELDS.locale, locale);
        form.append(APPLICATION_FORM_FIELDS.cv, cv, cvName);
        return request("POST", "/careers/applications", jobApplicationReceiptSchema, { form });
      },
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
