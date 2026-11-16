import { createApiClient } from "@kouland/api-client";

/** The one API client for the website and the CRM. The frontend never talks to the database directly. */
export const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100/api",
});
