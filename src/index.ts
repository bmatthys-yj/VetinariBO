export { createBackofficeApp, API_BASE_PATH } from "./server/backoffice/app.js";
export { createPublicApp } from "./server/public/app.js";
export { readServerConfig, workshopPublicUrl } from "./server/config.js";
export { createDatabase, resolveDatabaseFile, DEFAULT_DATABASE_FILE } from "./db/index.js";
export type { BackofficeDatabase, BackofficeSchema, WorkshopTable } from "./db/index.js";
export { migrateToLatest } from "./db/migrate.js";
export {
  createWorkshop,
  findWorkshopById,
  findWorkshopBySlug,
  listWorkshops,
} from "./db/workshops.js";
export { createEnrollment, deleteEnrollment, listEnrollments } from "./db/enrollments.js";
export { workshopInputSchema } from "./contracts/workshop.js";
export type { Workshop, WorkshopInput, WorkshopSummary } from "./contracts/workshop.js";
export { enrollmentInputSchema, EnrollmentRefusedError } from "./contracts/enrollment.js";
export type { Enrollment, EnrollmentInput } from "./contracts/enrollment.js";
export { agentRunInputSchema } from "./contracts/agent.js";
export type {
  Agent,
  AgentRunInput,
  AgentRunResult,
  AgentToolCall,
  GatewayStatus,
} from "./contracts/agent.js";
export { LiteLlmClient, LiteLlmError, liteLlmApiRoot } from "./llm/liteLlm.js";
export type {
  AssistantMessage,
  ChatMessage,
  LiteLlmConfig,
  ToolCall,
  ToolSpec,
} from "./llm/liteLlm.js";
export { createBuiltInAgents } from "./agents/registry.js";
export { AgentRunError, MAX_AGENT_STEPS, runAgent } from "./agents/runAgent.js";
export type { AgentDefinition, AgentTool } from "./agents/types.js";
export { PappersClient, PappersError } from "./agents/pappers/pappersClient.js";
