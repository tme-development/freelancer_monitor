import {
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Put,
  Body,
  Query,
  ParseIntPipe,
  Post,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream, existsSync, realpathSync } from 'fs';
import * as path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Project,
  MatchingResult,
  Application,
  ApplicationOutcome,
  Setting,
  ConsultantProfile,
} from '../database/entities';
import { MatchingService } from '../matching/matching.service';
import { ApplicationService } from '../application/application.service';
import { BackendActivityService } from './backend-activity.service';
import { DashboardGateway } from './dashboard.gateway';

@Controller('api')
export class DashboardController {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(MatchingResult)
    private readonly matchRepo: Repository<MatchingResult>,
    @InjectRepository(Application)
    private readonly appRepo: Repository<Application>,
    @InjectRepository(ApplicationOutcome)
    private readonly outcomeRepo: Repository<ApplicationOutcome>,
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
    @InjectRepository(ConsultantProfile)
    private readonly profileRepo: Repository<ConsultantProfile>,
    private readonly matchingService: MatchingService,
    private readonly applicationService: ApplicationService,
    private readonly backendActivity: BackendActivityService,
    private readonly dashboardGateway: DashboardGateway,
  ) {}

  @Get('backend-activity')
  getBackendActivity() {
    return this.backendActivity.getSnapshot();
  }

  @Get('projects')
  async getProjects(
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC',
    @Query('is_endcustomer') isEndcustomer?: string,
    @Query('min_rate') minRate?: string,
    @Query('has_application') hasApplication?: string,
  ) {
    const qb = this.projectRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.matching_results', 'mr')
      .leftJoinAndSelect('p.application', 'app')
      .leftJoinAndSelect('app.outcomes', 'outcome');
    qb.where('p.is_deleted = :isDeleted', { isDeleted: false });

    if (isEndcustomer !== undefined) {
      qb.andWhere('p.is_endcustomer = :isEnd', {
        isEnd: isEndcustomer === 'true',
      });
    }

    if (minRate) {
      qb.andWhere('mr.matching_rate >= :minRate', {
        minRate: parseFloat(minRate),
      });
    }

    if (hasApplication === 'true') {
      qb.andWhere('app.id IS NOT NULL');
    } else if (hasApplication === 'false') {
      qb.andWhere('app.id IS NULL');
    }

    if (sort === 'rate') {
      qb.orderBy('mr.matching_rate', order === 'ASC' ? 'ASC' : 'DESC');
    } else {
      qb.orderBy(
        'COALESCE(p.external_created, p.scraped_at, p.created_at)',
        order === 'ASC' ? 'ASC' : 'DESC',
      );
    }

    const projects = await qb.getMany();
    if (sort !== 'rate') {
      const multiplier = order === 'ASC' ? 1 : -1;
      projects.sort((a, b) => {
        const aTs = this.getNewestSortTimestamp(a);
        const bTs = this.getNewestSortTimestamp(b);
        if (aTs === bTs) return 0;
        return aTs > bTs ? multiplier : -multiplier;
      });
    }
    return projects.map((p) => ({
      // Keep API stable and deterministic by always exposing latest match.
      // One-to-many relation ordering is not guaranteed by TypeORM.
      ...(() => {
        const latestMatch = this.getLatestMatchingResult(p);
        const latestOutcome = this.getLatestApplicationOutcome(p);
        return {
          id: p.id,
          external_id: p.external_id,
          title: p.title,
          company: p.company,
          city: p.city,
          country: p.country,
          remote_percent: p.remote_percent,
          duration_months: p.duration_months,
          start_text: p.start_text,
          is_endcustomer: p.is_endcustomer,
          project_url: p.project_url,
          matching_rate: latestMatch?.matching_rate ?? null,
          has_application: this.hasGeneratedApplication(p),
          application_outcome_status: latestOutcome?.status ?? null,
          summary: p.summary,
          detected_language: p.detected_language,
          external_created: p.external_created,
          scraped_at: p.scraped_at,
          created_at: p.created_at,
        };
      })(),
    }));
  }

  @Get('projects/:id')
  async getProject(@Param('id', ParseIntPipe) id: number) {
    const project = await this.projectRepo.findOne({
      where: { id, is_deleted: false },
      relations: [
        'requirements',
        'matching_results',
        'matching_results.requirement_matches',
        'matching_results.requirement_matches.requirement',
        'application',
        'application.outcomes',
      ],
    });
    if (project?.matching_results?.length) {
      project.matching_results = [...project.matching_results].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }
    if (project?.application?.outcomes?.length) {
      project.application.outcomes = [...project.application.outcomes].sort(
        (a, b) =>
          new Date(b.status_changed_at ?? b.created_at).getTime() -
          new Date(a.status_changed_at ?? a.created_at).getTime(),
      );
    }
    return project;
  }

  @Post('projects/:id/delete')
  async deleteProject(@Param('id', ParseIntPipe) id: number) {
    const project = await this.projectRepo.findOneBy({ id });
    if (!project) return { error: 'Project not found' };
    if (project.is_deleted) return { ok: true, already_deleted: true };

    project.is_deleted = true;
    project.deleted_at = new Date();
    await this.projectRepo.save(project);

    return { ok: true, project_id: id };
  }

  @Get('settings')
  async getSettings() {
    return this.settingRepo.find();
  }

  /**
   * Streams the alert sound from the configured filesystem path (settings + env fallback)
   * so the browser can play it via URL (raw paths like /data/audio/alert.mp3 are not fetchable).
   *
   * Two paths: `settings/alert-audio` sits next to other settings routes in case a proxy
   * blocks `/api/audio/*`; both are identical.
   */
  @Get(['audio/alert', 'settings/alert-audio'])
  @Header('Cache-Control', 'no-store')
  async streamAlertAudio(): Promise<StreamableFile> {
    const audioPath = await this.resolveAlertAudioPath();
    const stream = createReadStream(audioPath);
    return new StreamableFile(stream, {
      type: this.mimeTypeForAudioPath(audioPath),
    });
  }

  @Put('settings/:key')
  async updateSetting(
    @Param('key') key: string,
    @Body() body: { value: string },
  ) {
    let setting = await this.settingRepo.findOneBy({ key_name: key });
    if (setting) {
      setting.value_text = body.value;
      return this.settingRepo.save(setting);
    }
    setting = this.settingRepo.create({
      key_name: key,
      value_text: body.value,
      value_type: 'string',
    });
    return this.settingRepo.save(setting);
  }

  @Post('projects/:id/outcome')
  async addOutcome(
    @Param('id', ParseIntPipe) projectId: number,
    @Body() body: { status: string; notes?: string },
  ) {
    let app = await this.appRepo.findOneBy({ project_id: projectId });
    if (!app) {
      const project = await this.projectRepo.findOne({
        where: { id: projectId, is_deleted: false },
        relations: ['matching_results'],
      });
      if (!project) return { error: 'Project not found' };

      const latestMatch = this.getLatestMatchingResult(project);
      if (!latestMatch) {
        return { error: 'No matching result found for this project' };
      }

      app = await this.appRepo.save(
        this.appRepo.create({
          project_id: project.id,
          matching_result_id: latestMatch.id,
          motivation_paragraph: null,
          application_body: null,
          full_application_text: null,
          application_channel: project.application_channel,
          application_instructions: project.application_instructions,
          detected_language: project.detected_language,
        }),
      );
    }

    const outcome = this.outcomeRepo.create({
      application_id: app.id,
      status: body.status,
      notes: body.notes || null,
      status_changed_at: new Date(),
    });
    const saved = await this.outcomeRepo.save(outcome);
    this.dashboardGateway.sendProjectUpdate({
      project_id: projectId,
      outcome_status: saved.status,
      has_application: true,
    });
    return saved;
  }

  @Post('projects/:projectId/outcome/:outcomeId/delete')
  async deleteOutcome(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('outcomeId', ParseIntPipe) outcomeId: number,
  ) {
    const outcome = await this.outcomeRepo.findOne({
      where: { id: outcomeId },
      relations: ['application'],
    });
    if (!outcome) return { error: 'Outcome not found' };
    if (outcome.application?.project_id !== projectId) {
      return { error: 'Outcome does not belong to this project' };
    }

    await this.outcomeRepo.delete({ id: outcomeId });

    const remainingOutcomes = await this.outcomeRepo.find({
      where: { application_id: outcome.application_id },
    });
    const latestRemaining = [...remainingOutcomes].sort((a, b) => {
      const aTs = new Date(a.status_changed_at ?? a.created_at).getTime();
      const bTs = new Date(b.status_changed_at ?? b.created_at).getTime();
      return bTs - aTs;
    })[0];

    this.dashboardGateway.sendProjectUpdate({
      project_id: projectId,
      outcome_status: latestRemaining?.status ?? null,
    });

    return {
      ok: true,
      outcome_id: outcomeId,
      latest_outcome_status: latestRemaining?.status ?? null,
    };
  }

  @Get('profile')
  async getProfile() {
    return this.profileRepo.findOne({
      where: {},
      relations: ['skills', 'experiences', 'certifications'],
      order: { id: 'ASC' },
    });
  }

  @Post('projects/:id/reanalyze')
  async reanalyzeProject(@Param('id', ParseIntPipe) id: number) {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['application', 'application.outcomes', 'matching_results'],
    });
    if (!project) return { error: 'Project not found' };

    const thresholdApp = await this.getSettingNumber(
      'matching_threshold_application',
      40,
    );

    const shortTitle = (t: string, max = 80) => {
      const s = (t || '').trim();
      return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
    };

    try {
      this.backendActivity.setPhase(
        'matching',
        `Re-analyze: ${shortTitle(project.title)}`,
        project.id,
      );
      const { matchingResult, rate } =
        await this.matchingService.matchProject(project);

      // Keep existing application/outcome data intact; only refresh linkage to latest matching.
      if (project.application) {
        project.application.matching_result_id = matchingResult.id;
        await this.appRepo.save(project.application);
      } else if (rate >= thresholdApp) {
        this.backendActivity.setPhase(
          'application',
          `Creating application: ${shortTitle(project.title)}`,
          project.id,
        );
        await this.applicationService.generateApplication(
          project,
          matchingResult,
        );
      }

      this.dashboardGateway.sendProjectUpdate({
        project_id: project.id,
        external_id: project.external_id,
        title: project.title,
        matching_rate: rate,
      });

      return {
        ok: true,
        project_id: project.id,
        external_id: project.external_id,
        matching_rate: rate,
        matching_result_id: matchingResult.id,
        had_application: !!project.application,
      };
    } catch (err) {
      this.backendActivity.recordError('Re-analyze', err);
      return {
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      this.backendActivity.setIdle();
    }
  }

  @Post('projects/:id/application')
  async createOrReplaceApplication(@Param('id', ParseIntPipe) id: number) {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['application', 'application.outcomes', 'matching_results'],
    });
    if (!project) return { error: 'Project not found' };

    const shortTitle = (t: string, max = 80) => {
      const s = (t || '').trim();
      return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
    };

    const hadApplication = !!project.application;

    try {
      let matchingResult = this.getLatestMatchingResult(project);
      let matchingRate: number | null =
        typeof matchingResult?.matching_rate === 'number'
          ? matchingResult.matching_rate
          : null;

      if (!matchingResult) {
        this.backendActivity.setPhase(
          'matching',
          `Matching for application: ${shortTitle(project.title)}`,
          project.id,
        );
        const result = await this.matchingService.matchProject(project);
        matchingResult = result.matchingResult;
        matchingRate = result.rate;
      }

      this.backendActivity.setPhase(
        'application',
        `${hadApplication ? 'Replacing' : 'Creating'} application: ${shortTitle(project.title)}`,
        project.id,
      );
      const application = await this.applicationService.generateApplication(
        project,
        matchingResult,
        { replace: true },
      );

      this.dashboardGateway.sendProjectUpdate({
        project_id: project.id,
        external_id: project.external_id,
        title: project.title,
        has_application: true,
        matching_rate: matchingRate,
      });

      return {
        ok: true,
        project_id: project.id,
        application_id: application.id,
        had_application: hadApplication,
        matching_rate: matchingRate,
        matching_result_id: matchingResult.id,
      };
    } catch (err) {
      this.backendActivity.recordError('Create application', err);
      return {
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      this.backendActivity.setIdle();
    }
  }

  private getLatestMatchingResult(project: Project): MatchingResult | null {
    if (!project.matching_results?.length) return null;
    return [...project.matching_results].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];
  }

  private getLatestApplicationOutcome(project: Project) {
    const outcomes = project.application?.outcomes;
    if (!outcomes?.length) return null;
    return [...outcomes].sort((a, b) => {
      const aTs = new Date(a.status_changed_at ?? a.created_at).getTime();
      const bTs = new Date(b.status_changed_at ?? b.created_at).getTime();
      return bTs - aTs;
    })[0];
  }

  private hasGeneratedApplication(project: Project): boolean {
    const app = project.application;
    if (!app) return false;
    return !!(
      (app.full_application_text && app.full_application_text.trim()) ||
      (app.application_body && app.application_body.trim()) ||
      (app.motivation_paragraph && app.motivation_paragraph.trim())
    );
  }

  private async getSettingNumber(
    key: string,
    fallback: number,
  ): Promise<number> {
    const s = await this.settingRepo.findOneBy({ key_name: key });
    return s ? parseFloat(s.value_text) : fallback;
  }

  private getNewestSortTimestamp(project: Project): number {
    const raw =
      project.external_created ?? project.scraped_at ?? project.created_at;
    if (!raw) return 0;
    const d = raw instanceof Date ? raw : new Date(raw as unknown as string);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }

  private async resolveAlertAudioPath(): Promise<string> {
    const row = await this.settingRepo.findOneBy({
      key_name: 'alert_audio_file',
    });
    const fromDb = (row?.value_text || '').trim();
    const fallback =
      process.env.ALERT_AUDIO_FILE || '/data/audio/alert.mp3';
    const configured = fromDb || fallback;
    const resolved = path.resolve(configured);

    if (!existsSync(resolved)) {
      throw new NotFoundException(
        `Alert audio file not found: ${resolved}`,
      );
    }

    let realFile: string;
    try {
      realFile = realpathSync(resolved);
    } catch {
      throw new NotFoundException(
        `Alert audio file not found: ${resolved}`,
      );
    }

    if (!this.isAllowedAlertAudioPath(realFile)) {
      throw new BadRequestException(
        'Alert audio path must be under /data or the project data directory',
      );
    }

    return realFile;
  }

  /** Limit reads to shared data mounts (Docker /data or repo ./data). */
  private isAllowedAlertAudioPath(realFile: string): boolean {
    const roots = [
      path.resolve('/data'),
      path.resolve(process.cwd(), 'data'),
      path.resolve(process.cwd(), '..', 'data'),
    ];
    for (const root of roots) {
      let base = root;
      try {
        if (existsSync(root)) {
          base = realpathSync(root);
        }
      } catch {
        continue;
      }
      if (realFile === base || realFile.startsWith(base + path.sep)) {
        return true;
      }
    }
    return false;
  }

  private mimeTypeForAudioPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.wav':
        return 'audio/wav';
      case '.ogg':
        return 'audio/ogg';
      case '.mp3':
      default:
        return 'audio/mpeg';
    }
  }
}
