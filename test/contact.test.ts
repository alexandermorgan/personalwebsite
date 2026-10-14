import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { JEV_ENDPOINT, QUESTIONS } from "../src/contact";
import { attr, call, SENT, tags } from "./helpers";

const FORM = { name: "Ada Lovelace", email: "ada@example.com", message: "I'd like to talk about your music analysis work." };
const JEV = { TYPESAFE_API_KEY: "test-key" };

/** What the stubbed Jev was asked, and what it answers. */
let asked: { model: string; state: Record<string, unknown>; questions: unknown }[];
let answer: () => Response;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
let errorSpy: ReturnType<typeof spyOn<Console, "error">>;

const score = (noul: number) => () => Response.json({ model: "jev-latest", answers: { worth_reading: { type: "noul", noul } } });

beforeEach(() => {
  SENT.length = 0;
  asked = [];
  answer = score(0.9);
  // The worker logs Jev and email failures, which some tests cause on purpose.
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(String(input)).toBe(JEV_ENDPOINT);
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-key");
    asked.push(JSON.parse(String(init?.body)));
    return answer();
  }) as typeof fetch);
});
afterEach(() => {
  fetchSpy.mockRestore();
  errorSpy.mockRestore();
});

describe("contact form", () => {
  test("the page is a real form that works without JavaScript", async () => {
    const body = await (await call("/contact")).text();
    const form = tags(body, "form")[0]!;
    expect(attr(form, "method")).toBe("post");
    expect(attr(form, "action")).toBe("/contact");
    const message = tags(body, "textarea")[0]!;
    expect([attr(message, "minlength"), attr(message, "maxlength")]).toEqual(["25", "2000"]);
    // Error messages are in the page but hidden.
    for (const tag of tags(body, "[a-z]+").filter((t) => attr(t, "data-error"))) expect(tag).toContain(" hidden");
  });

  test("asks Jev with the whole form and the IP, then forwards it and redirects to the confirmation", async () => {
    const res = await call("/contact", { form: FORM, headers: { "cf-connecting-ip": "203.0.113.7" }, env: JEV });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/contact/sent");
    expect(asked).toEqual([{ model: "jev-latest", state: { ...FORM, ip: "203.0.113.7" }, questions: QUESTIONS }]);
    expect(QUESTIONS.worth_reading.instructions).toBe("Is this message legitimate and something worth my time to read and respond to?");
    expect(SENT).toHaveLength(1);
    const mail = SENT[0]!;
    expect(mail.to).toBe("me@alexandermorgan.test");
    expect(mail.replyTo).toBe(FORM.email);
    expect(mail.subject).toBe("Contact form: Ada Lovelace");
    for (const text of [FORM.name, FORM.email, FORM.message, "203.0.113.7", "Jev: 0.90"]) expect(mail.text).toContain(text);
    expect((await call("/contact/sent")).status).toBe(200);
  });

  test("forwards only messages Jev scores over 0.25, and confirms either way", async () => {
    for (const [noul, forwarded] of [[0.25, false], [0.1, false], [0.26, true]] as const) {
      SENT.length = 0;
      answer = score(noul);
      const res = await call("/contact", { form: FORM, env: JEV });
      expect(res.status).toBe(303);
      expect({ noul, forwarded: SENT.length === 1 }).toEqual({ noul, forwarded });
    }
  });

  test("without an IP, Jev gets null for it", async () => {
    await call("/contact", { form: FORM, env: JEV });
    expect(asked[0]!.state.ip).toBeNull();
    expect(SENT[0]!.text).toContain("IP: unknown");
  });

  test("forwards the message, marked unvetted, when Jev fails or isn't configured", async () => {
    answer = () => new Response("down", { status: 503 });
    expect((await call("/contact", { form: FORM, env: JEV })).status).toBe(303);
    expect((await call("/contact", { form: FORM })).status).toBe(303);
    expect(SENT).toHaveLength(2);
    expect(SENT[0]!.text).toContain("Jev: unvetted (Jev HTTP 503: down)");
    expect(SENT[1]!.text).toContain("Jev: unvetted (TYPESAFE_API_KEY is not set)");
  });

  test("an invalid form comes back filled in, with the problems marked, and isn't sent", async () => {
    const form = { name: "  ", email: "not-an-email", message: `Too short & "quoted" <b>` };
    const res = await call("/contact", { form, env: JEV });
    expect(res.status).toBe(422);
    const body = await res.text();
    expect(body).toStartWith("<!doctype html>");
    expect(asked).toHaveLength(0);
    expect(SENT).toHaveLength(0);
    const field = (name: string) => [...tags(body, "input"), ...tags(body, "textarea")].find((t) => attr(t, "name") === name)!;
    for (const name of ["name", "email", "message"]) {
      expect(attr(field(name), "aria-invalid")).toBe("true");
      expect(attr(field(name), "aria-describedby")).toBe(`${name}-error`);
      expect(tags(body, "p").find((t) => attr(t, "id") === `${name}-error`)).not.toContain(" hidden");
    }
    expect(attr(field("email"), "value")).toBe("not-an-email");
    expect(body).toContain(`>Too short &amp; "quoted" &lt;b&gt;</textarea>`);
    expect(tags(body, "div").find((t) => attr(t, "data-error") === "send")).toContain(" hidden");
  });

  test("message length is 25 to 2,000 characters, line breaks counted once", async () => {
    for (const [message, status] of [
      ["x".repeat(24), 422],
      ["x".repeat(25), 303],
      ["x".repeat(2000), 303],
      ["x".repeat(2001), 422],
      ["x\r\n".repeat(999) + "xx", 303],
    ] as const) {
      expect({ length: message.length, status: (await call("/contact", { form: { ...FORM, message }, env: JEV })).status }).toEqual({
        length: message.length,
        status,
      });
    }
  });

  test("values with & go back in unchanged", async () => {
    const body = await (await call("/contact", { form: { ...FORM, name: "A &amp; B", message: "short" } })).text();
    expect(attr(tags(body, "input").find((t) => attr(t, "name") === "name")!, "value")).toBe("A &amp; B");
  });

  test("when the email can't be sent, the form comes back with an error", async () => {
    const res = await call("/contact", { form: FORM, env: { ...JEV, EMAIL: { send: () => Promise.reject(new Error("no")) } } });
    expect(res.status).toBe(502);
    const body = await res.text();
    expect(tags(body, "div").find((t) => attr(t, "data-error") === "send")).not.toContain(" hidden");
    expect(attr(tags(body, "input").find((t) => attr(t, "name") === "email")!, "value")).toBe(FORM.email);
  });
});
