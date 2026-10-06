import { z } from "zod";
import { companyProfileSchema, type CompanyProfile } from "../../contracts/lead.js";
import type { LiteLlmClient } from "../../llm/liteLlm.js";
import { AgentRunError, runAgent } from "../runAgent.js";
import type { AgentDefinition } from "../types.js";

/**
 * Mailbox providers whose domain says nothing about an employer. Their domain
 * is not sent to the model, since it would only mislead the search.
 */
const PERSONAL_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.be",
  "hotmail.fr",
  "outlook.com",
  "outlook.be",
  "live.com",
  "live.be",
  "msn.com",
  "yahoo.com",
  "yahoo.fr",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "skynet.be",
  "telenet.be",
  "proximus.be",
  "orange.fr",
  "free.fr",
  "gmx.com",
  "gmx.de",
  "web.de",
]);

/** The email domain, when it can hint at the employer. */
export function employerDomain(email: string): string | undefined {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  return domain && !PERSONAL_MAIL_DOMAINS.has(domain) ? domain : undefined;
}

const lookupReplySchema = z.discriminatedUnion("found", [
  z.object({ found: z.literal(true), profile: companyProfileSchema }),
  z.object({ found: z.literal(false), reason: z.string().trim().max(1_000).optional() }),
]);

export type CompanyLookupResult =
  | { readonly found: true; readonly profile: CompanyProfile }
  | { readonly found: false; readonly reason?: string };

/**
 * The task sent to the Pappers agent.
 *
 * Only the company name and a work email domain leave the backoffice: the
 * attendee's name, address, and phone are not needed to find their employer.
 */
export function companyLookupPrompt(company: string, domain: string | undefined): string {
  return `Identify the company a workshop attendee works for and report its profile.

Company name as the attendee typed it: ${JSON.stringify(company)}
${domain ? `Work email domain: ${domain}` : "Work email domain: unknown"}

1. Search the register. Assume Belgium unless the name or the email domain points to another covered country. Try a shorter or alternative spelling if the first search finds nothing.
2. Pick the best match, preferring active companies, and use the email domain to tell similar names apart. If nothing plausibly matches, report it as not found rather than guessing.
3. Fetch the match with get_company. If the base record has no headcount, request only the "financials" section, which usually carries the number of employees. Request no other sections.

Reply with a single JSON object and nothing else: no prose, no code fence.

When found:
{"found": true, "profile": {"name": string, "companyNumber": string, "countryCode": string, "legalForm": string, "status": string, "address": string, "employees": string, "activity": string, "foundedOn": "YYYY-MM-DD", "website": string, "summary": string, "matchNote": string}}

When not found:
{"found": false, "reason": string}

- address: the registered office as one line.
- employees: the headcount as the register gives it, with its year, such as "42 (2024)" or "10-19 employees".
- activity: what the company does, in plain English, not only an activity code.
- summary: two or three sentences a salesperson can read before a call.
- matchNote: why you believe this is the attendee's company.
- Leave out any field Pappers has no data for. Never invent a value.`;
}

/** A reply that was not the JSON the lookup asked for. */
export class CompanyLookupError extends AgentRunError {
  constructor(message: string) {
    super(message);
    this.name = "CompanyLookupError";
  }
}

/** Pull the JSON object out of a reply, tolerating a code fence or stray prose. */
export function parseLookupReply(output: string): CompanyLookupResult {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new CompanyLookupError("The agent did not answer with a company profile.");
  }

  let json: unknown;
  try {
    json = JSON.parse(output.slice(start, end + 1));
  } catch {
    throw new CompanyLookupError("The agent's company profile was not valid JSON.");
  }

  const parsed = lookupReplySchema.safeParse(json);
  if (!parsed.success) {
    throw new CompanyLookupError("The agent's company profile did not have the expected fields.");
  }
  return parsed.data;
}

/** Ask the Pappers agent to find a company and describe it. */
export async function lookUpCompany(
  liteLlm: LiteLlmClient,
  agent: AgentDefinition,
  subject: { readonly company: string; readonly email: string },
): Promise<CompanyLookupResult> {
  const prompt = companyLookupPrompt(subject.company, employerDomain(subject.email));
  const { output } = await runAgent(liteLlm, agent, prompt);
  return parseLookupReply(output);
}
