const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { chromium } = require('playwright');
const express = require('express');
const { z } = require('zod');

const PORT = parseInt(process.env.MCP_PORT || '3200', 10);
let requestCounter = 0;

let browser = null;
let page = null;

async function ensureBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    page = await context.newPage();
  }
  return page;
}

function nextRequestId() {
  requestCounter += 1;
  return `playwright-mcp-${Date.now()}-${requestCounter}`;
}

function short(value, max = 160) {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

async function withToolLogging(toolName, args, run) {
  const id = nextRequestId();
  const started = Date.now();
  console.log(`[${toolName}] start id=${id} args=${short(args)}`);
  try {
    const result = await run();
    console.log(
      `[${toolName}] success id=${id} elapsed_ms=${Date.now() - started}`,
    );
    return result;
  } catch (err) {
    console.error(
      `[${toolName}] error id=${id} elapsed_ms=${Date.now() - started} msg=${err?.message || err}`,
    );
    throw err;
  }
}

function createServer() {
  const server = new McpServer({
    name: 'playwright-mcp',
    version: '1.0.0',
  });

  server.tool('browser_navigate', { url: z.string() }, async ({ url }) => {
    return withToolLogging('browser_navigate', { url }, async () => {
      const p = await ensureBrowser();
      await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      return { content: [{ type: 'text', text: `Navigated to ${url}` }] };
    });
  });

  server.tool('browser_evaluate', { script: z.string() }, async ({ script }) => {
    return withToolLogging(
      'browser_evaluate',
      { script_preview: short(script, 120), script_length: script.length },
      async () => {
        const p = await ensureBrowser();
        const result = await p.evaluate(script);
        const text = typeof result === 'string' ? result : JSON.stringify(result);
        return { content: [{ type: 'text', text }] };
      },
    );
  });

  server.tool('browser_click', { element: z.string() }, async ({ element }) => {
    return withToolLogging('browser_click', { element }, async () => {
      const p = await ensureBrowser();
      await p.click(element);
      await p.waitForLoadState('networkidle').catch(() => {});
      return { content: [{ type: 'text', text: `Clicked ${element}` }] };
    });
  });

  server.tool(
    'browser_fill',
    { selector: z.string(), value: z.string() },
    async ({ selector, value }) => {
      return withToolLogging(
        'browser_fill',
        { selector, value_preview: short(value, 60), value_length: value.length },
        async () => {
          const p = await ensureBrowser();
          await p.waitForSelector(selector, { state: 'visible', timeout: 15000 });
          await p.fill(selector, value);
          return { content: [{ type: 'text', text: `Filled ${selector}` }] };
        },
      );
    },
  );

  server.tool('browser_snapshot', {}, async () => {
    return withToolLogging('browser_snapshot', {}, async () => {
      const p = await ensureBrowser();
      const content = await p.content();
      return { content: [{ type: 'text', text: content }] };
    });
  });

  return server;
}

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

const sessions = {};

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
  const sessionId = req.query.sessionId;
  const session = sessions[sessionId];
  const transport = session?.transport;
  if (transport) {
    const started = Date.now();
    try {
      await transport.handlePostMessage(req, res, req.body);
      console.log(
        `[messages] sessionId=${sessionId} ok elapsed_ms=${Date.now() - started}`,
      );
    } catch (err) {
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
  console.log(`Playwright MCP server running on port ${PORT}`);
});
