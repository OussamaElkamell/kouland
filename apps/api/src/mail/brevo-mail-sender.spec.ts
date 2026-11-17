import { BREVO_URL, BrevoMailSender } from "./brevo-mail-sender";

const mail = {
  to: [{ email: "contact@kouland.com", name: "Kouland Technology" }],
  replyTo: { email: "awa@example.com", name: "Awa Diallo" },
  subject: "Website message from Awa Diallo",
  html: "<p>Hello</p>",
  text: "Hello",
  tag: "contact-message",
};

describe("BrevoMailSender", () => {
  it("posts the email to Brevo's transactional API", async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ messageId: "<id@brevo>" }), { status: 201 }));
    const sender = new BrevoMailSender({ apiKey: "test-key", from: { email: "no-reply@kouland.com", name: "Kouland" } }, fetchMock);

    await sender.send(mail);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(BREVO_URL);
    expect(init.method).toBe("POST");
    expect(init.headers["api-key"]).toBe("test-key");
    expect(JSON.parse(init.body)).toEqual({
      sender: { email: "no-reply@kouland.com", name: "Kouland" },
      to: [{ email: "contact@kouland.com", name: "Kouland Technology" }],
      replyTo: { email: "awa@example.com", name: "Awa Diallo" },
      subject: "Website message from Awa Diallo",
      htmlContent: "<p>Hello</p>",
      textContent: "Hello",
      tags: ["contact-message"],
    });
  });

  it("sends attachments base64-encoded", async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    const sender = new BrevoMailSender({ apiKey: "k", from: { email: "noreply@kouland.com" } }, fetchMock);

    await sender.send({ ...mail, attachments: [{ name: "cv.pdf", content: Buffer.from("%PDF-1.7") }] });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).attachment).toEqual([{ name: "cv.pdf", content: Buffer.from("%PDF-1.7").toString("base64") }]);
  });

  it("throws with Brevo's error code when the request is refused", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ code: "unauthorized", message: "Key not found" }), { status: 401 }));
    const sender = new BrevoMailSender({ apiKey: "bad", from: { email: "no-reply@kouland.com" } }, fetchMock);

    await expect(sender.send(mail)).rejects.toThrow("Brevo 401 unauthorized Key not found");
  });
});
