// The contact form (pages/contact.html), which posts to /contact. A submission
// is checked like the form's own attributes check it, then Jev (TypeSafe AI's
// decision model) is asked whether it's worth reading. If it says so with a
// probability over FORWARD_ABOVE, the whole submission is emailed to
// CONTACT_EMAIL. Either way the sender sees the same confirmation, so spammers
// learn nothing. If Jev can't be asked, the message is forwarded, marked as unvetted.
//
// Jev's API: POST https://api.typesafe.ai/v1/systemone (as on hypermediajobs.com).

import type { Env } from "./worker";

export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const DEFAULT_MODEL = "jev-latest";
const JEV_TIMEOUT_MS = 10_000;

/** Messages Jev scores above this are forwarded. */
export const FORWARD_ABOVE = 0.25;

export const QUESTIONS = {
  worth_reading: {
    type: "noul",
    instructions: "Is this message legitimate and something worth my time to read and respond to?",
  },
} as const;

export interface Submission {
  name: string;
  email: string;
  message: string;
}

/** A field with a problem, or "send" when the message couldn't be forwarded. Each has its [data-error] in the page. */
export type Problem = keyof Submission | "send";

export type Outcome = { sent: true } | { sent: false; submission: Submission; problems: Problem[]; status: number };

/** Check a submission and, unless Jev rules it out, forward it. */
export async function submit(request: Request, env: Env): Promise<Outcome> {
  const submission = await read(request);
  const problems = check(submission);
  if (problems.length) return { sent: false, submission, problems, status: 422 };

  const ip = request.headers.get("cf-connecting-ip");
  let verdict: string;
  try {
    if (!env.TYPESAFE_API_KEY) throw new Error("TYPESAFE_API_KEY is not set");
    const score = await askJev({ ...submission, ip }, env.TYPESAFE_API_KEY, env.JEV_MODEL || DEFAULT_MODEL);
    if (score <= FORWARD_ABOVE) return { sent: true };
    verdict = score.toFixed(2);
  } catch (err) {
    console.error("Jev failed; forwarding unvetted", err);
    verdict = `unvetted (${err instanceof Error ? err.message : String(err)})`;
  }

  try {
    await env.EMAIL.send({
      to: env.CONTACT_EMAIL,
      from: { email: env.EMAIL_FROM, name: "alexandermorgan.dev" },
      replyTo: submission.email,
      subject: `Contact form: ${submission.name}`,
      text:
        `Name: ${submission.name}\n` +
        `Email: ${submission.email}\n` +
        `IP: ${ip ?? "unknown"}\n` +
        `Jev: ${verdict}\n\n` +
        `${submission.message}\n`,
    });
    return { sent: true };
  } catch (err) {
    console.error("contact email failed", err);
    return { sent: false, submission, problems: ["send"], status: 502 };
  }
}

async function read(request: Request): Promise<Submission> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    form = new FormData();
  }
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  return {
    // The name goes in the subject line, so it is one line.
    name: field("name").replace(/\s+/g, " "),
    email: field("email"),
    // Browsers send line breaks as CRLF but count them as one character, as this does.
    message: field("message").replace(/\r\n?/g, "\n"),
  };
}

/** The same limits as the form's attributes, which a browser checks first. */
function check({ name, email, message }: Submission): Problem[] {
  const problems: Problem[] = [];
  if (!name || name.length > 200) problems.push("name");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push("email");
  if (message.length < 25 || message.length > 2000) problems.push("message");
  return problems;
}

/** Jev's probability that the message is worth reading. */
async function askJev(state: Submission & { ip: string | null }, apiKey: string, model: string): Promise<number> {
  const response = await fetch(JEV_ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model, state, questions: QUESTIONS }),
    signal: AbortSignal.timeout(JEV_TIMEOUT_MS),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Jev HTTP ${response.status}: ${body.slice(0, 200)}`);
  const score = (JSON.parse(body) as { answers?: { worth_reading?: { noul?: unknown } } }).answers?.worth_reading?.noul;
  if (typeof score !== "number" || !Number.isFinite(score)) throw new Error(`unexpected Jev response: ${body.slice(0, 200)}`);
  return score;
}

/**
 * pages/contact.html with what was sent filled back in, the fields with
 * problems marked invalid and their messages shown.
 */
export function fillForm(page: string, submission: Submission, problems: Problem[]): Promise<string> {
  // setAttribute escapes quotes but not &, which would otherwise start a character reference.
  const attribute = (value: string) => value.replaceAll("&", "&amp;");
  return new HTMLRewriter()
    .on("input[name], textarea[name]", {
      element(element) {
        const name = element.getAttribute("name") as keyof Submission;
        if (!(name in submission)) return;
        if (element.tagName === "textarea") element.setInnerContent(submission[name]);
        else element.setAttribute("value", attribute(submission[name]));
        if (problems.includes(name)) {
          element.setAttribute("aria-invalid", "true");
          element.setAttribute("aria-describedby", `${name}-error`);
        }
      },
    })
    .on("[data-error]", {
      element(element) {
        if (problems.includes(element.getAttribute("data-error") as Problem)) element.removeAttribute("hidden");
      },
    })
    .transform(new Response(page))
    .text();
}
