import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockFetch = jest.fn() as jest.Mock<any>;
const response = (status: number) => ({ ok: status >= 200 && status < 300, status, text: async () => "" });

async function load(key = "re_full", segment = "seg_1") {
  process.env.RESEND_CONTACTS_API_KEY = key;
  process.env.RESEND_SEGMENT_ID = segment;
  return import("../src/services/contactService.js");
}

const contact = { email: "a+b@example.com", firstName: "Sara", lastName: null };

describe("contactService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    mockFetch.mockReset();
    (globalThis as any).fetch = mockFetch;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("addContact", () => {
    it("creates a missing contact in the segment", async () => {
      mockFetch.mockResolvedValueOnce(response(404)).mockResolvedValueOnce(response(201));
      const { addContact } = await load();
      await addContact(contact);

      const [getUrl, getInit] = mockFetch.mock.calls[0] as [string, any];
      expect(getUrl).toBe("https://api.resend.com/contacts/a%2Bb%40example.com");
      expect(getInit.headers.Authorization).toBe("Bearer re_full");
      expect(getInit.signal).toBeInstanceOf(AbortSignal);

      const [postUrl, postInit] = mockFetch.mock.calls[1] as [string, any];
      expect(postUrl).toBe("https://api.resend.com/contacts");
      expect(postInit.method).toBe("POST");
      expect(JSON.parse(postInit.body)).toEqual({
        email: "a+b@example.com",
        first_name: "Sara",
        segments: [{ id: "seg_1" }],
      });
    });

    it("leaves an existing contact untouched so an unsubscribe is never undone", async () => {
      mockFetch.mockResolvedValueOnce(response(200));
      const { addContact } = await load();
      await addContact(contact);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it.each([["key", "", "seg_1"], ["segment", "re_full", ""]])("does nothing without a %s", async (_n, key, seg) => {
      const { addContact } = await load(key, seg);
      await addContact(contact);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("throws when the lookup fails, and does not create", async () => {
      mockFetch.mockResolvedValueOnce(response(500));
      const { addContact } = await load();
      await expect(addContact(contact)).rejects.toThrow("500");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("throws when creating fails, without the address in the message", async () => {
      mockFetch.mockResolvedValueOnce(response(404)).mockResolvedValueOnce(response(422));
      const { addContact } = await load();
      const err = (await addContact(contact).catch((e: unknown) => e)) as Error;
      expect(err.message).toContain("422");
      expect(err.message).not.toContain("example.com");
    });
  });

  describe("removeContact", () => {
    it("deletes by address", async () => {
      mockFetch.mockResolvedValueOnce(response(200));
      const { removeContact } = await load();
      await removeContact("a+b@example.com");
      const [url, init] = mockFetch.mock.calls[0] as [string, any];
      expect(url).toBe("https://api.resend.com/contacts/a%2Bb%40example.com");
      expect(init.method).toBe("DELETE");
    });

    it("treats an already missing contact as done", async () => {
      mockFetch.mockResolvedValueOnce(response(404));
      const { removeContact } = await load();
      await expect(removeContact("a@b.co")).resolves.toBeUndefined();
    });

    it("throws on other failures", async () => {
      mockFetch.mockResolvedValueOnce(response(500));
      const { removeContact } = await load();
      await expect(removeContact("a@b.co")).rejects.toThrow("500");
    });

    it("works without a segment, so a removed segment can't block deletion", async () => {
      mockFetch.mockResolvedValueOnce(response(200));
      const { removeContact } = await load("re_full", "");
      await removeContact("a@b.co");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("does nothing without a key", async () => {
      const { removeContact } = await load("");
      await removeContact("a@b.co");
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
