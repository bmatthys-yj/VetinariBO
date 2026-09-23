import { z } from "zod";
import type { AgentDefinition, AgentTool } from "../types.js";
import { PAPPERS_COMPANY_FIELDS, type PappersClient } from "./pappersClient.js";

export const PAPPERS_AGENT_ID = "pappers";

/**
 * Longest list the model sees for one company section.
 *
 * A large company has hundreds of publications and establishments; the first
 * entries are the most recent, and they are what a question usually needs.
 */
export const MAX_SECTION_ITEMS = 25;

const countryCode = z
  .string()
  .regex(/^[A-Za-z]{2}$/, "Expected a two-letter ISO country code")
  .describe("ISO 3166-1 alpha-2 country code, such as BE, FR, NL, or LU.");

const searchCompaniesArgs = z.object({
  countryCode,
  query: z.string().trim().min(1).max(200).describe("Company name or registration number."),
  page: z.number().int().min(1).max(50).optional().describe("Result page, starting at 1."),
});

const getCompanyArgs = z.object({
  countryCode,
  companyNumber: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .describe("Registration number from a search result, such as 0202.239.951."),
  fields: z
    .array(z.enum(PAPPERS_COMPANY_FIELDS))
    .max(PAPPERS_COMPANY_FIELDS.length)
    .optional()
    .describe(
      "Extra sections to include. Each costs Pappers credits, so ask only for what the question needs.",
    ),
});

/** Drop `null` values so the model reads fewer tokens of nothing. */
function compact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== null)
        .map(([key, entry]) => [key, compact(entry)]),
    );
  }
  return value;
}

/** Cap every list section, recording how many entries there were in total. */
export function trimCompany(company: unknown): unknown {
  if (!company || typeof company !== "object" || Array.isArray(company)) return compact(company);
  const trimmed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(company)) {
    if (Array.isArray(value) && value.length > MAX_SECTION_ITEMS) {
      trimmed[key] = value.slice(0, MAX_SECTION_ITEMS);
      trimmed[`${key}_total`] = value.length;
    } else {
      trimmed[key] = value;
    }
  }
  return compact(trimmed);
}

/** Registration numbers are shown with dots and spaces; the API wants them bare. */
function bareNumber(companyNumber: string): string {
  return companyNumber.replace(/[\s.]/g, "");
}

/** Without a client the tools still describe themselves, so the page can list them. */
function pappersTools(client: PappersClient | undefined): AgentTool[] {
  const requireClient = (): PappersClient => {
    if (!client) throw new Error("The Pappers API token is not configured.");
    return client;
  };

  const search: AgentTool<typeof searchCompaniesArgs> = {
    name: "search_companies",
    description:
      "Search the company register of one country by name or registration number. Returns up to 10 companies per page with their number, legal form, activities, status, and head office.",
    parameters: searchCompaniesArgs,
    run: async (args) =>
      compact(
        await requireClient().searchCompanies({
          countryCode: args.countryCode.toUpperCase(),
          query: args.query,
          page: args.page,
        }),
      ),
  };

  const getCompany: AgentTool<typeof getCompanyArgs> = {
    name: "get_company",
    description: `Fetch one company by registration number. The base record has identity, VAT number, legal form, activities, status, capital, and head office. Add sections through \`fields\`; long sections are cut to the ${MAX_SECTION_ITEMS} most recent entries, with a \`<field>_total\` count.`,
    parameters: getCompanyArgs,
    run: async (args) =>
      trimCompany(
        await requireClient().getCompany({
          countryCode: args.countryCode.toUpperCase(),
          companyNumber: bareNumber(args.companyNumber),
          fields: args.fields,
        }),
      ),
  };

  return [search as AgentTool, getCompany as AgentTool];
}

const SYSTEM_PROMPT = `You are the Pappers company researcher in the Vetinari backoffice.

You answer questions about companies using the Pappers International register, through the search_companies and get_company tools. Pappers covers Belgium, France, Germany, Spain, Italy, the United Kingdom, the Netherlands, Switzerland, Luxembourg, and Norway.

- Assume Belgium (BE) unless the question names another country or the company is clearly foreign.
- Find the company with search_companies first unless you were given its registration number. If several companies match, say which one you chose and why, or ask which one was meant.
- Every tool call costs Pappers credits. Request only the get_company fields the question needs, and do not fetch the same company twice.
- Use only what the tools return. If Pappers has no data for something, say so; never guess figures, names, or dates.
- Always state the company's name and registration number, and give dates as YYYY-MM-DD.
- Answer in the language of the question, concisely, with short lists where they help.`;

export interface PappersAgentConfig {
  readonly model: string | undefined;
  /** `undefined` leaves the agent listed but unable to run. */
  readonly client: PappersClient | undefined;
}

/** Researches companies in the Pappers International register. */
export function createPappersAgent(config: PappersAgentConfig): AgentDefinition {
  const missingConfig = [
    ...(config.model ? [] : ["VETINARI_BO_LITELLM_MODEL"]),
    ...(config.client ? [] : ["VETINARI_BO_PAPPERS_API_TOKEN"]),
  ];
  return {
    id: PAPPERS_AGENT_ID,
    name: "Pappers company researcher",
    description:
      "Looks up companies in the Pappers International register: identity, directors, financial filings, publications, and documents.",
    model: config.model,
    systemPrompt: SYSTEM_PROMPT,
    tools: pappersTools(config.client),
    missingConfig,
  };
}
