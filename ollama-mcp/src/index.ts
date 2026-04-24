import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import { z } from 'zod';

import { extractRequirements } from './tools/extract-requirements';
import { matchRequirements } from './tools/match-requirements';
import { classifyPoster } from './tools/classify-poster';
import { generateApplication } from './tools/generate-application';
import { generateSummary } from './tools/generate-summary';
import { detectLanguage } from './tools/detect-language';

const PORT = parseInt(process.env.MCP_PORT || '3100', 10);
let requestCounter = 0;

function nextRequestId(): string {
  requestCounter += 1;
  return `ollama-mcp-${Date.now()}-${requestCounter}`;
}

function short(value: unknown, max = 160): string {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

async function withToolLogging<TArgs extends Record<string, unknown>, TResult>(
  toolName: string,
  args: TArgs,
  run: () => Promise<TResult>,
): Promise<TResult> {
  const id = nextRequestId();
  const started = Date.now();
  console.log(
    `[${toolName}] start id=${id} args=${short(args)}`,
  );
  try {
    const result = await run();
    console.log(
      `[${toolName}] success id=${id} elapsed_ms=${Date.now() - started}`,
    );
    return result;
  } catch (err: any) {
    console.error(
      `[${toolName}] error id=${id} elapsed_ms=${Date.now() - started} msg=${err?.message || err}`,
    );
    throw err;
  }
}

function createServer(): McpServer {
  const server = new McpServer({
    name: 'ollama-mcp',
    version: '1.0.0',
  });

  server.tool(
    'extract_requirements',
    { description: z.string() },
    async ({ description }) => {
      const result = await withToolLogging(
        'extract_requirements',
        { description_preview: description.slice(0, 120), description_length: description.length },
        () => extractRequirements(description),
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'match_requirements',
    { requirements: z.string(), profile: z.string() },
    async ({ requirements, profile }) => {
      const result = await withToolLogging(
        'match_requirements',
        {
          requirements_length: requirements.length,
          profile_length: profile.length,
        },
        () => matchRequirements(requirements, profile),
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'classify_poster',
    { company: z.string(), description: z.string() },
    async ({ company, description }) => {
      const result = await withToolLogging(
        'classify_poster',
        {
          company,
          description_preview: description.slice(0, 120),
          description_length: description.length,
        },
        () => classifyPoster(company, description),
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'generate_application',
    {
      project: z.string(),
      matches: z.string(),
      profile: z.string(),
      is_endcustomer: z.boolean(),
      language: z.string(),
    },
    async ({ project, matches, profile, is_endcustomer, language }) => {
      const result = await withToolLogging(
        'generate_application',
        {
          project_length: project.length,
          matches_length: matches.length,
          profile_length: profile.length,
          is_endcustomer,
          language,
        },
        () =>
          generateApplication(
            project,
            matches,
            profile,
            is_endcustomer,
            language,
          ),
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'generate_summary',
    { description: z.string(), language: z.string() },
    async ({ description, language }) => {
      const result = await withToolLogging(
        'generate_summary',
        {
          language,
          description_preview: description.slice(0, 120),
          description_length: description.length,
        },
        () => generateSummary(description, language),
      );
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ summary: result }) }],
      };
    },
  );

  server.tool(
    'detect_language',
    { text: z.string() },
    async ({ text }) => {
      const result = await withToolLogging(
        'detect_language',
        { text_preview: text.slice(0, 120), text_length: text.length },
        () => detectLanguage(text),
      );
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ language: result }) }],
      };
    },
  );

  return server;
}

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

const sessions: Record<
  string,
  { transport: SSEServerTransport; server: McpServer }
> = {};

app.get('/sse', async (req, res) => {
  try {
    console.log(`[sse] connect from=${req.ip}`);
    const transport = new SSEServerTransport('/messages', res);
    const server = createServer();
    sessions[transport.sessionId] = { transport, server };
    res.on('close', () => {
      console.log(`[sse] closed sessionId=${transport.sessionId}`);
      delete sessions[transport.sessionId];
    });
    console.log(`[sse] opened sessionId=${transport.sessionId}`);
    await server.connect(transport);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).send('Failed to establish SSE session');
    }
    console.error('Failed to connect MCP SSE session:', err);
  }
});

app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const session = sessions[sessionId];
  const transport = session?.transport;
  if (transport) {
    const started = Date.now();
    try {
      await transport.handlePostMessage(req, res, req.body);
      console.log(
        `[messages] sessionId=${sessionId} ok elapsed_ms=${Date.now() - started}`,
      );
    } catch (err: any) {
      console.error(
        `[messages] sessionId=${sessionId} failed elapsed_ms=${Date.now() - started} msg=${err?.message || err}`,
      );
      throw err;
    }
  } else {
    console.warn(`[messages] session not found sessionId=${sessionId}`);
    res.status(404).send('Session not found');
  }
});

app.listen(PORT, () => {
  console.log(`Ollama MCP server running on port ${PORT}`);
});
