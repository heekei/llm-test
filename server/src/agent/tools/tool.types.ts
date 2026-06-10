import { ToolDefinition } from '../../llm/adapters/adapter.interface';

export interface ToolHandler {
  definition: ToolDefinition;
  /**
   * Convert a tool call input into a bash command that can be executed
   * inside the Docker container via `bash -c`.
   */
  toCommand(input: Record<string, unknown>, workspaceDir: string): string;
}

/** Escape a string for safe use inside a bash single-quoted string */
export function bashEscape(s: string): string {
  return s.replace(/'/g, "'\\''");
}
