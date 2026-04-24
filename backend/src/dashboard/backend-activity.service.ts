import { Injectable } from '@nestjs/common';
import { DashboardGateway } from './dashboard.gateway';

export type BackendActivityPhase =
  | 'idle'
  | 'scraping'
  | 'matching'
  | 'application';

export interface BackendActivityError {
  at: string;
  message: string;
}

export interface BackendActivitySnapshot {
  phase: BackendActivityPhase;
  detail: string | null;
  current_project_id: number | null;
  next_scrape_run_at: string | null;
  errors: BackendActivityError[];
}

@Injectable()
export class BackendActivityService {
  private phase: BackendActivityPhase = 'idle';
  private detail: string | null = null;
  private currentProjectId: number | null = null;
  private nextScrapeRunAt: string | null = null;
  private readonly errors: BackendActivityError[] = [];
  private readonly maxErrors = 10;

  constructor(private readonly gateway: DashboardGateway) {}

  getSnapshot(): BackendActivitySnapshot {
    return {
      phase: this.phase,
      detail: this.detail,
      current_project_id: this.currentProjectId,
      next_scrape_run_at: this.nextScrapeRunAt,
      errors: [...this.errors],
    };
  }

  setPhase(
    phase: BackendActivityPhase,
    detail?: string | null,
    currentProjectId?: number | null,
  ) {
    this.phase = phase;
    this.detail = detail ?? null;
    this.currentProjectId = currentProjectId ?? null;
    this.emit();
  }

  setIdle() {
    this.phase = 'idle';
    this.detail = null;
    this.currentProjectId = null;
    this.emit();
  }

  setNextScrapeRun(at: Date | null) {
    this.nextScrapeRunAt = at ? at.toISOString() : null;
    this.emit();
  }

  recordError(context: string, err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : String(err);
    const message = msg ? `${context}: ${msg}` : context;
    this.errors.unshift({
      at: new Date().toISOString(),
      message,
    });
    while (this.errors.length > this.maxErrors) {
      this.errors.pop();
    }
    this.emit();
  }

  private emit() {
    this.gateway.emitBackendActivity(this.getSnapshot());
  }
}
