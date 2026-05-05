<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Projects</h1>
        <p class="text-xs text-gray-500 mt-1">
          Next scraping run:
          <span class="font-medium text-gray-700">{{ nextScrapeRunText }}</span>
        </p>
      </div>
      <div class="flex gap-2">
        <input
          v-model="filters.q"
          type="text"
          placeholder="Search title, id, slug, company, industry"
          @keydown.enter.prevent="applyFilters"
          @change="applyFilters"
          class="text-sm border rounded px-2 py-1 w-72"
        />
        <select
          v-model="filters.sort"
          @change="applyFilters"
          class="text-sm border rounded px-2 py-1"
        >
          <option value="date">Newest first</option>
          <option value="rate">Highest match</option>
        </select>
        <select
          v-model="filters.is_endcustomer"
          @change="applyFilters"
          class="text-sm border rounded px-2 py-1"
        >
          <option value="">All types</option>
          <option value="true">End customers</option>
          <option value="false">Brokers</option>
        </select>
        <select
          v-model="filters.has_application"
          @change="applyFilters"
          class="text-sm border rounded px-2 py-1"
        >
          <option value="">All</option>
          <option value="true">With application</option>
          <option value="false">Without application</option>
        </select>
        <input
          v-model="filters.min_rate"
          type="number"
          placeholder="Min rate %"
          min="0"
          max="100"
          @change="applyFilters"
          class="text-sm border rounded px-2 py-1 w-24"
        />
      </div>
    </div>
    <div class="mb-3 h-5">
      <span v-if="store.loading" class="text-xs text-gray-400">Refreshing…</span>
    </div>
    <div class="space-y-2">
      <div v-if="store.projects.length" class="bg-white border rounded-lg p-3">
        <div class="flex items-center justify-between gap-3">
          <button
            type="button"
            class="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded"
            @click="toggleSelectAll()"
          >
            {{ allSelected ? 'Unselect all' : 'Select all' }}
          </button>
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">{{ selectedIds.length }} selected</span>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 px-2.5 py-1 rounded disabled:opacity-50"
              :disabled="selectedIds.length === 0 || bulkDeleting"
              :aria-label="
                bulkDeleting
                  ? 'Deleting selected projects'
                  : `Delete ${selectedIds.length} selected project(s)`
              "
              @click="deleteSelected"
            >
              <svg
                v-if="!bulkDeleting"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="w-4 h-4 shrink-0"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                />
              </svg>
              <span v-if="bulkDeleting" class="text-xs">Deleting…</span>
              <span v-else class="text-xs tabular-nums">({{ selectedIds.length }})</span>
            </button>
          </div>
        </div>
      </div>
      <router-link
        v-for="p in store.projects"
        :key="p.id"
        :to="`/project/${p.id}`"
        @click.capture="preventCardNavigationForInteractive($event)"
        :class="[
          'block border rounded-lg p-4 transition-colors',
          isAlerted(p.id)
            ? 'border-2 border-green-500 ring-2 ring-green-400/40 bg-green-50 hover:border-green-600'
            : isSelected(p.id)
              ? 'bg-slate-100 border-slate-500 hover:border-slate-600'
              : 'bg-white hover:border-blue-300',
        ]"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0 flex flex-col">
            <button
              type="button"
              class="mb-2 self-start text-xs px-2 py-0.5 rounded border"
              :class="
                isSelected(p.id)
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
              "
              @click.prevent.stop="toggleSelection(p.id)"
            >
              {{ isSelected(p.id) ? 'Selected' : 'Select' }}
            </button>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs text-gray-400">{{ p.company }}</span>
              <span
                v-if="p.is_endcustomer === true"
                class="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded"
              >
                End Customer
              </span>
              <span
                v-else-if="p.is_endcustomer === false"
                class="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
              >
                Broker
              </span>
            </div>
            <h3 class="text-sm font-semibold text-gray-900 truncate">
              {{ p.title }}
            </h3>
            <p v-if="p.summary" class="text-xs text-gray-500 mt-1 line-clamp-2">
              {{ p.summary }}
            </p>
            <div class="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-400">
              <span>Published: {{ formatProjectPublishDate(p) }}</span>
              <span v-if="p.city">{{ p.city }}</span>
              <span v-if="p.remote_percent">{{ p.remote_percent }}% Remote</span>
              <span v-if="p.duration_months">{{ p.duration_months }}m</span>
              <span v-if="p.start_text">Start: {{ p.start_text }}</span>
            </div>
            <div class="mt-2 flex justify-end">
              <a
                v-if="p.project_url"
                :href="p.project_url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 hover:underline"
                title="Open original listing on freelancermap.de"
                @click.stop
              >
                Open on Freelancermap →
              </a>
            </div>
          </div>
          <div class="flex items-center gap-3 ml-4">
            <span
              v-if="matchingProjectId === p.id"
              class="inline-flex items-center justify-center h-7 w-7 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600"
              title="Matching analysis in progress"
              aria-label="Matching analysis in progress"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                class="w-4 h-4 animate-spin"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4.5 12a7.5 7.5 0 0 1 12.375-5.677M19.5 12a7.5 7.5 0 0 1-12.375 5.677"
                />
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.875 6.323V2.25h4.073" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M7.125 17.677v4.073H3.052" />
              </svg>
            </span>
            <span
              v-if="applicationProjectId === p.id"
              class="inline-flex items-center justify-center h-7 w-7 rounded-full border border-amber-200 bg-amber-50 text-amber-600"
              title="Application generation in progress"
              aria-label="Application generation in progress"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                class="w-4 h-4 animate-writing"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487zm0 0L19.5 7.125"
                />
              </svg>
            </span>
            <button
              type="button"
              class="inline-flex items-center justify-center text-xs bg-red-50 hover:bg-red-100 text-red-700 p-1.5 rounded disabled:opacity-50 min-w-[2rem] min-h-[2rem]"
              :disabled="deletingIds.includes(p.id) || bulkDeleting"
              :aria-label="
                deletingIds.includes(p.id) ? 'Deleting project' : 'Delete project'
              "
              @click.prevent.stop="deleteOne(p.id)"
            >
              <span
                v-if="deletingIds.includes(p.id)"
                class="text-[10px] leading-none"
                aria-hidden="true"
                >…</span
              >
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="w-4 h-4"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                />
              </svg>
            </button>
            <span
              v-if="p.has_application"
              class="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded"
            >
              Application
            </span>
            <div class="relative inline-flex items-center">
              <select
                :value="p.application_outcome_status || ''"
                data-stop-card-nav="true"
                class="appearance-none text-xs border rounded capitalize pl-2 pr-6 py-0.5 max-w-36"
                :class="outcomeSelectClass(p.application_outcome_status)"
                :disabled="isUpdatingOutcome(p.id) || deletingIds.includes(p.id) || bulkDeleting"
                title="Set application outcome (notes can be added in project details)"
                @click.stop
                @mousedown.stop
                @pointerdown.stop
                @keydown.stop
                @change.stop="setOutcomeFromList(p.id, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">Set outcome…</option>
                <option v-for="s in outcomeStatuses" :key="s" :value="s">
                  {{ s }}
                </option>
              </select>
              <span
                class="pointer-events-none absolute right-1 text-[10px]"
                :class="p.application_outcome_status ? 'text-current' : 'text-gray-500'"
                aria-hidden="true"
                >▼</span
              >
            </div>
            <MatchingBadge :rate="p.matching_rate" />
          </div>
        </div>
      </router-link>

      <div
        v-if="store.projects.length === 0"
        class="text-center py-12 text-gray-400"
      >
        No projects found. Waiting for first scrape cycle...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted, onUnmounted, ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectsStore } from '../stores/projects';
