import { hashPassword, verifyPassword } from "./password";
import { readCookie } from "./session.service";

describe("password hashing", () => {
  it("verifies the right password and refuses a wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("correct horse");
    await expect(verifyPassword("correct horse battery", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong horse battery", hash)).resolves.toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same password")).not.toBe(await hashPassword("same password"));
  });

  it("refuses a malformed stored value", async () => {
    await expect(verifyPassword("anything", "plain-text")).resolves.toBe(false);
  });
});

describe("readCookie", () => {
  it("finds one cookie among several", () => {
    expect(readCookie("a=1; kouland_session=abc%3D; b=2", "kouland_session")).toBe("abc=");
    expect(readCookie(undefined, "kouland_session")).toBeUndefined();
    expect(readCookie("other=1", "kouland_session")).toBeUndefined();
  });
});
