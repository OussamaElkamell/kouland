import { buildContactEmail } from "./contact-email";

const receivedAt = new Date("2026-11-16T21:30:00.000Z");

describe("buildContactEmail", () => {
  it("puts the visitor's details and message in the subject, text and HTML", () => {
    const email = buildContactEmail(
      { name: "Awa Diallo", email: "awa@example.com", phone: "+1 555 0100", subject: "Hosting", message: "I need hosting for my shop." },
      receivedAt,
    );
    expect(email.subject).toBe("Website message from Awa Diallo: Hosting");
    expect(email.text).toContain("Phone: +1 555 0100");
    expect(email.text).toContain("Received: 2026-11-16 21:30 UTC");
    expect(email.html).toContain("I need hosting for my shop.");
    expect(email.html).not.toContain("Company");
  });

  it("escapes anything the visitor typed so it cannot inject HTML", () => {
    const email = buildContactEmail(
      { name: "<b>Eve</b>", email: "eve@example.com", message: '<script>alert("x")</script> & more' },
      receivedAt,
    );
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>Eve</b>");
    expect(email.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; more");
  });
});
