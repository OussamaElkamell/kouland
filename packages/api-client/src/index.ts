import {
  apiErrorSchema,
  contactMessageReceiptSchema,
  type ContactMessageReceipt,
  type CreateContactMessageInput,
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

export function createApiClient({ baseUrl, fetch: fetchImpl = fetch }: ApiClientOptions) {
  const root = baseUrl.replace(/\/+$/, "");

  async function request<T>(method: string, path: string, parser: Parser<T>, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${root}${path}`, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
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
        request("POST", "/contact", contactMessageReceiptSchema, input),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
