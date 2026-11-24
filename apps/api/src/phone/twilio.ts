import { BadGatewayException, ServiceUnavailableException } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { safeEqual } from "../common/secrets";

/**
 * Twilio over its REST API and TwiML, with fetch.
 *   Calls:    https://www.twilio.com/docs/voice/api/call-resource
 *   Messages: https://www.twilio.com/docs/messaging/api/message-resource
 *   <Dial>:   https://www.twilio.com/docs/voice/twiml/dial
 *   Security: https://www.twilio.com/docs/usage/security
 * Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER (the company number, +1…).
 */
export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

export function twilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER?.trim();
  return accountSid && authToken && phoneNumber ? { accountSid, authToken, phoneNumber } : null;
}

export function requireTwilio(): TwilioConfig {
  const config = twilioConfig();
  if (!config) throw new ServiceUnavailableException("The phone is not set up on the server (Twilio account and number).");
  return config;
}

/**
 * X-Twilio-Signature: Base64(HMAC-SHA1(auth token, full URL + each POST parameter's name and value, sorted by
 * name)). Proves the request comes from Twilio.
 */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, name) => acc + name + params[name], url);
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

export function validTwilioRequest(authToken: string, url: string, params: Record<string, string>, signature: string | undefined): boolean {
  if (!signature) return false;
  if (safeEqual(signature, twilioSignature(authToken, url, params))) return true;
  // Over HTTPS Twilio signs voice requests without the port and SMS ones with it: accept either form.
  const withoutPort = url.replace(/^(https?:\/\/[^/:]+):\d+/, "$1");
  return withoutPort !== url && safeEqual(signature, twilioSignature(authToken, withoutPort, params));
}

async function post(config: TwilioConfig, resource: string, params: URLSearchParams): Promise<{ sid: string; status: string }> {
  const base = (process.env.TWILIO_API_BASE || "https://api.twilio.com").replace(/\/+$/, "");
  let response: Response;
  try {
    response = await fetch(`${base}/2010-04-01/Accounts/${config.accountSid}/${resource}.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
  } catch (error) {
    throw new BadGatewayException(`Could not reach Twilio (${error instanceof Error ? error.message : String(error)}).`);
  }
  const data = (await response.json().catch(() => ({}))) as { sid?: string; status?: string; message?: string; code?: number };
  if (!response.ok || !data.sid) throw new BadGatewayException(`Twilio refused it: ${data.message ?? response.status}${data.code ? ` (code ${data.code})` : ""}`);
  return { sid: data.sid, status: data.status ?? "queued" };
}

/** Rings `to`; when answered, Twilio fetches TwiML from `url`. `statusCallback` hears when the call ends. */
export function createCall(config: TwilioConfig, input: { to: string; url: string; statusCallback: string; timeout: number }) {
  const params = new URLSearchParams({
    To: input.to,
    From: config.phoneNumber,
    Url: input.url,
    StatusCallback: input.statusCallback,
    Timeout: String(input.timeout),
  });
  params.append("StatusCallbackEvent", "completed");
  return post(config, "Calls", params);
}

export function sendMessage(config: TwilioConfig, input: { to: string; body: string; statusCallback: string }) {
  return post(config, "Messages", new URLSearchParams({ To: input.to, From: config.phoneNumber, Body: input.body, StatusCallback: input.statusCallback }));
}

// ---- TwiML ----

const xml = (value: string) => value.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

export function twimlDial(input: { number: string; action: string; timeout: number; callerId: string }): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial timeout="${input.timeout}" action="${xml(input.action)}" method="POST" callerId="${xml(input.callerId)}"><Number>${xml(input.number)}</Number></Dial></Response>`;
}

export function twimlSay(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${xml(message)}</Say><Hangup/></Response>`;
}

export const TWIML_HANGUP = `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;
export const TWIML_EMPTY = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
