import { Injectable, Logger } from '@nestjs/common';
import { ToolDefinition } from '../../llm/adapters/adapter.interface';
import { ToolHandler } from './tool.types';
import { bashTool, pythonTool, readFileTool, writeFileTool, webRequestTool } from './builtin-tools';

@Injectable()
export class ToolRegistryService {
  private readonly builtins = new Map<string, ToolHandler>();

  constructor() {
    this.registerBuiltin(bashTool);
    this.registerBuiltin(pythonTool);
    this.registerBuiltin(readFileTool);
    this.registerBuiltin(writeFileTool);
    this.registerBuiltin(webRequestTool);
    Logger.log(`ToolRegistry: ${this.builtins.size} built-in tools registered`);
  }

  private registerBuiltin(handler: ToolHandler): void {
    this.builtins.set(handler.definition.name, handler);
  }

  /**
   * Get tool definitions for a list of tool IDs.
   * If ids is empty or null, return all built-in defaults.
   */
  getDefinitions(ids?: string[] | null): ToolDefinition[] {
    if (!ids || ids.length === 0) {
      return this.getDefaults();
    }
    const defs: ToolDefinition[] = [];
    for (const id of ids) {
      const handler = this.builtins.get(id);
      if (handler) {
        defs.push(handler.definition);
      }
    }
    return defs;
  }

  getDefaults(): ToolDefinition[] {
    return Array.from(this.builtins.values()).map(h => h.definition);
  }

  /**
   * Get a tool handler by name for command execution.
   */
  getHandler(name: string): ToolHandler {
    const handler = this.builtins.get(name);
    if (!handler) {
      throw new Error(`Unknown tool: ${name}. Available: ${Array.from(this.builtins.keys()).join(', ')}`);
    }
    return handler;
  }

  getBuiltinNames(): string[] {
    return Array.from(this.builtins.keys());
  }
}
