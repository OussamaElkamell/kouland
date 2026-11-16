import assert from "node:assert/strict";
import { test } from "node:test";
import { createContactMessageSchema } from "./contact";

const valid = { name: "Awa Diallo", email: " Awa@Example.com ", message: "I need hosting for my shop." };

test("accepts a valid message, trims and lowercases the email", () => {
  const parsed = createContactMessageSchema.parse(valid);
  assert.equal(parsed.email, "awa@example.com");
  assert.equal(parsed.phone, undefined);
});

test("turns blank optional fields into undefined", () => {
  const parsed = createContactMessageSchema.parse({ ...valid, phone: "   ", company: "" });
  assert.equal(parsed.phone, undefined);
  assert.equal(parsed.company, undefined);
});

test("rejects a short name, a bad email and a too-short message", () => {
  const result = createContactMessageSchema.safeParse({ name: "A", email: "nope", message: "hi" });
  assert.equal(result.success, false);
  if (!result.success) {
    const fields = Object.keys(result.error.flatten().fieldErrors);
    assert.deepEqual(fields.sort(), ["email", "message", "name"]);
  }
});
