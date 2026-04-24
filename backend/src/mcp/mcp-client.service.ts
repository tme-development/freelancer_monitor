import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;
const DEFAULT_MCP_TOOL_TIMEOUT_MS = 180000;
const MCP_TOOL_TIMEOUT_OVERRIDES_MS: Record<string, number> = {
  // Browser tools should usually complete quickly; shorter timeout prevents long hangs.
  browser_navigate: 120000,
  browser_evaluate: 120000,
  browser_click: 60000,
  browser_fill: 60000,
  browser_snapshot: 120000,
  // LLM-heavy tools can take longer.
  detect_language: 120000,
  classify_poster: 180000,
  extract_requirements: 240000,
  match_requirements: 300000,
  generate_summary: 180000,
  generate_application: 420000,
};
const TIMEOUT_COOLDOWN_AFTER_FAILURES = 3;
const TIMEOUT_COOLDOWN_MS = 120000;

@Injectable()
export class McpClientService implements OnModuleInit {
  private readonly logger = new Logger(McpClientService.name);
  private playwrightClient: Client | null = null;
  private ollamaClient: Client | null = null;
  private readonly timeoutState = new Map<
    string,
    { consecutive: number; cooldownUntil: number }
  >();

  private playwrightUrl: string;
  private ollamaUrl: string;

  constructor() {
    this.playwrightUrl =
      process.env.PLAYWRIGHT_MCP_URL || 'http://localhost:3200';
    this.ollamaUrl = process.env.OLLAMA_MCP_URL || 'http://localhost:3100';
  }

  async onModuleInit() {
    // Fire-and-forget initial connections — the lazy getters will retry if needed
    this.connectWithRetry('playwright').catch(() => {});
    this.connectWithRetry('ollama').catch(() => {});
  }

