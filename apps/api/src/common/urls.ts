/** The website's address (where the CRM lives): APP_URL, else the first allowed website origin, else local. */
export function appUrl(): string {
  const configured = process.env.APP_URL || (process.env.CORS_ORIGINS ?? "").split(",")[0];
  return (configured || "http://localhost:3100").trim().replace(/\/+$/, "");
}

/**
 * The API's public address, without `/api`, as outside services reach it: platforms' webhooks, Twilio, and the
 * Google and Microsoft sign-in returns. PUBLIC_API_URL, e.g. https://api.kouland.com, or on Railway staging the
 * website's address followed by /backend (the website forwards it to the API).
 */
export function publicApiUrl(): string {
  const configured = process.env.PUBLIC_API_URL || `http://localhost:${process.env.API_PORT || 4100}`;
  return configured.trim().replace(/\/+$/, "").replace(/\/api$/, "");
}