import MatchingBadge from '../components/MatchingBadge.vue';
import { formatProjectPublishDate } from '../utils/projectPublishDate';
import {
  alertedProjectIds,
  backendActivity,
  connectRealtime,
} from '../realtime';

const store = useProjectsStore();
const route = useRoute();
const router = useRouter();
const PROJECT_LIST_FILTERS_STORAGE_KEY = 'projectListFilters';

const filters = reactive({
  q: '',
  sort: 'date',
  is_endcustomer: '',
  has_application: '',
  min_rate: '',
});
const selectedIds = ref<number[]>([]);
const deletingIds = ref<number[]>([]);
const bulkDeleting = ref(false);
const updatingOutcomeIds = ref<number[]>([]);
const refreshTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const fallbackInterval = ref<ReturnType<typeof setInterval> | null>(null);
const isMounted = ref(false);
const refreshQueued = ref(false);
const outcomeStatuses = [
  'draft',
  'sent',
  'shortlisted',
  'rejected',
  'interview',
  'offer',
  'won',
  'lost',
  'withdrawn',
] as const;

const allSelected = computed(
  () =>
    store.projects.length > 0 &&
    selectedIds.value.length === store.projects.length,
);
const matchingProjectId = computed(() => {
  if (backendActivity.value.phase !== 'matching') return null;

  if (backendActivity.value.current_project_id != null) {
    return backendActivity.value.current_project_id;
  }

  // Backward-compatible fallback for older backend payloads that only expose detail text.
  const detail = backendActivity.value.detail || '';
  const prefix = 'Analyzing: ';
  if (!detail.startsWith(prefix)) return null;
  const titleFragment = detail.slice(prefix.length).trim().toLowerCase();
  if (!titleFragment) return null;

  const match = store.projects.find((p) => {
    const title = (p.title || '').trim().toLowerCase();
    return (
      title.startsWith(titleFragment) ||
      titleFragment.startsWith(title) ||
      title.includes(titleFragment)
    );
  });
  return match?.id ?? null;
});
const applicationProjectId = computed(() => {
  if (backendActivity.value.phase !== 'application') return null;
  return backendActivity.value.current_project_id ?? null;
});
const nextScrapeRunText = computed(() => {
  const raw = backendActivity.value.next_scrape_run_at;
  if (!raw) return 'not scheduled';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'not scheduled';
  return d.toLocaleString();
});

