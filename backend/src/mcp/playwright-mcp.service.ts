import { Injectable, Logger } from '@nestjs/common';
import { McpClientService } from './mcp-client.service';

@Injectable()
export class PlaywrightMcpService {
  private readonly logger = new Logger(PlaywrightMcpService.name);

  constructor(private readonly mcpClient: McpClientService) {}

  async navigate(url: string): Promise<void> {
    await this.mcpClient.callTool(
      this.mcpClient.getPlaywrightClient(),
      'browser_navigate',
      { url },
    );
  }

  async evaluate(script: string): Promise<any> {
    return this.mcpClient.callTool(
      this.mcpClient.getPlaywrightClient(),
      'browser_evaluate',
      { script },
    );
  }

  async snapshot(): Promise<string> {
    return this.mcpClient.callTool(
      this.mcpClient.getPlaywrightClient(),
      'browser_snapshot',
      {},
    );
  }

  async click(selector: string): Promise<void> {
    await this.mcpClient.callTool(
      this.mcpClient.getPlaywrightClient(),
      'browser_click',
      { element: selector },
    );
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.mcpClient.callTool(
      this.mcpClient.getPlaywrightClient(),
      'browser_fill',
      { selector, value },
    );
  }

  async getPageContent(): Promise<string> {
    return this.evaluate('document.documentElement.outerHTML');
  }
}
