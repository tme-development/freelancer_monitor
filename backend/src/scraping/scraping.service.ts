import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../database/entities';
import { PlaywrightMcpService } from '../mcp/playwright-mcp.service';
import { ProjectParserService } from './project-parser.service';
import {
  SELECTORS,
  listPaginationStateEvaluateScript,
  type ListPaginationState,
} from '../config/scraping-selectors';

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);
  /** Set after successful login; reset on failure so the next run retries. */
  private isLoggedIn = false;

  constructor(
    private readonly playwright: PlaywrightMcpService,
    private readonly parser: ProjectParserService,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}


  async scrapeNewProjects(searchUrl: string): Promise<Project[]> {
    this.logger.log(`Starting scrape from: ${searchUrl}`);
    await this.ensureLoggedIn();
    const projectUrls = await this.extractProjectUrls(searchUrl);
    this.logger.log(`Found ${projectUrls.length} project URLs`);

    const newProjects: Project[] = [];
    for (const url of projectUrls) {
      const slug = this.extractProjectSlugFromUrl(url);
      if (slug) {
        const exists = await this.projectRepo.findOneBy({ slug });
        if (exists) continue;
      }
      try {
        const project = await this.scrapeProjectDetail(url);
        if (project) {
          newProjects.push(project);
        }
      } catch (err) {
        this.logger.error(`Failed to scrape ${url}: ${err?.message || err}`, err?.stack);
      }
    }

    this.logger.log(`Scraped ${newProjects.length} new projects`);
    return newProjects;
  }

  private async extractProjectUrls(searchUrl: string): Promise<string[]> {
    await this.playwright.navigate(searchUrl);
    await this.delay(3000);

    const allUrls: string[] = [];
    const maxPages = this.getMaxListPages();
    let pageIndex = 1;
    let prevFingerprint: string | null = null;
    const paginationScript = listPaginationStateEvaluateScript();

    for (;;) {
      const urls: string[] = await this.withTransientRetry(
        () =>
          this.playwright.evaluate(`
        Array.from(document.querySelectorAll('${SELECTORS.list.projectCard} ${SELECTORS.list.titleLink}'))
          .map(a => a.href)
          .filter(Boolean)
      `),
        'list URL extraction',
      );

      const fingerprint = this.fingerprintListPage(urls);
      if (prevFingerprint !== null && fingerprint === prevFingerprint) {
        this.logger.warn(
          'List pagination: page content unchanged after advancing; stopping to avoid a loop',
        );
        break;
      }
      prevFingerprint = fingerprint;
      allUrls.push(...urls);

      const state = await this.withTransientRetry(
        () => this.playwright.evaluate(paginationScript),
        'pagination state',
      );
      const pagination = this.parseListPaginationState(state);

      this.logger.debug(
        `List page ${pageIndex} (pagenr=${pagination.pagenr}), hasNext=${pagination.hasNext}`,
      );

      if (!pagination.hasNext) {
        break;
      }

      if (maxPages !== null && pageIndex >= maxPages) {
        this.logger.warn(
          `List pagination: FREELANCERMAP_MAX_LIST_PAGES=${maxPages} reached; continuing import with ${allUrls.length} URLs collected so far`,
        );
        break;
      }

      if (!pagination.clickSelector) {
        this.logger.warn(
          'List pagination: hasNext is true but no clickSelector; stopping',
        );
        break;
      }

      await this.withTransientRetry(
        () => this.playwright.click(pagination.clickSelector!),
        'pagination next click',
      );
      pageIndex += 1;
      await this.delay(2000);
    }

    return [...new Set(allUrls)];
  }

  private fingerprintListPage(urls: string[]): string {
    return [...urls].sort().join('|');
  }

  private getMaxListPages(): number | null {
    const raw = process.env.FREELANCERMAP_MAX_LIST_PAGES?.trim();
    if (!raw) return null;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return null;
    return n;
  }

  private parseListPaginationState(raw: unknown): ListPaginationState {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      return {
        hasNext: o.hasNext === true,
        clickSelector:
          typeof o.clickSelector === 'string' ? o.clickSelector : null,
        pagenr: typeof o.pagenr === 'string' ? o.pagenr : '1',
      };
    }
    return { hasNext: false, clickSelector: null, pagenr: '1' };
  }

  /**
   * Ensures the Playwright session is logged into Freelancermap when credentials are set.
   * Re-checks DOM each run; resets {@link isLoggedIn} on failure.
   */
  private async ensureLoggedIn(): Promise<void> {
    const email = process.env.FREELANCERMAP_EMAIL?.trim();
    const password = process.env.FREELANCERMAP_PASSWORD?.trim();
    const baseUrl = process.env.FREELANCERMAP_BASE_URL?.trim();

    if (!email || !password) {
      this.logger.warn(
        'FREELANCERMAP_EMAIL or FREELANCERMAP_PASSWORD not set; skipping Freelancermap login',
      );
      return;
    }

    if (!baseUrl) {
      this.logger.warn('FREELANCERMAP_BASE_URL not set; skipping login');
      return;
    }

    await this.withTransientRetry(
      () => this.playwright.navigate(baseUrl),
      'login navigate to base URL',
    );
    await this.delay(2000);

    const loginButtonVisible = await this.isLoginButtonVisible();

    if (!loginButtonVisible) {
      this.isLoggedIn = true;
      this.logger.log('Freelancermap: already logged in (login button absent)');
      return;
    }

    if (this.isLoggedIn) {
      this.logger.debug(
        'Freelancermap: isLoggedIn flag was true but login button present; re-authenticating',
      );
    }

    try {
      await this.withTransientRetry(
        () => this.playwright.click(SELECTORS.login.loginButton),
        'open login modal',
      );
      await this.delay(1000);

      await this.withTransientRetry(
        () => this.playwright.fill(SELECTORS.login.emailInput, email),
        'fill login email',
      );
      await this.withTransientRetry(
        () => this.playwright.fill(SELECTORS.login.passwordInput, password),
        'fill login password',
      );
      await this.withTransientRetry(
        () => this.playwright.click(SELECTORS.login.submitButton),
        'submit login',
      );

      await this.delay(3000);

      const stillVisible = await this.isLoginButtonVisible();
      if (stillVisible) {
        this.isLoggedIn = false;
        throw new Error(
          'Freelancermap login failed: login button still visible after submit',
        );
      }

      this.isLoggedIn = true;
      this.logger.log('Freelancermap login succeeded');
    } catch (err) {
      this.isLoggedIn = false;
      this.logger.error(
        `Freelancermap login failed: ${err?.message || err}`,
        err?.stack,
      );
      throw err;
    }
  }

  /** True when the header still shows "Anmelden" (logged-out). */
  private async isLoginButtonVisible(): Promise<boolean> {
    const sel = JSON.stringify(SELECTORS.login.loginButton);
    const raw = await this.withTransientRetry(
      () =>
        this.playwright.evaluate(
          `!!document.querySelector(${sel})`,
        ),
      'login button DOM check',
    );
    return raw === true || raw === 'true';
  }

  private async scrapeProjectDetail(url: string): Promise<Project | null> {
    this.logger.debug(`Scraping detail: ${url}`);
    await this.playwright.navigate(url);
    await this.delay(2000);

    const rawPayload = await this.playwright.evaluate(`
      (() => {
        const el = document.querySelector('${SELECTORS.detail.projectShowScript}');
        return el ? el.textContent : null;
      })()
    `);

    if (rawPayload.isHidden) {
      this.logger.warn(`project ${url} is hidden`);
      return null;
    }

    const json = this.parseProjectShowPayload(rawPayload);
    if (!json) {
      this.logger.warn(`No or invalid ProjectShow JSON at ${url}`);
      return null;
    }

    const data = this.parser.parseDetailJson(json);

    const existing = await this.projectRepo.findOneBy({
      external_id: data.external_id,
    });
    if (existing) return null;

    if (!this.passesPublishDateGate(data, json, url)) {
      return null;
    }

    const project = this.projectRepo.create(data);
    return this.projectRepo.save(project);
  }

  /**
   * Rejects projects whose `external_created` is older than
   * {@link getMaxProjectAgeDays} days (or missing entirely). Freelancermap's
   * `created=1` URL filter is unreliable: re-listed / bumped projects with
   * an unchanged original `created` timestamp keep appearing in the
   * “last 1 day” search. This client-side gate enforces the contract and
   * dumps the full raw JSON of any rejected project so the misbehavior can
   * be diagnosed later.
   */
  private passesPublishDateGate(
    data: Partial<Project>,
    rawJson: Record<string, unknown>,
    url: string,
  ): boolean {
    const maxAgeDays = this.getMaxProjectAgeDays();
    const publishedAt = data.external_created ?? null;

    if (publishedAt === null) {
      this.logRejectedProject(
        'missing external_created',
        data,
        rawJson,
        url,
        null,
        maxAgeDays,
      );
      return false;
    }

    const ageMs = Date.now() - publishedAt.getTime();
    const ageDays = ageMs / 86_400_000;

    // Tolerate clock skew / timezone drift: a few hours "in the future"
    // should not flag an otherwise fresh listing.
    if (ageDays < -1) {
      this.logRejectedProject(
        'external_created is implausibly in the future',
        data,
        rawJson,
        url,
        ageDays,
        maxAgeDays,
      );
      return false;
    }

    if (ageDays > maxAgeDays) {
      this.logRejectedProject(
        'external_created older than max age window',
        data,
        rawJson,
        url,
        ageDays,
        maxAgeDays,
      );
      return false;
    }

    return true;
  }

  private logRejectedProject(
    reason: string,
    data: Partial<Project>,
    rawJson: Record<string, unknown>,
    url: string,
    ageDays: number | null,
    maxAgeDays: number,
  ): void {
    const externalId = data.external_id ?? 'unknown';
    const title = data.title ?? '';
    const publishedIso =
      data.external_created instanceof Date
        ? data.external_created.toISOString()
        : 'null';
    const ageDisplay = ageDays === null ? 'n/a' : ageDays.toFixed(2);

    this.logger.warn(
      `Rejected import (${reason}): external_id=${externalId} ageDays=${ageDisplay} maxAgeDays=${maxAgeDays} external_created=${publishedIso} title=${JSON.stringify(title)} url=${url}`,
    );

    let rawJsonString: string;
    try {
      rawJsonString = JSON.stringify(rawJson);
    } catch {
      rawJsonString = '<unserializable>';
    }
    this.logger.warn(
      `Rejected import raw JSON (external_id=${externalId}): ${rawJsonString}`,
    );
  }

  /** Maximum allowed age of `external_created` (days) before a project is rejected. */
  private getMaxProjectAgeDays(): number {
    const raw = process.env.FREELANCERMAP_MAX_PROJECT_AGE_DAYS?.trim();
    if (!raw) return 2;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 2;
    return n;
  }

  /**
   * Script tag text is strict JSON. MCP may already return a parsed object when the payload starts with "{".
   */
  private parseProjectShowPayload(raw: unknown): Record<string, unknown> | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Slug segment from `/projekt/<slug>` (stable id in URLs without trailing numeric id). */
  private extractProjectSlugFromUrl(url: string): string | null {
    try {
      const path = new URL(url).pathname.replace(/\/+$/, '');
      const m = path.match(/\/projekt\/([^/]+)$/);
      if (!m) return null;
      const slug = decodeURIComponent(m[1]);
      return slug || null;
    } catch {
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async withTransientRetry<T>(
    operation: () => Promise<T>,
    context: string,
  ): Promise<T> {
    try {
      return await operation();
    } catch (err) {
      if (!this.isTransientTransportError(err)) {
        this.logger.error(
          `Non-transient error during ${context}: ${err?.message || err}`,
          err?.stack,
        );
        throw err;
      }

      this.logger.warn(
        `Transient transport error during ${context}. Retrying once: ${err.message}`,
      );
      await this.delay(750);
      try {
        return await operation();
      } catch (retryErr) {
        this.logger.error(
          `Retry failed during ${context}: ${retryErr?.message || retryErr}`,
          retryErr?.stack,
        );
        throw retryErr;
      }
    }
  }

  private isTransientTransportError(err: any): boolean {
    const message = String(err?.message || '');
    const code = String(err?.code || '');
    return (
      code === 'UND_ERR_SOCKET' ||
      code === 'ECONNRESET' ||
      code === 'EPIPE' ||
      code === 'ETIMEDOUT' ||
      message.includes('fetch failed') ||
      message.includes('UND_ERR_SOCKET') ||
      message.includes('socket hang up')
    );
  }
}
