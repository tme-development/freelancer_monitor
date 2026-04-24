import { Injectable, Logger } from '@nestjs/common';
import { McpClientService } from './mcp-client.service';

export interface ExtractedRequirement {
  text: string;
  category: string;
  is_must_have: boolean;
}

export interface RequirementMatchResult {
  requirement_text: string;
  match_type: 'direct' | 'alternative' | 'none';
  profile_evidence: string;
  explanation: string;
  match_score: number;
}

export interface ClassificationResult {
  is_endcustomer: boolean;
  reasoning: string;
}

export interface ApplicationText {
  motivation_paragraph: string | null;
  application_body: string;
  full_application_text: string;
}

@Injectable()
export class OllamaMcpService {
  private readonly logger = new Logger(OllamaMcpService.name);

  constructor(private readonly mcpClient: McpClientService) {}

  private call(toolName: string, args: Record<string, unknown>): Promise<any> {
    return this.mcpClient.callTool(
      this.mcpClient.getOllamaClient(),
      toolName,
      args,
    );
  }

  async extractRequirements(
    descriptionText: string,
  ): Promise<ExtractedRequirement[]> {
    return this.call('extract_requirements', {
      description: descriptionText,
    });
  }

  async matchRequirements(
    requirements: ExtractedRequirement[],
    profileJson: string,
  ): Promise<RequirementMatchResult[]> {
    return this.call('match_requirements', {
      requirements: JSON.stringify(requirements),
      profile: profileJson,
    });
  }

  async classifyPoster(
    company: string,
    descriptionText: string,
  ): Promise<ClassificationResult> {
    return this.call('classify_poster', {
      company,
      description: descriptionText,
    });
  }

  async generateApplication(
    projectJson: string,
    matchesJson: string,
    profileJson: string,
    isEndcustomer: boolean,
    language: string,
  ): Promise<ApplicationText> {
    return this.call('generate_application', {
      project: projectJson,
      matches: matchesJson,
      profile: profileJson,
      is_endcustomer: isEndcustomer,
      language,
    });
  }

  async generateSummary(
    descriptionText: string,
    language: string,
  ): Promise<string> {
    const result = await this.call('generate_summary', {
      description: descriptionText,
      language,
    });
    return typeof result === 'string' ? result : result.summary;
  }

  async detectLanguage(text: string): Promise<string> {
    const result = await this.call('detect_language', { text });
    return typeof result === 'string' ? result : result.language;
  }
}
