/** A workshop served by the backoffice API. */
export interface Workshop {
  id: string;
  name: string;
  /** ISO calendar date (`YYYY-MM-DD`). */
  date: string;
  maxApplicants: number;
  subject: string;
  /** Optional external page, such as a marketing or landing page. */
  url?: string;
  locationName: string;
  locationAddress: string;
  /** Path segment the hosted enrollment form is served under. */
  slug: string;
  /** Address of the hosted enrollment form, derived by the server. */
  publicUrl: string;
  enrollmentCount: number;
  seatsRemaining: number;
  createdAt: string;
  updatedAt: string;
}

/** The fields required to create a workshop. */
export type WorkshopInput = Omit<
  Workshop,
  "id" | "slug" | "publicUrl" | "enrollmentCount" | "seatsRemaining" | "createdAt" | "updatedAt"
>;

/** One person signed up for a workshop through the hosted form. */
export interface Enrollment {
  id: string;
  workshopId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  consentedAt: string;
  createdAt: string;
}

/** A built-in agent. Agents are defined in the server code, so this is read-only. */
export interface Agent {
  id: string;
  name: string;
  description: string;
  /** LiteLLM model deployment name, or `null` when none is configured. */
  model: string | null;
  /** Instructions sent as the system message on every run. */
  systemPrompt: string;
  tools: Array<{ name: string; description: string }>;
  /** `false` while any of `missingConfig` is unset. */
  ready: boolean;
  /** Environment variables the agent still needs. */
  missingConfig: string[];
}

/** A tool the agent called during a run, and why it failed if it did. */
export interface AgentToolCall {
  name: string;
  arguments: unknown;
  error?: string;
}

/** An agent's reply to one prompt. */
export interface AgentRunResult {
  agentId: string;
  model: string;
  output: string;
  toolCalls: AgentToolCall[];
}

/** Whether the backoffice can reach the LiteLLM gateway, and what it serves. */
export interface GatewayStatus {
  configured: boolean;
  reachable: boolean;
  baseUrl: string;
  models: string[];
  error?: string;
}
