import assert from "node:assert/strict";
import { test } from "node:test";
import { createUserSchema, levelAllows, updateUserSchema } from "./auth";
import { customerDisplayName, customerFieldsSchema } from "./customers";
import { createPlatformSchema, slugify } from "./platforms";
import { createOpportunitySchema, proposalInputSchema } from "./sales";

const firstCode = (result: { success: boolean; error?: { issues: Array<{ path: (string | number)[]; message: string }> } }, path: string) =>
  result.error?.issues.find((issue) => issue.path.join(".") === path)?.message;

test("access levels are ordered VIEW < EDIT < MANAGE", () => {
  assert.equal(levelAllows("MANAGE", "EDIT"), true);
  assert.equal(levelAllows("EDIT", "MANAGE"), false);
  assert.equal(levelAllows(null, "VIEW"), false);
});

test("an employee cannot be given MANAGE; a manager can", () => {
  const base = { email: "a@b.co", password: "long-enough-1", name: "A", platformIds: [] };
  const employee = createUserSchema.safeParse({ ...base, role: "EMPLOYEE", access: { CUSTOMERS: "MANAGE", SALES: null } });
  assert.equal(employee.success, false);
  assert.equal(firstCode(employee, "access.CUSTOMERS"), "invalid");
  assert.equal(createUserSchema.safeParse({ ...base, role: "MANAGER", access: { CUSTOMERS: "MANAGE", SALES: "VIEW" } }).success, true);
  assert.equal(updateUserSchema.safeParse({ role: "EMPLOYEE", access: { CUSTOMERS: "EDIT", SALES: "MANAGE" } }).success, false);
});

test("passwords need at least 10 characters", () => {
  const result = createUserSchema.safeParse({ email: "a@b.co", password: "short", name: "A", role: "MANAGER", access: { CUSTOMERS: null, SALES: null } });
  assert.equal(firstCode(result, "password"), "passwordTooShort");
});

test("a person needs a first name and a company needs a company name", () => {
  assert.equal(firstCode(customerFieldsSchema.safeParse({ type: "INDIVIDUAL" }), "firstName"), "required");
  assert.equal(firstCode(customerFieldsSchema.safeParse({ type: "COMPANY", firstName: "Awa" }), "companyName"), "required");
});

test("customer fields: empty strings become null, emails are lowercased, websites get https", () => {
  const parsed = customerFieldsSchema.parse({ type: "INDIVIDUAL", firstName: " Awa ", lastName: "", email: " Awa@Example.COM ", website: "shop.example.com" });
  assert.equal(parsed.firstName, "Awa");
  assert.equal(parsed.lastName, null);
  assert.equal(parsed.email, "awa@example.com");
  assert.equal(parsed.website, "https://shop.example.com");
  assert.equal(parsed.stage, "PROSPECT");
  assert.equal(customerDisplayName(parsed), "Awa");
  assert.equal(customerDisplayName({ type: "COMPANY", companyName: "Shop", firstName: null, lastName: null }), "Shop");
});

test("platform slug is made from the name and colours are normalised", () => {
  assert.equal(slugify("Kouland Événement"), "kouland-evenement");
  const parsed = createPlatformSchema.parse({ name: "New Platform", color: "#3cc218" });
  assert.equal(parsed.slug, "new-platform");
  assert.equal(parsed.color, "#3CC218");
  assert.equal(createPlatformSchema.safeParse({ name: "X", color: "green" }).success, false);
});

test("an opportunity needs either an existing customer or a new prospect, not both", () => {
  const base = { title: "Website", platformId: "p1" };
  assert.equal(createOpportunitySchema.safeParse(base).success, false);
  assert.equal(createOpportunitySchema.safeParse({ ...base, customerId: "c1" }).success, true);
  assert.equal(createOpportunitySchema.safeParse({ ...base, newCustomer: { type: "INDIVIDUAL", firstName: "Awa" } }).success, true);
  assert.equal(createOpportunitySchema.safeParse({ ...base, customerId: "c1", newCustomer: { type: "INDIVIDUAL", firstName: "Awa" } }).success, false);
});

test("amounts come from text inputs with at most 2 decimals", () => {
  const ok = proposalInputSchema.parse({ title: "Quote", amount: " 1200.50 " });
  assert.equal(ok.amount, 1200.5);
  assert.equal(ok.currency, "USD");
  assert.equal(firstCode(proposalInputSchema.safeParse({ title: "Quote", amount: "12.345" }), "amount"), "amount");
  assert.equal(firstCode(proposalInputSchema.safeParse({ title: "Quote", amount: "" }), "amount"), "required");
  assert.equal(proposalInputSchema.safeParse({ title: "Quote", amount: "-5" }).success, false);
  const value = createOpportunitySchema.parse({ title: "W", platformId: "p", customerId: "c", estimatedValue: "" });
  assert.equal(value.estimatedValue, null);
});
