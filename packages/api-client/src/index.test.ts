import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, createApiClient } from "./index";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const input = { name: "Awa Diallo", email: "awa@example.com", message: "I need hosting for my shop." };

test("posts the contact message and returns the receipt", async () => {
  let called: { url: string; init?: RequestInit } | undefined;
  const client = createApiClient({
    baseUrl: "http://api.test/api/",
    fetch: async (url, init) => {
      called = { url: String(url), init };
      return json(201, { id: "msg_1", createdAt: "2026-11-14T10:00:00.000Z" });
    },
  });
  const receipt = await client.contact.send(input);
  assert.equal(receipt.id, "msg_1");
  assert.equal(called?.url, "http://api.test/api/contact");
  assert.equal(called?.init?.method, "POST");
});

test("turns a validation response into an ApiError with field errors", async () => {
  const client = createApiClient({
    baseUrl: "http://api.test/api",
    fetch: async () =>
      json(400, { statusCode: 400, message: "Validation failed", fieldErrors: { email: ["Enter a valid email address"] } }),
  });
  await assert.rejects(client.contact.send(input), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 400);
    assert.deepEqual(error.fieldErrors.email, ["Enter a valid email address"]);
    return true;
  });
});

test("reports a network failure as status 0", async () => {
  const client = createApiClient({
    baseUrl: "http://api.test/api",
    fetch: async () => {
      throw new TypeError("fetch failed");
    },
  });
  await assert.rejects(client.contact.send(input), (error: unknown) => error instanceof ApiError && error.status === 0);
});
