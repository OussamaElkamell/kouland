import assert from "node:assert/strict";
import { test } from "node:test";
import { APPLICATION_STEP_SCHEMAS, jobApplicationSchema } from "./careers";

const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const valid = {
  fullName: "Awa Diallo",
  email: " Awa@Example.com ",
  phone: "+1 555 0100",
  city: "Tulsa",
  country: "United States",
  area: "tech",
  position: "Field technician",
  employmentType: "fullTime",
  workMode: "onSite",
  experienceLevel: "3to5",
  skills: "TV mounting, home networks, security cameras",
  motivation: "I have installed home theaters and smart home systems for four years and enjoy explaining technology.",
  linkedinUrl: "",
  portfolioUrl: "https://awa.example.com",
  availableFrom: tomorrow,
  salaryExpectation: "",
  consent: true,
} as const;

test("accepts a complete application and cleans it", () => {
  const parsed = jobApplicationSchema.parse(valid);
  assert.equal(parsed.email, "awa@example.com");
  assert.equal(parsed.linkedinUrl, undefined);
  assert.equal(parsed.salaryExpectation, undefined);
});

test("checks each step on its own", () => {
  assert.equal(APPLICATION_STEP_SCHEMAS.profile.safeParse(valid).success, true);
  const role = APPLICATION_STEP_SCHEMAS.role.safeParse({ ...valid, area: "marketing" });
  assert.equal(role.success, false);
});

test("refuses a short motivation, a bad link, a past date and missing consent", () => {
  const result = jobApplicationSchema.safeParse({
    ...valid,
    motivation: "Too short",
    linkedinUrl: "linkedin",
    availableFrom: "2020-01-01",
    consent: false,
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(Object.keys(result.error.flatten().fieldErrors).sort(), ["availableFrom", "consent", "linkedinUrl", "motivation"]);
  }
});
