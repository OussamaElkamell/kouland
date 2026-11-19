import {
  activitySchema,
  apiErrorSchema,
  APPLICATION_FORM_FIELDS,
  assignableUsersSchema,
  contactMessageReceiptSchema,
  contactSchema,
  customerDetailSchema,
  customerSummarySchema,
  invitedUserSchema,
  jobApplicationReceiptSchema,
  linkInfoSchema,
  linkReceiptSchema,
  opportunityDetailSchema,
  opportunitySummarySchema,
  pageOf,
  platformSchema,
  proposalSchema,
  sessionUserSchema,
  userSchema,
  type ChangePasswordInput,
  type ContactInput,
  type ContactMessageReceipt,
  type CreateContactMessageInput,
  type CreateOpportunityInput,
  type CreatePlatformInput,
  type CreateUserInput,
  type CustomerInput,
  type CustomerListQuery,
  type CustomerStage,
  type JobApplicationInput,
  type JobApplicationReceipt,
  type LoginInput,
  type NoteInput,
  type OpportunityListQuery,
  type OpportunityStatusInput,
  type ProposalInput,
  type UpdateOpportunityInput,
  type UpdatePlatformInput,
  type UpdateProfileInput,
  type UpdateUserInput,
} from "@kouland/contracts";
import { z } from "zod";

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

/** For 204 responses. */
const noContent: Parser<void> = { parse: () => undefined };
const idReceipt = z.object({ id: z.string() });

/** `?a=1&b=x` from an object, leaving out empty values. */
function queryString(query: object = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
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
        // The CRM signs in with an httpOnly cookie set by the API; the browser must send it with each call.
        credentials: "include",
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

    // ---- CRM (the browser must be signed in) ----

    auth: {
      login: (input: LoginInput) => request("POST", "/auth/login", sessionUserSchema, { json: input }),
      logout: () => request("POST", "/auth/logout", noContent),
      me: () => request("GET", "/auth/me", sessionUserSchema),
      updateMe: (input: UpdateProfileInput) => request("PATCH", "/auth/me", sessionUserSchema, { json: input }),
      changePassword: (input: ChangePasswordInput) => request("POST", "/auth/password", noContent, { json: input }),
      /** Public: whose invitation or password link this is (410 when expired or used). */
      linkInfo: (token: string) => request("GET", `/auth/links/${encodeURIComponent(token)}`, linkInfoSchema),
      /** Public: choose a password with the link; signs the person in. */
      useLink: (token: string, password: string) =>
        request("POST", `/auth/links/${encodeURIComponent(token)}`, sessionUserSchema, { json: { password } }),
    },
    users: {
      list: () => request("GET", "/users", z.array(userSchema)),
      assignable: () => request("GET", "/users/assignable", assignableUsersSchema),
      /** Creates the account and emails the invitation. */
      create: (input: CreateUserInput) => request("POST", "/users", invitedUserSchema, { json: input }),
      update: (id: string, input: UpdateUserInput) => request("PATCH", `/users/${id}`, userSchema, { json: input }),
      /** Emails a new invitation, or a link to choose a new password. */
      sendLink: (id: string) => request("POST", `/users/${id}/link`, linkReceiptSchema),
    },
    platforms: {
      /** `all`: include inactive platforms (administrators). */
      list: (all = false) => request("GET", `/platforms${all ? "?all=1" : ""}`, z.array(platformSchema)),
      create: (input: CreatePlatformInput) => request("POST", "/platforms", platformSchema, { json: input }),
      update: (id: string, input: UpdatePlatformInput) => request("PATCH", `/platforms/${id}`, platformSchema, { json: input }),
    },
    customers: {
      list: (query?: CustomerListQuery) => request("GET", `/customers${queryString(query)}`, pageOf(customerSummarySchema)),
      get: (id: string) => request("GET", `/customers/${id}`, customerDetailSchema),
      create: (input: CustomerInput) => request("POST", "/customers", idReceipt, { json: input }),
      update: (id: string, input: CustomerInput) => request("PUT", `/customers/${id}`, idReceipt, { json: input }),
      setStage: (id: string, stage: CustomerStage) => request("PATCH", `/customers/${id}/stage`, noContent, { json: { stage } }),
      remove: (id: string) => request("DELETE", `/customers/${id}`, noContent),
      addContact: (id: string, input: ContactInput) => request("POST", `/customers/${id}/contacts`, contactSchema, { json: input }),
      updateContact: (id: string, contactId: string, input: ContactInput) =>
        request("PUT", `/customers/${id}/contacts/${contactId}`, contactSchema, { json: input }),
      removeContact: (id: string, contactId: string) => request("DELETE", `/customers/${id}/contacts/${contactId}`, noContent),
      addNote: (id: string, input: NoteInput) => request("POST", `/customers/${id}/notes`, activitySchema, { json: input }),
    },
    opportunities: {
      list: (query?: OpportunityListQuery) => request("GET", `/opportunities${queryString(query)}`, pageOf(opportunitySummarySchema)),
      get: (id: string) => request("GET", `/opportunities/${id}`, opportunityDetailSchema),
      create: (input: CreateOpportunityInput) => request("POST", "/opportunities", idReceipt, { json: input }),
      update: (id: string, input: UpdateOpportunityInput) => request("PUT", `/opportunities/${id}`, idReceipt, { json: input }),
      setStatus: (id: string, input: OpportunityStatusInput) => request("PATCH", `/opportunities/${id}/status`, noContent, { json: input }),
      remove: (id: string) => request("DELETE", `/opportunities/${id}`, noContent),
      addProposal: (id: string, input: ProposalInput) => request("POST", `/opportunities/${id}/proposals`, proposalSchema, { json: input }),
      updateProposal: (proposalId: string, input: ProposalInput) => request("PUT", `/proposals/${proposalId}`, proposalSchema, { json: input }),
      removeProposal: (proposalId: string) => request("DELETE", `/proposals/${proposalId}`, noContent),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
