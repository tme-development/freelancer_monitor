import { Module, Global } from '@nestjs/common';
import { McpClientService } from './mcp-client.service';
import { PlaywrightMcpService } from './playwright-mcp.service';
import { OllamaMcpService } from './ollama-mcp.service';

@Global()
@Module({
  providers: [McpClientService, PlaywrightMcpService, OllamaMcpService],
  exports: [PlaywrightMcpService, OllamaMcpService],
})
export class McpModule {}
