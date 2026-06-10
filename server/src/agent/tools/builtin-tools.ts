import { ToolHandler, bashEscape } from './tool.types';

export const bashTool: ToolHandler = {
  definition: {
    name: 'bash',
    description: 'Execute a bash command in the sandbox. Use for file operations, installing packages, running scripts, or any command-line tool.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The bash command to execute' },
      },
      required: ['command'],
    },
  },
  toCommand(input: Record<string, unknown>): string {
    const command = String(input.command || '');
    return command;
  },
};

export const pythonTool: ToolHandler = {
  definition: {
    name: 'python',
    description: 'Execute Python 3 code in the sandbox. Use for data analysis, calculations, text processing, or any Python logic.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Python 3 code to execute' },
      },
      required: ['code'],
    },
  },
  toCommand(input: Record<string, unknown>): string {
    const code = String(input.code || 'print("no code provided")');
    // Use heredoc to safely pass arbitrary Python code
    const escaped = bashEscape(code);
    return `python3 -c '${escaped}'`;
  },
};

export const readFileTool: ToolHandler = {
  definition: {
    name: 'read_file',
    description: 'Read the contents of a file in the sandbox workspace. Use to inspect files created by other tools or scripts.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file relative to /workspace' },
      },
      required: ['path'],
    },
  },
  toCommand(input: Record<string, unknown>, workspaceDir: string): string {
    const filePath = String(input.path || '');
    // Sanitize: prevent path traversal
    const safe = filePath.replace(/\.\./g, '').replace(/^\/+/, '');
    const fullPath = `${workspaceDir}/${safe}`;
    return `cat '${bashEscape(fullPath)}' 2>&1`;
  },
};

export const writeFileTool: ToolHandler = {
  definition: {
    name: 'write_file',
    description: 'Write content to a file in the sandbox workspace. Use to save code, data, or output for later use.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file relative to /workspace' },
        content: { type: 'string', description: 'Content to write to the file' },
      },
      required: ['path', 'content'],
    },
  },
  toCommand(input: Record<string, unknown>, workspaceDir: string): string {
    const filePath = String(input.path || '');
    const content = String(input.content || '');
    const safe = filePath.replace(/\.\./g, '').replace(/^\/+/, '');
    const fullPath = `${workspaceDir}/${safe}`;
    // Ensure parent directory exists, then write
    const escapedContent = bashEscape(content);
    return `mkdir -p '${bashEscape(fullPath.replace(/\/[^/]+$/, ''))}' 2>/dev/null; cat > '${bashEscape(fullPath)}' << 'LLMTEST_EOF'\n${content}\nLLMTEST_EOF`;
  },
};

export const webRequestTool: ToolHandler = {
  definition: {
    name: 'web_request',
    description: 'Make an HTTP request from the sandbox. Use to fetch data from APIs, web pages, or any HTTP endpoint.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to request' },
        method: { type: 'string', description: 'HTTP method (GET, POST, etc.)', default: 'GET' },
        headers: { type: 'string', description: 'Optional JSON object of headers' },
        body: { type: 'string', description: 'Optional request body (for POST/PUT)' },
      },
      required: ['url'],
    },
  },
  toCommand(input: Record<string, unknown>): string {
    const url = String(input.url || '');
    const method = String(input.method || 'GET').toUpperCase();
    const headers = input.headers ? String(input.headers) : '';
    const body = input.body ? String(input.body) : '';

    let cmd = `curl -sSL -X '${bashEscape(method)}'`;
    if (headers) {
      try {
        const h = JSON.parse(headers);
        for (const [k, v] of Object.entries(h)) {
          cmd += ` -H '${bashEscape(k)}: ${bashEscape(String(v))}'`;
        }
      } catch {
        // not valid JSON, skip
      }
    }
    if (body) {
      cmd += ` -d '${bashEscape(body)}'`;
    }
    cmd += ` '${bashEscape(url)}'`;
    // Also show response headers for debugging
    cmd += ` -D - 2>&1`;
    return cmd;
  },
};
