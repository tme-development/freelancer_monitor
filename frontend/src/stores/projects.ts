import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const API = import.meta.env.VITE_API_URL || '';

export interface ProjectSummary {
  id: number;
  external_id: number;
  title: string;
  company: string;
  city: string;
  country: string;
  remote_percent: number;
  duration_months: number;
  start_text: string;
  is_endcustomer: boolean | null;
  project_url: string;
  matching_rate: number | null;
  has_application: boolean;
  application_outcome_status: string | null;
  summary: string | null;
  detected_language: string | null;
  external_created?: string | null;
  scraped_at?: string | null;
  created_at: string;
}

interface QueryListState {
  ids: number[];
  fetchedAt: number;
  stale: boolean;
}

export interface ProjectUpdatePayload {
  project_id?: number;
  matching_rate?: number | null;
  outcome_status?: string | null;
  has_application?: boolean;
  [key: string]: unknown;
}

export const useProjectsStore = defineStore('projects', () => {
  const projectsById = ref<Record<number, ProjectSummary>>({});
  const listsByQueryKey = ref<Record<string, QueryListState>>({});
  const activeQueryKey = ref('all');
  const loadingCounter = ref(0);
  const lastProjectUpdateAt = ref(0);
  const inFlightByQueryKey = new Map<string, Promise<ProjectSummary[]>>();

  const projects = computed<ProjectSummary[]>(() => {
    const list = listsByQueryKey.value[activeQueryKey.value];
    if (!list?.ids?.length) return [];
    return list.ids
      .map((id) => projectsById.value[id])
      .filter((p): p is ProjectSummary => !!p);
  });

  const loading = computed(() => loadingCounter.value > 0);

  function queryKeyFromParams(params?: Record<string, string>): string {
    if (!params || Object.keys(params).length === 0) return 'all';
    const sorted = Object.entries(params).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return sorted
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
  }

  function setActiveQuery(params?: Record<string, string>) {
    activeQueryKey.value = queryKeyFromParams(params);
  }

  function upsertProjects(rows: ProjectSummary[]) {
    const next = { ...projectsById.value };
    for (const row of rows) {
      const existing = next[row.id];
      next[row.id] = existing ? { ...existing, ...row } : row;
    }
    projectsById.value = next;
  }

  function upsertList(queryKey: string, rows: ProjectSummary[]) {
    upsertProjects(rows);
    listsByQueryKey.value = {
      ...listsByQueryKey.value,
      [queryKey]: {
        ids: rows.map((p) => p.id),
        fetchedAt: Date.now(),
        stale: false,
      },
    };
  }

  function patchProject(projectId: number, patch: Partial<ProjectSummary>) {
    const current = projectsById.value[projectId];
    if (!current) return;
    projectsById.value = {
      ...projectsById.value,
      [projectId]: { ...current, ...patch },
    };
  }

  function removeProject(projectId: number) {
    const nextProjects = { ...projectsById.value };
    delete nextProjects[projectId];
    projectsById.value = nextProjects;

    const nextLists: Record<string, QueryListState> = {};
    for (const [key, list] of Object.entries(listsByQueryKey.value)) {
      nextLists[key] = {
        ...list,
        ids: list.ids.filter((id) => id !== projectId),
      };
    }
    listsByQueryKey.value = nextLists;
  }

  async function fetchProjects(params?: Record<string, string>) {
    const queryKey = queryKeyFromParams(params);
    activeQueryKey.value = queryKey;

    const existing = inFlightByQueryKey.get(queryKey);
    if (existing) {
      await existing;
      return projects.value;
    }

    loadingCounter.value += 1;
    const run = (async () => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      const res = await fetch(`${API}/api/projects${qs}`);
      const rows = (await res.json()) as ProjectSummary[];
      upsertList(queryKey, rows);
      return rows;
    })();

    inFlightByQueryKey.set(queryKey, run);
    try {
      await run;
      return projects.value;
    } finally {
      inFlightByQueryKey.delete(queryKey);
      loadingCounter.value = Math.max(0, loadingCounter.value - 1);
    }
  }

  async function fetchProject(id: number) {
    const res = await fetch(`${API}/api/projects/${id}`);
    return res.json();
  }

  async function addOutcome(
    projectId: number,
    status: string,
    notes?: string,
  ) {
    const res = await fetch(`${API}/api/projects/${projectId}/outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes }),
    });
    return res.json();
  }

  async function deleteOutcome(projectId: number, outcomeId: number) {
    const res = await fetch(
      `${API}/api/projects/${projectId}/outcome/${outcomeId}/delete`,
      {
        method: 'POST',
      },
    );
    return res.json();
  }

  async function reanalyzeProject(projectId: number) {
    const res = await fetch(`${API}/api/projects/${projectId}/reanalyze`, {
      method: 'POST',
    });
    return res.json();
  }

  async function createApplication(projectId: number) {
    const res = await fetch(`${API}/api/projects/${projectId}/application`, {
      method: 'POST',
    });
    return res.json();
  }

  async function deleteProject(projectId: number) {
    const res = await fetch(`${API}/api/projects/${projectId}/delete`, {
      method: 'POST',
    });
    const result = await res.json();
    if (result?.ok) {
      removeProject(projectId);
    }
    return result;
  }

  function applyProjectUpdate(update: ProjectUpdatePayload) {
    const projectId = Number(update.project_id);
    if (!Number.isFinite(projectId) || projectId <= 0) return;

    const patch: Partial<ProjectSummary> = {};
    if ('matching_rate' in update) {
      patch.matching_rate = (update.matching_rate as number | null) ?? null;
    }
    if ('outcome_status' in update) {
      patch.application_outcome_status =
        (update.outcome_status as string | null) ?? null;
    }
    if ('has_application' in update) {
      patch.has_application = !!update.has_application;
    }
    if (Object.keys(patch).length > 0) {
      patchProject(projectId, patch);
    }
  }

  function markProjectsStale(projectId?: number) {
    if (projectId) {
      const current = projectsById.value[projectId];
      if (!current) return;
      patchProject(projectId, { ...current });
      return;
    }
    lastProjectUpdateAt.value = Date.now();
    const next: Record<string, QueryListState> = {};
    for (const [key, list] of Object.entries(listsByQueryKey.value)) {
      next[key] = { ...list, stale: true };
    }
    listsByQueryKey.value = next;
  }

  function shouldBackgroundRefresh(maxAgeMs: number): boolean {
    const list = listsByQueryKey.value[activeQueryKey.value];
    if (!list) return true;
    if (list.stale) return true;
    return Date.now() - list.fetchedAt > maxAgeMs;
  }

  return {
    projects,
    projectsById,
    listsByQueryKey,
    activeQueryKey,
    loading,
    lastProjectUpdateAt,
    fetchProjects,
    setActiveQuery,
    fetchProject,
    addOutcome,
    deleteOutcome,
    reanalyzeProject,
    createApplication,
    deleteProject,
    upsertProjects,
    patchProject,
    removeProject,
    applyProjectUpdate,
    markProjectsStale,
    shouldBackgroundRefresh,
  };
});
