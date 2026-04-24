import { ref } from 'vue';
import { io, type Socket } from 'socket.io-client';
import { useProjectsStore, type ProjectUpdatePayload } from './stores/projects';

const API = import.meta.env.VITE_API_URL || '';

export interface AlertPayload {
  type: string;
  project_id: number;
  external_id: number;
  title: string;
  matching_rate: number;
  project_url: string;
}

export type BackendActivityPhase =
  | 'idle'
  | 'scraping'
  | 'matching'
  | 'application';

export interface BackendActivitySnapshot {
  phase: BackendActivityPhase;
  detail: string | null;
  current_project_id: number | null;
  next_scrape_run_at: string | null;
  errors: { at: string; message: string }[];
}

const ALERTED_STORAGE_KEY = 'highMatchAlertedProjectIds';

function loadPersistedAlertedIds(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ALERTED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0);
  } catch {
    return [];
  }
}

function persistAlertedIds(ids: number[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ALERTED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota / serialization errors */
  }
}

/**
 * IDs of projects that triggered the high-match alarm and have NOT yet been
 * opened in the detail view. Persisted to localStorage so the green frame
 * survives page reloads.
 */
export const alertedProjectIds = ref<number[]>(loadPersistedAlertedIds());

/**
 * Incremented each time a new high-match alert arrives on the socket.
 * Consumed by the audio player to trigger playback without re-rendering a
 * popup toast.
 */
export const alertSoundPing = ref(0);

export const backendActivity = ref<BackendActivitySnapshot>({
  phase: 'idle',
  detail: null,
  current_project_id: null,
  next_scrape_run_at: null,
  errors: [],
});

function markProjectAlerted(projectId: number): void {
  if (!Number.isFinite(projectId) || projectId <= 0) return;
  if (!alertedProjectIds.value.includes(projectId)) {
    alertedProjectIds.value = [...alertedProjectIds.value, projectId];
    persistAlertedIds(alertedProjectIds.value);
  }
}

/**
 * Remove the green-frame marker for a project. Call this when the user opens
 * the project's detail view.
 */
export function clearProjectAlert(projectId: number): void {
  if (!alertedProjectIds.value.includes(projectId)) return;
  alertedProjectIds.value = alertedProjectIds.value.filter(
    (id) => id !== projectId,
  );
  persistAlertedIds(alertedProjectIds.value);
}

export function isProjectAlerted(projectId: number): boolean {
  return alertedProjectIds.value.includes(projectId);
}

let sharedSocket: Socket | null = null;

/** Single Socket.IO connection for alerts, activity, and project updates. */
export function connectRealtime(): Socket {
  if (sharedSocket?.connected) {
    return sharedSocket;
  }
  if (!sharedSocket) {
    sharedSocket = io(API || window.location.origin);
    sharedSocket.on('alert', (payload: AlertPayload) => {
      if (payload?.project_id) {
        markProjectAlerted(payload.project_id);
      }
      alertSoundPing.value += 1;
    });
    sharedSocket.on('backend_activity', (payload: BackendActivitySnapshot) => {
      backendActivity.value = payload;
    });
    sharedSocket.on('project_update', (payload: ProjectUpdatePayload) => {
      const store = useProjectsStore();
      if (payload?.project_id) {
        store.applyProjectUpdate(payload);
        store.markProjectsStale(payload.project_id);
      } else {
        store.markProjectsStale();
      }
    });
  }
  return sharedSocket;
}
