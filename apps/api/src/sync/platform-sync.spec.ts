import { createHmac } from "node:crypto";
import { parseSignature, signWebhook } from "./platform-sync.service";
import { twilioSignature, twimlDial, validTwilioRequest } from "../phone/twilio";
import { buildMime, parseAddressList } from "../email/providers";
import { phoneKey } from "../common/phone-match";
import { decryptSecret, encryptSecret } from "../common/secrets";

describe("platform webhook signature", () => {
  it("reads t and v1 from the header", () => {
    expect(parseSignature("t=1700000000,v1=abc,v1=def")).toEqual({ timestamp: 1700000000, signatures: ["abc", "def"] });
    expect(parseSignature("v1=abc")).toBeNull();
    expect(parseSignature(undefined)).toBeNull();
  });

  it("signs '<t>.<body>' with HMAC-SHA256 in hex", () => {
    const expected = createHmac("sha256", "whsec_test").update('1700000000.{"id":"1"}').digest("hex");
    expect(signWebhook("whsec_test", 1700000000, '{"id":"1"}')).toBe(expected);
    expect(signWebhook("whsec_test", 1700000000, Buffer.from('{"id":"1"}'))).toBe(expected);
    expect(signWebhook("whsec_test", 1700000000, '{"id":"1"}')).toMatch(/^[0-9a-f]{64}$/);
    expect(signWebhook("whsec_test", 1700000001, '{"id":"1"}')).not.toBe(signWebhook("whsec_test", 1700000000, '{"id":"1"}'));
  });
});

describe("Twilio", () => {
  // The worked example on https://www.twilio.com/docs/usage/security
  const url = "https://example.com/myapp.php?foo=1&bar=2";
  const params = { Digits: "1234", To: "+18005551212", From: "+14158675310", Caller: "+14158675310", CallSid: "CA1234567890ABCDE" };

  it("signs requests like Twilio", () => {
    expect(twilioSignature("12345", url, params)).toBe("L/OH5YylLD5NRKLltdqwSvS0BnU=");
    expect(validTwilioRequest("12345", url, params, "L/OH5YylLD5NRKLltdqwSvS0BnU=")).toBe(true);
    expect(validTwilioRequest("12345", url, { ...params, Digits: "9" }, "L/OH5YylLD5NRKLltdqwSvS0BnU=")).toBe(false);
    expect(validTwilioRequest("12345", url, params, undefined)).toBe(false);
  });

  it("escapes TwiML", () => {
    expect(twimlDial({ number: "+1918", action: "https://x/a?call=1&step=0", timeout: 20, callerId: "+1555" })).toContain('action="https://x/a?call=1&amp;step=0"');
  });
});

describe("secrets", () => {
  const previous = process.env.INTEGRATIONS_KEY;
  beforeAll(() => {
    process.env.INTEGRATIONS_KEY = "a".repeat(64);
  });
  afterAll(() => {
    process.env.INTEGRATIONS_KEY = previous;
  });

  it("encrypts so the value cannot be read, and decrypts it back", () => {
    const stored = encryptSecret("whsec_123");
    expect(stored).not.toContain("whsec_123");
    expect(stored).not.toBe(encryptSecret("whsec_123"));
    expect(decryptSecret(stored)).toBe("whsec_123");
  });

  it("refuses a tampered value", () => {
    const [v, iv, tag, data] = encryptSecret("whsec_123").split(".");
    const flipped = `${v}.${iv}.${tag}.${data!.slice(0, -2)}${data!.endsWith("A") ? "B" : "A"}${data!.slice(-1)}`;
    expect(() => decryptSecret(flipped)).toThrow();
  });
});

describe("phone matching", () => {
  it("matches the same number typed differently", () => {
    expect(phoneKey("+1 (918) 555-0123")).toBe(phoneKey("918.555.0123"));
    expect(phoneKey("+19185550123")).toBe("185550123");
    expect(phoneKey("123")).toBeNull();
  });
});

describe("email helpers", () => {
  it("parses address lists", () => {
    expect(parseAddressList('"Lee, Ann" <Ann@X.com>, bob@y.com')).toEqual([
      { name: "Lee, Ann", email: "ann@x.com" },
      { name: null, email: "bob@y.com" },
    ]);
  });

  it("builds a reply that keeps the conversation", () => {
    const raw = Buffer.from(
      buildMime({
        from: "me@kouland.com",
        to: "ann@x.com",
        cc: [],
        subject: "Re: Devis été",
        body: "Bonjour",
        replyTo: { id: "1", threadId: "t", messageIdHeader: "<m1@x.com>", references: "<m0@x.com>" },
      }),
      "base64url",
    ).toString("utf8");
    expect(raw).toContain("In-Reply-To: <m1@x.com>");
    expect(raw).toContain("References: <m0@x.com> <m1@x.com>");
    expect(raw).toContain("Subject: =?UTF-8?B?");
    expect(raw).toContain(Buffer.from("Bonjour").toString("base64"));
  });
});
