export type Provider = 'openai' | 'anthropic' | 'google' | 'local_a' | 'local_b';
export interface AgentTask {
  familyId: string;
  version: 'V0' | 'V1' | 'V2' | 'V3';
  workspace: string; // repositorio aislado, no raíz del corpus
  prompt: string;
  attempt: 1 | 2 | 3;
  maxCycles: 25;
  timeoutSeconds: 1800 | 3600;
}
export interface AgentResult {
  status: 'DELIVERED' | 'TECHNICAL_FAILURE' | 'TIMEOUT' | 'INFRA_ERROR';
  cycles: number;
  developmentLogsPath: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}
export interface CodingAgent {
  readonly provider: Provider;
  readonly exactModel: string;
  run(task: AgentTask): Promise<AgentResult>;
}
// Sin implementaciones de proveedor: este commit no autoriza generación.
