import { buildLinkEmail } from "./link-email";

const base = { name: "Awa <Diallo>", invitedBy: "Test Admin", link: "https://kouland.com/admin/link?token=abc", validHours: 168 } as const;

describe("buildLinkEmail", () => {
  it("writes the invitation in the person's language with the link and how long it works", () => {
    const en = buildLinkEmail({ ...base, purpose: "INVITE", locale: "en" });
    expect(en.subject).toBe("You are invited to Kouland CRM");
    expect(en.text).toContain(base.link);
    expect(en.text).toContain("7 days");
    expect(en.html).toContain(`href="${base.link}"`);
    expect(en.html).toContain("Test Admin has created");

    expect(buildLinkEmail({ ...base, purpose: "INVITE", locale: "fr" }).subject).toBe("Votre invitation à Kouland CRM");
    expect(buildLinkEmail({ ...base, purpose: "INVITE", locale: "es" }).subject).toBe("Su invitación a Kouland CRM");
  });

  it("has its own wording for password links", () => {
    const reset = buildLinkEmail({ ...base, purpose: "RESET_PASSWORD", locale: "en", validHours: 24 });
    expect(reset.subject).toBe("Choose a new password for Kouland CRM");
    expect(reset.text).toContain("24 hours");
  });

  it("escapes names in the HTML", () => {
    const html = buildLinkEmail({ ...base, purpose: "INVITE", locale: "en" }).html;
    expect(html).toContain("Awa &lt;Diallo&gt;");
    expect(html).not.toContain("<Diallo>");
  });
});
