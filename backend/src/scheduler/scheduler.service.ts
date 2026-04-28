import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project, Setting } from '../database/entities';
import { ScrapingService } from '../scraping/scraping.service';
import { MatchingService } from '../matching/matching.service';
import { ApplicationService } from '../application/application.service';
import { DashboardGateway } from '../dashboard/dashboard.gateway';
import { BackendActivityService } from '../dashboard/backend-activity.service';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private static readonly TRUTHY_SETTING_VALUES = new Set(['1', 'true', 'yes']);
  private static readonly HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private intervalMs = 30 * 60 * 1000;
  private isRunning = false;

  constructor(
    private readonly scraping: ScrapingService,
    private readonly matching: MatchingService,
    private readonly application: ApplicationService,
    private readonly gateway: DashboardGateway,
    private readonly activity: BackendActivityService,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
  ) {}

  async onModuleInit() {
    await this.schedulePolling();
  }

  async schedulePolling() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }

    const intervalMinutes = await this.getSettingNumber(
      'polling_interval_minutes',
      30,
    );
    const ms = intervalMinutes * 60 * 1000;
    this.intervalMs = ms;

    this.logger.log(`Scheduling polling every ${intervalMinutes} minutes`);

    // Run once on startup after a short delay to let services initialize
    const startupDelayMs = 10_000;
    void this.refreshNextScrapeRunEstimate(new Date(Date.now() + startupDelayMs));
    setTimeout(() => {
      void this.runPipeline();
    }, startupDelayMs);

    this.intervalHandle = setInterval(() => {
      void this.runPipeline();
    }, ms);
  }

  async runPipeline() {
    if (this.isRunning) {
      this.logger.warn('Pipeline already running, skipping');
      return;
    }

    this.isRunning = true;
    const startedAt = Date.now();
    this.logger.log('Pipeline started');

    try {
      const searchUrl = await this.getSettingString(
        'freelancermap_search_url',
        process.env.FREELANCERMAP_SEARCH_URL || '',
      );
      if (!searchUrl) {
        this.logger.warn('No search URL configured');
        return;
      }

      let newProjects: Project[] = [];
      if (await this.isScrapingPaused()) {
        this.logger.log(
          'Scraping paused (settings); skipping new project import — backlog matching still runs',
        );
      } else if (!(await this.isWithinScrapingWindow(new Date()))) {
        this.logger.log(
          'Outside configured scraping time window; skipping new project import — backlog matching still runs',
        );
      } else {
        this.activity.setPhase(
          'scraping',
          'Importing listings from Freelancermap',
        );
        try {
          newProjects = await this.scraping.scrapeNewProjects(searchUrl);
        } catch (err) {
          this.logger.error(
            `Scraping failed: ${err?.message || err}`,
            err?.stack,
          );
          this.activity.recordError('Scraping', err);
        }
      }

      const thresholdApp = await this.getSettingNumber(
        'matching_threshold_application',
        40,
      );
      const thresholdVeryHigh = await this.getSettingNumber(
        'matching_threshold_very_high',
        85,
      );
      const matchingPaused = await this.isMatchingPaused();
      if (matchingPaused) {
        this.logger.log(
          'Matching paused (settings); skipping matching/application processing for this run',
        );
      }

      for (const project of newProjects) {
        if (matchingPaused) break;
        await this.processProject(project, thresholdApp, thresholdVeryHigh);
      }

      if (!matchingPaused) {
        const backlogLimit = await this.getBacklogLimit();
        const backlog = await this.loadUnmatchedProjects(backlogLimit);
        if (backlog.length > 0) {
          this.logger.log(
            `Processing backlog: ${backlog.length} projects without matching results`,
          );
        }
        for (const project of backlog) {
          await this.processProject(project, thresholdApp, thresholdVeryHigh);
        }
      }

      this.logger.log('Pipeline completed');
    } catch (err) {
      this.logger.error(`Pipeline failed: ${err?.message || err}`, err?.stack);
      this.activity.recordError('Pipeline', err);
    } finally {
      const elapsedMs = Date.now() - startedAt;
      this.logger.log(
        `Pipeline finished (success or failure). Duration: ${elapsedMs}ms`,
      );
      this.activity.setIdle();
      this.isRunning = false;
      this.logger.debug(`Pipeline lock released (isRunning=${this.isRunning})`);
      await this.refreshNextScrapeRunEstimate();
    }
  }

  private async getSettingString(
    key: string,
    fallback: string,
  ): Promise<string> {
    const s = await this.settingRepo.findOneBy({ key_name: key });
    return s?.value_text || fallback;
  }

  private async getSettingNumber(
    key: string,
    fallback: number,
  ): Promise<number> {
    const s = await this.settingRepo.findOneBy({ key_name: key });
    return s ? parseFloat(s.value_text) : fallback;
  }

  /** Next listing-import attempt shown in dashboard; respects window when enabled. */
  private async refreshNextScrapeRunEstimate(firstScheduledRunAt?: Date) {
    const baseFrom =
      firstScheduledRunAt ?? new Date(Date.now() + this.intervalMs);
    const at =
      await this.computeNextEligibleListingImportTimeAfter(baseFrom);
    this.activity.setNextScrapeRun(at);
  }

  private async computeNextEligibleListingImportTimeAfter(
    firstCandidateTick: Date,
  ): Promise<Date> {
    if (await this.isScrapingPaused()) {
      return firstCandidateTick;
    }
    if (!(await this.isScrapingWindowEnabled())) {
      return firstCandidateTick;
    }
    let t = firstCandidateTick;
    for (let i = 0; i < 10_000; i++) {
      if (await this.isWithinScrapingWindow(t)) return t;
      t = new Date(t.getTime() + this.intervalMs);
    }
    return firstCandidateTick;
  }

  private async isScrapingWindowEnabled(): Promise<boolean> {
    const s = await this.settingRepo.findOneBy({
      key_name: 'scraping_window_enabled',
    });
    const v = (s?.value_text ?? '').trim().toLowerCase();
    return SchedulerService.TRUTHY_SETTING_VALUES.has(v);
  }

  /** Uses server local timezone; `start===end` means whole day when window is enabled. */
  private async isWithinScrapingWindow(when: Date): Promise<boolean> {
    if (!(await this.isScrapingWindowEnabled())) return true;

    const startS = await this.getSettingString(
      'scraping_window_start_time',
      '08:00',
    );
    const endS = await this.getSettingString(
      'scraping_window_end_time',
      '16:00',
    );
    const start = SchedulerService.parseHHmmMinutes(startS);
    const end = SchedulerService.parseHHmmMinutes(endS);
    if (start === null || end === null) return true;

    const minuteOfDay = when.getHours() * 60 + when.getMinutes();
    return SchedulerService.isMinuteWithinWindow(minuteOfDay, start, end);
  }

  private static parseHHmmMinutes(raw: string): number | null {
    const m = SchedulerService.HHMM.exec((raw ?? '').trim());
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  private static isMinuteWithinWindow(
    minuteOfDay: number,
    start: number,
    end: number,
  ): boolean {
    if (start === end) return true;
    if (start < end) {
      return minuteOfDay >= start && minuteOfDay < end;
    }
    return minuteOfDay >= start || minuteOfDay < end;
  }

  /** When true, list scraping is skipped so no new projects are imported. */
  private async isScrapingPaused(): Promise<boolean> {
    const s = await this.settingRepo.findOneBy({ key_name: 'scraping_paused' });
    const v = (s?.value_text ?? '').trim().toLowerCase();
    return SchedulerService.TRUTHY_SETTING_VALUES.has(v);
  }

  /** When true, matching + application generation are paused. */
  private async isMatchingPaused(): Promise<boolean> {
    const s = await this.settingRepo.findOneBy({ key_name: 'matching_paused' });
    const v = (s?.value_text ?? '').trim().toLowerCase();
    return SchedulerService.TRUTHY_SETTING_VALUES.has(v);
  }

  private async getBacklogLimit(): Promise<number> {
    const envFallback = parseInt(process.env.MATCHING_BACKLOG_BATCH_SIZE || '', 10);
    const fallback =
      Number.isFinite(envFallback) && envFallback > 0 ? envFallback : 25;
    const configured = await this.getSettingNumber(
      'matching_backlog_batch_size',
      fallback,
    );
    return Number.isFinite(configured) && configured > 0
      ? Math.floor(configured)
      : fallback;
  }

  private async loadUnmatchedProjects(limit: number): Promise<Project[]> {
    return this.projectRepo
      .createQueryBuilder('project')
      .leftJoin('project.matching_results', 'mr')
      .where('mr.id IS NULL')
      .orderBy('project.scraped_at', 'DESC')
      .take(limit)
      .getMany();
  }

  private shortDetail(title: string, max = 80): string {
    const t = (title || '').trim();
    return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
  }

  private async processProject(
    project: Project,
    thresholdApp: number,
    thresholdVeryHigh: number,
  ): Promise<void> {
    try {
      this.activity.setPhase(
        'matching',
        `Analyzing: ${this.shortDetail(project.title)}`,
        project.id,
      );
      const { matchingResult, rate } = await this.matching.matchProject(project);

      this.logger.log(
        `Project ${project.external_id} "${project.title}" => ${rate}%`,
      );

      if (rate >= thresholdApp) {
        this.activity.setPhase(
          'application',
          `Creating application: ${this.shortDetail(project.title)}`,
          project.id,
        );
        await this.application.generateApplication(project, matchingResult);
        this.logger.log(`Generated application for project ${project.external_id}`);
      }

      if (rate >= thresholdVeryHigh) {
        this.gateway.sendAlert({
          type: 'high_match',
          project_id: project.id,
          external_id: project.external_id,
          title: project.title,
          matching_rate: rate,
          project_url: project.project_url,
        });
      }

      this.gateway.sendProjectUpdate({
        project_id: project.id,
        external_id: project.external_id,
        title: project.title,
        matching_rate: rate,
      });
    } catch (err) {
      this.logger.error(
        `Failed processing project ${project.external_id}: ${err?.message || err}`,
        err?.stack,
      );
      this.activity.recordError(
        `Matching / application (project ${project.external_id})`,
        err,
      );
    }
  }
}