function isSelected(id: number) {
  return selectedIds.value.includes(id);
}

function isAlerted(id: number) {
  return alertedProjectIds.value.includes(id);
}

function isUpdatingOutcome(id: number) {
  return updatingOutcomeIds.value.includes(id);
}

function preventCardNavigationForInteractive(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  const current = event.currentTarget as HTMLElement | null;
  if (!target) return;
  const interactive = target.closest(
    'button,select,option,input,textarea,[data-stop-card-nav="true"]',
  );
  if (interactive && current && interactive !== current) {
    event.preventDefault();
  }
}

function toggleSelection(id: number) {
  if (!selectedIds.value.includes(id)) {
    if (!selectedIds.value.includes(id)) selectedIds.value.push(id);
    return;
  }
  selectedIds.value = selectedIds.value.filter((x) => x !== id);
}

function toggleSelectAll() {
  selectedIds.value = allSelected.value ? [] : store.projects.map((p) => p.id);
}

function outcomeBadgeClass(status: string) {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-700';
    case 'sent':
      return 'bg-blue-50 text-blue-700';
    case 'shortlisted':
    case 'interview':
      return 'bg-purple-50 text-purple-700';
    case 'offer':
    case 'won':
      return 'bg-emerald-50 text-emerald-700';
    case 'rejected':
    case 'lost':
    case 'withdrawn':
      return 'bg-red-50 text-red-700';
    default:
      return 'bg-amber-50 text-amber-700';
  }
}