  private async connectWithRetry(
    which: 'playwright' | 'ollama',
  ): Promise<Client> {
    const url = which === 'playwright' ? this.playwrightUrl : this.ollamaUrl;
    const label = which === 'playwright' ? 'Playwright' : 'Ollama';

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const client = new Client(
          { name: `backend-${which}`, version: '1.0.0' },
          { capabilities: {} },
        );
        const transport = new SSEClientTransport(new URL(`${url}/sse`));
        await client.connect(transport);
        this.logger.log(
          `Connected to ${label} MCP at ${url} (attempt ${attempt})`,
        );

        if (which === 'playwright') this.playwrightClient = client;
        else this.ollamaClient = client;

        return client;
      } catch (err) {
        this.logger.warn(
          `${label} MCP connection attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`,
        );
        if (attempt < MAX_RETRIES) {
          await this.sleep(RETRY_DELAY_MS);
        }
      }
    }
    throw new Error(
      `Failed to connect to ${label} MCP at ${url} after ${MAX_RETRIES} attempts`,
    );
  }

  async getPlaywrightClient(): Promise<Client> {
    if (this.playwrightClient) return this.playwrightClient;
    return this.connectWithRetry('playwright');
  }

  async getOllamaClient(): Promise<Client> {
    if (this.ollamaClient) return this.ollamaClient;
    return this.connectWithRetry('ollama');
  }

  async callTool(
    clientPromise: Promise<Client> | Client,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<any> {
    const result = await this.callToolWithReconnect(clientPromise, toolName, args);
    if (result.content && Array.isArray(result.content)) {
      const textBlock = result.content.find((c: any) => c.type === 'text');
      if (textBlock) {
        return this.parseMaybeJsonText(textBlock.text);
      }
    }
    return result;
  }

  private parseMaybeJsonText(text: string): unknown {
    const trimmed = text.trim();
    if (!trimmed) return text;

    // Most MCP tool outputs are either plain status text or JSON serialized into text.
    // Avoid using exceptions for normal control flow on plain text responses.
    const firstChar = trimmed[0];
    const looksLikeJson = firstChar === '{' || firstChar === '[';
    if (!looksLikeJson) return text;

    try {
      return JSON.parse(trimmed);
    } catch {
      return text;
    }
  }

  private async callToolWithReconnect(
    clientPromise: Promise<Client> | Client,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<any> {
    const target = this.getTargetForToolName(toolName);
    const startedAt = Date.now();
    this.logger.debug(
      `MCP call start target=${target} tool=${toolName} args=${this.summarizeArgs(args)}`,
    );
    try {
      const client = await clientPromise;
      const result = await this.callToolWithTimeout(client, toolName, args);
      this.logger.debug(
        `MCP call success target=${target} tool=${toolName} elapsed_ms=${Date.now() - startedAt}`,
      );
      return result;
    } catch (err) {
      const elapsed = Date.now() - startedAt;
      this.logger.warn(
        `MCP call failed target=${target} tool=${toolName} elapsed_ms=${elapsed} code=${err?.code || ''} msg=${err?.message || err}`,
      );
      if (!this.isTransientMcpError(err)) {
        throw err;
      }

      this.logger.warn(
        `Transient MCP error for ${toolName}: ${err.message}. Reconnecting ${target} client and retrying once.`,
      );

      if (target === 'playwright') this.playwrightClient = null;
      else this.ollamaClient = null;

      const reconnectedClient =
        target === 'playwright'
          ? await this.getPlaywrightClient()
          : await this.getOllamaClient();

      const retryStartedAt = Date.now();
      const retryResult = await this.callToolWithTimeout(
        reconnectedClient,
        toolName,
        args,
      );
      this.logger.debug(
        `MCP retry success target=${target} tool=${toolName} retry_elapsed_ms=${Date.now() - retryStartedAt}`,
      );
      return retryResult;
    }
  }

  private async callToolWithTimeout(
    client: Client,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<any> {
    this.ensureTimeoutCircuitAllowsCall(toolName);
    const timeoutMs = this.getTimeoutMsForTool(toolName);
    const startedAt = Date.now();
    try {
      const result = await this.withTimeout(
        client.callTool(
          { name: toolName, arguments: args },
          undefined,
          { timeout: timeoutMs },
        ),
        timeoutMs,
        `MCP tool timed out after ${timeoutMs}ms: ${toolName}`,
      );
      this.recordToolSuccess(toolName);
      return result;
    } catch (err) {
      const isTimeout =
        err?.code === 'MCP_TOOL_TIMEOUT' ||
        String(err?.message || '').includes('MCP tool timed out');
      if (isTimeout) {
        this.recordToolTimeout(toolName);
        this.logger.error(
          `MCP timeout tool=${toolName} elapsed_ms=${Date.now() - startedAt} args=${this.summarizeArgs(args)}`,
        );
      }
      throw err;
    }
  }

  private getTargetForToolName(toolName: string): 'playwright' | 'ollama' {
    return toolName.startsWith('browser_') ? 'playwright' : 'ollama';
  }

  private isTransientMcpError(err: any): boolean {
    const message = String(err?.message || '');
    const code = String(err?.code || '');
    return (
      code === 'MCP_TOOL_TIMEOUT' ||
      code === 'UND_ERR_SOCKET' ||
      code === 'ECONNRESET' ||
      code === 'EPIPE' ||
      code === 'ETIMEDOUT' ||
      message.includes('MCP tool timed out') ||
      message.includes('fetch failed') ||
      message.includes('UND_ERR_SOCKET') ||
      message.includes('socket hang up')
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const err = new Error(message) as Error & { code?: string };
        err.code = 'MCP_TOOL_TIMEOUT';
        reject(err);
      }, timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timer) clearTimeout(timer);
    }) as Promise<T>;
  }

  private summarizeArgs(args: Record<string, unknown>): string {
    try {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(args || {})) {
        if (typeof v === 'string') {
          out[k] = v.length > 120 ? `${v.slice(0, 120)}...` : v;
        } else if (Array.isArray(v)) {
          out[k] = `array(len=${v.length})`;
        } else if (v && typeof v === 'object') {
          const keys = Object.keys(v as Record<string, unknown>);
          out[k] = `object(keys=${keys.slice(0, 8).join(',')}${keys.length > 8 ? ',...' : ''})`;
        } else {
          out[k] = v;
        }
      }
      const json = JSON.stringify(out);
      return json.length > 300 ? `${json.slice(0, 300)}...` : json;
    } catch {
      return '[unserializable args]';
    }
  }

  private getTimeoutMsForTool(toolName: string): number {
    return MCP_TOOL_TIMEOUT_OVERRIDES_MS[toolName] ?? DEFAULT_MCP_TOOL_TIMEOUT_MS;
  }

  private ensureTimeoutCircuitAllowsCall(toolName: string): void {
    const state = this.timeoutState.get(toolName);
    if (!state) return;
    if (state.cooldownUntil <= Date.now()) return;

    const remainingMs = state.cooldownUntil - Date.now();
    const err = new Error(
      `MCP timeout cooldown active for ${toolName}; retry in ${remainingMs}ms`,
    ) as Error & { code?: string };
    err.code = 'MCP_TOOL_COOLDOWN';
    throw err;
  }

  private recordToolTimeout(toolName: string): void {
    const current = this.timeoutState.get(toolName) || {
      consecutive: 0,
      cooldownUntil: 0,
    };
    const consecutive = current.consecutive + 1;
    let cooldownUntil = current.cooldownUntil;
    if (consecutive >= TIMEOUT_COOLDOWN_AFTER_FAILURES) {
      cooldownUntil = Date.now() + TIMEOUT_COOLDOWN_MS;
      this.logger.warn(
        `MCP timeout circuit opened tool=${toolName} cooldown_ms=${TIMEOUT_COOLDOWN_MS} consecutive_timeouts=${consecutive}`,
      );
    }
    this.timeoutState.set(toolName, { consecutive, cooldownUntil });
  }

  private recordToolSuccess(toolName: string): void {
    if (!this.timeoutState.has(toolName)) return;
    this.timeoutState.delete(toolName);
  }
}
