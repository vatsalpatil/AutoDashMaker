/** Setup steps per AI app for the Dashtor MCP server. `{url}` = MCP URL with the token inside it, `{base}` = token-less
 *  URL, `{token}` = the access token. Kept as data so adding an app is one entry. */
export interface AiClient {
  id: string;
  name: string;
  steps: string[];
  snippet?: string;
}

export const CLIENTS: AiClient[] = [
  {
    id: 'claude', name: 'Claude (claude.ai / desktop)',
    steps: ['Settings → Connectors → Add custom connector.', 'Name it Dashtor and paste the connector URL below.', 'In a chat, enable the Dashtor connector and ask e.g. "build me a sales dashboard".'],
    snippet: '{url}',
  },
  {
    id: 'chatgpt', name: 'ChatGPT',
    steps: ['Settings → Apps & Connectors → Advanced → turn on Developer mode.', 'Create connector → paste the URL below, authentication: none (the token is in the URL).', 'Start a chat, pick Developer mode and the Dashtor connector.'],
    snippet: '{url}',
  },
  {
    id: 'claude-code', name: 'Claude Code (CLI)',
    steps: ['Run this once in a terminal:'],
    snippet: 'claude mcp add --transport http dashtor {base} --header "Authorization: Bearer {token}"',
  },
  {
    id: 'cursor', name: 'Cursor / VS Code / Windsurf',
    steps: ['Add this to your MCP config (Cursor: ~/.cursor/mcp.json, VS Code: .vscode/mcp.json under "servers").'],
    snippet: '{\n  "mcpServers": {\n    "dashtor": { "url": "{base}", "headers": { "Authorization": "Bearer {token}" } }\n  }\n}',
  },
  {
    id: 'other', name: 'Kimi, DeepSeek, Grok, Gemini & any MCP app',
    steps: ['Any app or agent that supports remote MCP (Streamable HTTP) can use the URL below.',
      'Apps without MCP: use the REST API (OpenAPI at /openapi.json) with the header Authorization: Bearer <token>.'],
    snippet: '{url}',
  },
];

export function fill(text: string, v: { url: string; base: string; token: string }): string {
  return text.replaceAll('{url}', v.url).replaceAll('{base}', v.base).replaceAll('{token}', v.token);
}
