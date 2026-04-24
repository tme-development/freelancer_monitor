import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Application,
  Project,
  MatchingResult,
  ConsultantProfile,
} from '../database/entities';
import { OllamaMcpService } from '../mcp/ollama-mcp.service';

@Injectable()
export class ApplicationService {
  private readonly logger = new Logger(ApplicationService.name);

  constructor(
    private readonly ollama: OllamaMcpService,
    @InjectRepository(Application)
    private readonly appRepo: Repository<Application>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(MatchingResult)
    private readonly matchRepo: Repository<MatchingResult>,
    @InjectRepository(ConsultantProfile)
    private readonly profileRepo: Repository<ConsultantProfile>,
  ) {}

  async generateApplication(
    project: Project,
    matchingResult: MatchingResult,
    options: { replace?: boolean } = {},
  ): Promise<Application> {
    const existing = await this.appRepo.findOneBy({
      project_id: project.id,
    });
    if (existing && !options.replace) return existing;

    const profile = await this.profileRepo.findOne({
      where: { id: matchingResult.profile_id },
      relations: ['skills', 'experiences', 'certifications'],
    });

    const fullMatch = await this.matchRepo.findOne({
      where: { id: matchingResult.id },
      relations: ['requirement_matches', 'requirement_matches.requirement'],
    });

    let isEndcustomer = project.is_endcustomer;
    if (isEndcustomer === null || isEndcustomer === undefined) {
      const classification = await this.ollama.classifyPoster(
        project.company,
        project.description_text || '',
      );
      isEndcustomer = classification.is_endcustomer;
      project.is_endcustomer = isEndcustomer;
      await this.projectRepo.save(project);
    }

    const language = project.detected_language || 'de';

    const summary = await this.ollama.generateSummary(
      project.description_text || '',
      language,
    );
    project.summary = summary;
    await this.projectRepo.save(project);

    const profileJson = JSON.stringify({
      name: profile.name,
      title: profile.title,
      summary: profile.summary,
      languages: profile.languages,
      service_offerings: profile.service_offerings,
      focus_areas: profile.focus_areas,
      skills: profile.skills,
      experiences: profile.experiences,
      certifications: profile.certifications,
    });

    const matchesJson = JSON.stringify(
      fullMatch.requirement_matches.map((rm) => ({
        requirement: rm.requirement?.requirement_text,
        is_must_have: rm.requirement?.is_must_have,
        match_type: rm.match_type,
        profile_evidence: rm.profile_evidence,
        explanation: rm.explanation,
      })),
    );

    const appText = await this.ollama.generateApplication(
      JSON.stringify({
        title: project.title,
        company: project.company,
        description: project.description_text,
        industry: project.industry,
      }),
      matchesJson,
      profileJson,
      isEndcustomer,
      language,
    );

    if (existing) {
      existing.matching_result_id = matchingResult.id;
      existing.motivation_paragraph = appText.motivation_paragraph;
      existing.application_body = appText.application_body;
      existing.full_application_text = appText.full_application_text;
      existing.application_channel = project.application_channel;
      existing.application_instructions = project.application_instructions;
      existing.detected_language = language;
      return this.appRepo.save(existing);
    }

    const application = this.appRepo.create({
      project_id: project.id,
      matching_result_id: matchingResult.id,
      motivation_paragraph: appText.motivation_paragraph,
      application_body: appText.application_body,
      full_application_text: appText.full_application_text,
      application_channel: project.application_channel,
      application_instructions: project.application_instructions,
      detected_language: language,
    });

    return this.appRepo.save(application);
  }
}
