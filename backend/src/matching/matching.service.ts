import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Project,
  ProjectRequirement,
  MatchingResult,
  RequirementMatch,
  ConsultantProfile,
  Setting,
} from '../database/entities';
import { OllamaMcpService } from '../mcp/ollama-mcp.service';
import { MatchingCalculator, WeightConfig } from './matching-calculator';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);
  private static readonly TRUTHY_SETTING_VALUES = new Set(['1', 'true', 'yes']);

  constructor(
    private readonly ollama: OllamaMcpService,
    private readonly calculator: MatchingCalculator,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectRequirement)
    private readonly reqRepo: Repository<ProjectRequirement>,
    @InjectRepository(MatchingResult)
    private readonly matchResultRepo: Repository<MatchingResult>,
    @InjectRepository(RequirementMatch)
    private readonly reqMatchRepo: Repository<RequirementMatch>,
    @InjectRepository(ConsultantProfile)
    private readonly profileRepo: Repository<ConsultantProfile>,
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
  ) {}

  async matchProject(
    project: Project,
  ): Promise<{ matchingResult: MatchingResult; rate: number }> {
    if (await this.isMatchingPaused()) {
      this.logger.log(
        `Matching paused by settings; skipping project ${project.external_id}`,
      );
      throw new Error('Matching is currently paused in settings');
    }

    const profile = await this.profileRepo.findOne({
      where: {},
      relations: ['skills', 'experiences', 'certifications'],
      order: { id: 'ASC' },
    });
    if (!profile) throw new Error('No consultant profile found');

    const descriptionText =
      project.description_text || this.stripHtml(project.description_html || '');

    if (!project.detected_language) {
      const rawLanguage = await this.ollama.detectLanguage(
        descriptionText.slice(0, 500),
      );
      const language = this.normalizeLanguageCode(rawLanguage);
      if (!language) {
        this.logger.warn(
          `Language detection returned an unsupported value for project ${project.external_id}: "${String(rawLanguage)}"`,
        );
      }
      project.detected_language = language;
      await this.projectRepo.save(project);
    }   

    const extractedReqs = await this.ollama.extractRequirements(
      descriptionText,
    );
    let normalizedReqs = this.normalizeExtractedRequirements(
      extractedReqs,
      project.external_id,
    );
    this.logger.log(
      `Extracted ${normalizedReqs.length} requirements for project ${project.external_id}`,
    );
    if (normalizedReqs.length === 0) {
      const fallbackText = this.buildFallbackRequirementText(descriptionText);
      normalizedReqs = [
        {
          text: fallbackText,
          category: 'general',
          is_must_have: false,
        },
      ];
      this.logger.warn(
        `No valid requirements extracted for project ${project.external_id}; using fallback requirement`,
      );
    }

    const savedReqs: ProjectRequirement[] = [];
    for (let i = 0; i < normalizedReqs.length; i++) {
      const r = normalizedReqs[i];
      const req = this.reqRepo.create({
        project_id: project.id,
        requirement_text: r.text,
        category: r.category,
        is_must_have: r.is_must_have,
        sort_order: i,
      });
      savedReqs.push(await this.reqRepo.save(req));
    }

    const profileJson = JSON.stringify({
      name: profile.name,
      title: profile.title,
      summary: profile.summary,
      languages: profile.languages,
      service_offerings: profile.service_offerings,
      focus_areas: profile.focus_areas,
      skills: profile.skills.map((s) => ({
        category: s.category,
        name: s.name,
        proficiency_level: s.proficiency_level,
      })),
      experiences: profile.experiences.map((e) => ({
        project_title: e.project_title,
        company: e.company,
        role: e.role,
        start_date: e.start_date,
        end_date: e.end_date,
        technologies: e.technologies,
        domains: e.domains,
        description: e.description,
      })),
      certifications: profile.certifications.map((c) => ({
        name: c.name,
        issuer: c.issuer,
        year: c.year,
      })),
    });

    const matchResults = await this.ollama.matchRequirements(
      normalizedReqs,
      profileJson,
    );

    const weights = await this.getWeights();

    const matchInputs = savedReqs.map((req, i) => {
      const mr = matchResults[i] || {
        match_type: 'none' as const,
        profile_evidence: '',
        explanation: '',
        match_score: 0,
      };
      return {
        match_type: mr.match_type,
        is_must_have: req.is_must_have,
        profile_evidence: mr.profile_evidence,
        explanation: mr.explanation,
        match_score: mr.match_score,
        requirement_id: req.id,
      };
    });

    const rate = this.calculator.calculate(
      matchInputs.map((m) => ({
        match_type: m.match_type,
        is_must_have: m.is_must_have,
      })),
      weights,
    );

    const matchingResult = await this.matchResultRepo.save(
      this.matchResultRepo.create({
        project_id: project.id,
        profile_id: profile.id,
        matching_rate: rate,
        algorithm_version: 'v1',
        weight_config: weights,
      }),
    );

    for (const m of matchInputs) {
      await this.reqMatchRepo.save(
        this.reqMatchRepo.create({
          matching_result_id: matchingResult.id,
          requirement_id: m.requirement_id,
          match_type: m.match_type,
          profile_evidence: m.profile_evidence,
          explanation: m.explanation,
          match_score: m.match_score,
        }),
      );
    }

    return { matchingResult, rate };
  }

  private async getWeights(): Promise<WeightConfig> {
    const defaults = this.calculator.getDefaultWeights();
    const keys = [
      'weight_direct',
      'weight_alternative',
      'weight_must_have',
      'weight_nice_to_have',
    ] as const;
    const result: any = { ...defaults };

    for (const key of keys) {
      const setting = await this.settingRepo.findOneBy({ key_name: key });
      if (setting) {
        result[key] = parseFloat(setting.value_text);
      }
    }
    return result;
  }

  private async isMatchingPaused(): Promise<boolean> {
    const setting = await this.settingRepo.findOneBy({
      key_name: 'matching_paused',
    });
    const value = (setting?.value_text ?? '').trim().toLowerCase();
    return MatchingService.TRUTHY_SETTING_VALUES.has(value);
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Normalizes model output to short ISO-like language codes suitable for DB storage.
   * Keeps known 2-letter codes and maps common language names; returns null if unknown.
   */
  private normalizeLanguageCode(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const value = raw.trim().toLowerCase();
    if (!value) return null;

    const map: Record<string, string> = {
      de: 'de',
      deu: 'de',
      deu_de: 'de',
      german: 'de',
      deutsch: 'de',
      en: 'en',
      eng: 'en',
      english: 'en',
      fr: 'fr',
      fra: 'fr',
      french: 'fr',
      francais: 'fr',
      français: 'fr',
      es: 'es',
      spa: 'es',
      spanish: 'es',
      espanol: 'es',
      español: 'es',
      it: 'it',
      ita: 'it',
      italian: 'it',
      nl: 'nl',
      dutch: 'nl',
      nld: 'nl',
      pl: 'pl',
      polish: 'pl',
      pol: 'pl',
      pt: 'pt',
      por: 'pt',
      portuguese: 'pt',
      tr: 'tr',
      turkish: 'tr',
      tur: 'tr',
    };

    if (map[value]) return map[value];
    if (/^[a-z]{2}$/.test(value)) return value;

    const firstWord = value.split(/[\s,.;:()/-]+/).filter(Boolean)[0];
    if (firstWord && map[firstWord]) return map[firstWord];
    if (firstWord && /^[a-z]{2}$/.test(firstWord)) return firstWord;
    return null;
  }

  private normalizeExtractedRequirements(
    raw: unknown,
    externalId: number,
  ): Array<{ text: string; category: string; is_must_have: boolean }> {
    if (!Array.isArray(raw)) {
      this.logger.warn(
        `extract_requirements returned non-array for project ${externalId}: ${typeof raw}`,
      );
      return [];
    }

    const normalized: Array<{
      text: string;
      category: string;
      is_must_have: boolean;
    }> = [];

    raw.forEach((item, idx) => {
      const obj =
        item && typeof item === 'object' && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : null;
      if (!obj) {
        this.logger.warn(
          `Skipping invalid requirement #${idx} for project ${externalId}: not an object`,
        );
        return;
      }

      const textCandidate =
        obj.text ?? obj.requirement_text ?? obj.requirement ?? obj.name;
      const text =
        typeof textCandidate === 'string' ? textCandidate.trim() : '';
      if (!text) {
        this.logger.warn(
          `Skipping invalid requirement #${idx} for project ${externalId}: missing text`,
        );
        return;
      }

      const categoryCandidate = obj.category ?? obj.type ?? 'general';
      const category =
        typeof categoryCandidate === 'string' && categoryCandidate.trim()
          ? categoryCandidate.trim().slice(0, 100)
          : 'general';

      const mustHaveRaw = obj.is_must_have ?? obj.must_have ?? obj.mustHave;
      const is_must_have =
        typeof mustHaveRaw === 'boolean'
          ? mustHaveRaw
          : String(mustHaveRaw).toLowerCase() === 'true';

      normalized.push({ text, category, is_must_have });
    });

    return normalized;
  }

  private buildFallbackRequirementText(descriptionText: string): string {
    const compact = descriptionText.replace(/\s+/g, ' ').trim();
    if (!compact) {
      return 'Projektanforderungen konnten nicht strukturiert extrahiert werden.';
    }
    return compact.slice(0, 3000);
  }
}
