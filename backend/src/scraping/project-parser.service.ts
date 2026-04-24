import { Injectable, Logger } from '@nestjs/common';
import { Project } from '../database/entities';

/**
 * Parses the raw ProjectShow JSON blob from Freelancermap detail pages
 * into our Project entity shape.
 */
@Injectable()
export class ProjectParserService {
  private readonly logger = new Logger(ProjectParserService.name);

  parseDetailJson(json: any): Partial<Project> {
    const project = json.project || json;

    const descriptionHtml: string = project.description || '';
    const descriptionText = this.stripHtml(descriptionHtml);

    const locations = (project.locations || [])
      .map((l: any) => l.localizedName || l.nameDe || l.nameEn)
      .filter(Boolean);

    const startText = this.buildStartText(
      project.startYear,
      project.startMonth,
      project.startText,
    );

    const skills = (project.skills?.enabled || []).map((s: any) => ({
      name: s.localizedName || s.nameDe || s.nameEn,
      codeId: s.codeId,
    }));

    const applicationChannel = this.detectApplicationChannel(descriptionText);
    const externalCreated =
      this.parseExternalCreatedAt(project) ??
      this.parseFreelancermapPublishedAt(project);

    return {
      external_id: project.id,
      title: project.title,
      slug: project.slug,
      company: this.buildCompanyName(project),
      description_html: descriptionHtml,
      description_text: descriptionText,
      city: locations.join(', ') || project.city || null,
      country:
        project.country?.localizedName ||
        project.country?.nameDe ||
        null,
      remote_percent: project.contractType?.remoteInPercent ?? null,
      contract_type: project.contractType?.contractType || null,
      duration_months: project.durationInMonths || null,
      extension_possible: project.extensionPossible || false,
      workload: project.workload || null,
      start_text: startText,
      budget: this.normalizeBudget(project.budget),
      industry:
        project.industry?.localizedName ||
        project.industry?.nameDe ||
        null,
      skills_json: skills,
      project_url: `https://www.freelancermap.de/projekt/${project.slug}`,
      is_endcustomer: project.isEndcustomerProject ?? null,
      application_channel: applicationChannel.channel,
      application_instructions: applicationChannel.instructions,
      raw_json: JSON.stringify(json),
      external_created: externalCreated,
      scraped_at: new Date(),
    };
  }

  /**
   * Secondary source for `external_created` when `created` / creation fields are absent.
   */
  private parseFreelancermapPublishedAt(project: Record<string, unknown>): Date | null {
    const candidates = [
      project.publishedAt,
      project.publicationDate,
      project.publication_date,
      project.firstPublishedAt,
      project.onlineSince,
      project.online_since,
      project.published,
      project.published_on,
      project.datePublished,
      project.postedAt,
      project.listedAt,
      project.liveAt,
    ];
    for (const raw of candidates) {
      const d = this.coerceFreelancermapDate(raw);
      if (d) return d;
    }
    return null;
  }

  /** Primary source for `external_created` from ProjectShow JSON. */
  private parseExternalCreatedAt(project: Record<string, unknown>): Date | null {
    const candidates = [project.created, project.creationDate, project.creation_date];
    for (const raw of candidates) {
      const d = this.coerceFreelancermapDate(raw);
      if (d) return d;
    }
    return null;
  }

  private coerceFreelancermapDate(raw: unknown): Date | null {
    if (raw === null || raw === undefined) return null;
    if (raw instanceof Date) {
      return Number.isNaN(raw.getTime()) ? null : raw;
    }
    if (typeof raw === 'number') {
      const ms = raw < 1e12 ? raw * 1000 : raw;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const d = new Date(trimmed);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      return this.coerceFreelancermapDate(
        o.date ?? o.iso8601 ?? o.iso ?? o.timestamp ?? o.time,
      );
    }
    return null;
  }

  private buildCompanyName(project: any): string {
    if (project.company) return project.company;
    const parts = [project.firstName, project.lastName].filter(Boolean);
    return parts.join(' ') || 'Unknown';
  }

  private buildStartText(
    year?: number,
    month?: number,
    text?: string,
  ): string {
    if (text) return text;
    if (year && month) return `${month}/${year}`;
    if (year) return `${year}`;
    return 'ab sofort';
  }

  private detectApplicationChannel(text: string): {
    channel: string;
    instructions: string;
  } {
    const emailMatch = text.match(
      /[a-zA-Z0-9._%+\-]+(?:%add%|@|\[at\])[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/i,
    );
    if (emailMatch) {
      const email = emailMatch[0]
        .replace('%add%', '@')
        .replace('[at]', '@');
      return {
        channel: 'email',
        instructions: `Bewerbung per E-Mail an ${email}`,
      };
    }

    const externalLink = text.match(/https?:\/\/[^\s"<>]+bewerbung[^\s"<>]*/i);
    if (externalLink) {
      return {
        channel: 'external',
        instructions: `Bewerbung über externen Link: ${externalLink[0]}`,
      };
    }

    return {
      channel: 'freelancermap',
      instructions: 'Bewerbung über das interne Freelancermap-Nachrichtensystem',
    };
  }

  /**
   * DB column `budget` is DECIMAL. Freelancermap may return number, string, or object.
   * Normalize to number or null to avoid MySQL "Incorrect decimal value: [object Object]".
   */
  private normalizeBudget(raw: unknown): number | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') {
      return Number.isFinite(raw) ? raw : null;
    }
    if (typeof raw === 'string') {
      const cleaned = raw.replace(',', '.').replace(/[^\d.\-]/g, '');
      if (!cleaned) return null;
      const parsed = Number.parseFloat(cleaned);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const candidates = [
        obj.value,
        obj.amount,
        obj.max,
        obj.min,
        obj.hourlyRate,
        obj.dailyRate,
        obj.rate,
      ];
      for (const candidate of candidates) {
        const parsed = this.normalizeBudget(candidate);
        if (parsed !== null) return parsed;
      }
      this.logger.debug(
        `Budget payload object could not be normalized, storing null: ${JSON.stringify(raw)}`,
      );
    }
    return null;
  }

  stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<hr[^>]*>/gi, '\n---\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