function outcomeSelectClass(status: string | null) {
  if (!status) return 'bg-white text-gray-600 border-gray-300';
  const badgeClass = outcomeBadgeClass(status);
  if (badgeClass.includes('blue')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (badgeClass.includes('purple'))
    return 'bg-purple-50 text-purple-700 border-purple-200';
  if (badgeClass.includes('emerald'))
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (badgeClass.includes('red')) return 'bg-red-50 text-red-700 border-red-200';
  if (badgeClass.includes('gray')) return 'bg-gray-100 text-gray-700 border-gray-300';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

async function deleteOne(projectId: number) {
  const ok = window.confirm(
    'Delete this project from the dashboard? It will be moved to the trash and can be restored from there.',
  );
  if (!ok) return;
  deletingIds.value.push(projectId);
  try {
    await store.deleteProject(projectId);
    selectedIds.value = selectedIds.value.filter((id) => id !== projectId);
    await load();
  } finally {
    deletingIds.value = deletingIds.value.filter((id) => id !== projectId);
  }
}

async function deleteSelected() {
  if (selectedIds.value.length === 0) return;
  const ok = window.confirm(
    `Delete ${selectedIds.value.length} selected project(s)? They will be moved to the trash and can be restored from there.`,
  );
  if (!ok) return;
  bulkDeleting.value = true;
  try {
    await Promise.all(selectedIds.value.map((id) => store.deleteProject(id)));
    selectedIds.value = [];
    await load();
  } finally {
    bulkDeleting.value = false;
  }
}

async function setOutcomeFromList(projectId: number, status: string) {
  if (!status) return;
  const project = store.projects.find((row) => row.id === projectId);
  if (!project) return;
  if (project.application_outcome_status === status) return;
  if (isUpdatingOutcome(projectId)) return;

  updatingOutcomeIds.value.push(projectId);
  try {
    const result = await store.addOutcome(projectId, status);
    if (result?.error) return;
    store.patchProject(projectId, {
      application_outcome_status: status,
    });
  } finally {
    updatingOutcomeIds.value = updatingOutcomeIds.value.filter(
      (id) => id !== projectId,
    );
  }
}

function loadStoredFilters() {
  try {
    const raw = sessionStorage.getItem(PROJECT_LIST_FILTERS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<typeof filters>;
    if (parsed.sort === 'date' || parsed.sort === 'rate') {
      filters.sort = parsed.sort;
    }
    if (typeof parsed.q === 'string') {
      filters.q = parsed.q;
    }
    if (typeof parsed.is_endcustomer === 'string') {
      filters.is_endcustomer = parsed.is_endcustomer;
    }
    if (typeof parsed.has_application === 'string') {
      filters.has_application = parsed.has_application;
    }
    if (typeof parsed.min_rate === 'string') {
      filters.min_rate = parsed.min_rate;
    }
  } catch {
    /* ignore invalid session storage payload */
  }
}

function storeFilters() {
  try {
    sessionStorage.setItem(PROJECT_LIST_FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    /* ignore storage write failures */
  }
}

function load() {
  storeFilters();
  const params = buildParamsFromFilters();
  store.setActiveQuery(params);
  return store.fetchProjects(params);
}

function buildParamsFromFilters(): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.q.trim()) params.q = filters.q.trim();
  if (filters.sort === 'rate') {
    params.sort = 'rate';
    params.order = 'DESC';
  }
  if (filters.is_endcustomer) params.is_endcustomer = filters.is_endcustomer;
  if (filters.has_application) params.has_application = filters.has_application;
  if (filters.min_rate) params.min_rate = filters.min_rate;
  return params;
}

function filtersFromRouteQuery() {
  const q = route.query;
  const textSearch = typeof q.q === 'string' ? q.q : '';
  const sort = q.sort === 'rate' ? 'rate' : 'date';
  const is_endcustomer =
    q.is_endcustomer === 'true' || q.is_endcustomer === 'false'
      ? String(q.is_endcustomer)
      : '';
  const has_application =
    q.has_application === 'true' || q.has_application === 'false'
      ? String(q.has_application)
      : '';
  const min_rate = typeof q.min_rate === 'string' ? q.min_rate : '';

  return {
    q: textSearch,
    sort,
    is_endcustomer,
    has_application,
    min_rate,
  };
}

function applyRouteQueryToFilters() {
  const next = filtersFromRouteQuery();
  filters.q = next.q;
  filters.sort = next.sort;
  filters.is_endcustomer = next.is_endcustomer;
  filters.has_application = next.has_application;
  filters.min_rate = next.min_rate;
}

function applyFilters() {
  selectedIds.value = [];
  const query = buildParamsFromFilters();
  void router.replace({
    path: '/',
    query,
  });
}

async function safeLoad() {
  if (!isMounted.value) return;
  if (store.loading) {
    refreshQueued.value = true;
    return;
  }
  await load();
  if (refreshQueued.value && !store.loading) {
    refreshQueued.value = false;
    await load();
  }
}

function scheduleDebouncedRefresh(delayMs = 500) {
  if (refreshTimer.value) {
    clearTimeout(refreshTimer.value);
  }
  refreshTimer.value = setTimeout(() => {
    void safeLoad();
  }, delayMs);
}

onMounted(async () => {
  isMounted.value = true;
  if (Object.keys(route.query).length > 0) {
    applyRouteQueryToFilters();
  } else {
    loadStoredFilters();
    void router.replace({ path: '/', query: buildParamsFromFilters() });
  }
  connectRealtime();
  await safeLoad();
  fallbackInterval.value = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (!store.shouldBackgroundRefresh(45_000)) return;
    void safeLoad();
  }, 60_000);
});

watch(
  () => route.query,
  () => {
    applyRouteQueryToFilters();
    void safeLoad();
  },
  { deep: true },
);

watch(
  () => store.lastProjectUpdateAt,
  () => {
    if (!isMounted.value) return;
    scheduleDebouncedRefresh(500);
  },
);

onUnmounted(() => {
  isMounted.value = false;
  if (refreshTimer.value) {
    clearTimeout(refreshTimer.value);
    refreshTimer.value = null;
  }
  if (fallbackInterval.value) {
    clearInterval(fallbackInterval.value);
    fallbackInterval.value = null;
  }
});
</script>

<style scoped>
@keyframes pen-writing {
  0%   { transform: translate(0, 0) rotate(0deg); }
  25%  { transform: translate(1.5px, -0.5px) rotate(-6deg); }
  50%  { transform: translate(0, 0) rotate(0deg); }
  75%  { transform: translate(-1.5px, 0.5px) rotate(6deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
.animate-writing {
  animation: pen-writing 0.8s ease-in-out infinite;
  transform-origin: 75% 75%;
}
</style>
