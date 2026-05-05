<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2">
          Trash
          <span
            class="text-xs font-normal bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
          >
            logically deleted
          </span>
        </h1>
        <p class="text-xs text-gray-500 mt-1">
          Projects in the trash are read-only. Restore them to resume editing,
          matching, and applications. Permanently deleted projects cannot be
          recovered.
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
      </div>
    </div>
    <div class="mb-3 h-5">
      <span v-if="store.loading" class="text-xs text-gray-400">
        Refreshing…
      </span>
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
            <span class="text-sm text-gray-500">
              {{ selectedIds.length }} selected
            </span>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 text-sm bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded disabled:opacity-50"
              :disabled="selectedIds.length === 0 || bulkRestoring"
              :aria-label="
                bulkRestoring
                  ? 'Restoring selected projects'
                  : `Restore ${selectedIds.length} selected project(s)`
              "
              @click="restoreSelected"
            >
              <svg
                v-if="!bulkRestoring"
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
                  d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
                />
              </svg>
              <span v-if="bulkRestoring" class="text-xs">Restoring…</span>
              <span v-else class="text-xs tabular-nums">
                Restore ({{ selectedIds.length }})
              </span>
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 px-2.5 py-1 rounded disabled:opacity-50"
              :disabled="selectedIds.length === 0 || bulkPurging"
              :aria-label="
                bulkPurging
                  ? 'Permanently deleting selected projects'
                  : `Permanently delete ${selectedIds.length} selected project(s)`
              "
              @click="purgeSelected"
            >
              <svg
                v-if="!bulkPurging"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="w-4 h-4 shrink-0"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
              <span v-if="bulkPurging" class="text-xs">Deleting…</span>
              <span v-else class="text-xs tabular-nums">
                Delete forever ({{ selectedIds.length }})
              </span>
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
          isSelected(p.id)
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
              <span
                class="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded"
              >
                In trash
              </span>
            </div>
            <h3 class="text-sm font-semibold text-gray-900 truncate">
              {{ p.title }}
            </h3>
            <p
              v-if="p.summary"
              class="text-xs text-gray-500 mt-1 line-clamp-2"
            >
              {{ p.summary }}
            </p>
            <div
              class="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-400"
            >
              <span>Published: {{ formatProjectPublishDate(p) }}</span>
              <span v-if="p.deleted_at">
                Trashed: {{ formatTrashedAt(p.deleted_at) }}
              </span>
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
            <button
              type="button"
              class="inline-flex items-center justify-center text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-1.5 rounded disabled:opacity-50 min-w-[2rem] min-h-[2rem]"
              :disabled="
                restoringIds.includes(p.id) || bulkRestoring || bulkPurging
              "
              :aria-label="
                restoringIds.includes(p.id)
                  ? 'Restoring project'
                  : 'Restore project'
              "
              title="Restore project from trash"
              @click.prevent.stop="restoreOne(p.id)"
            >
              <span
                v-if="restoringIds.includes(p.id)"
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
                  d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
                />
              </svg>
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center text-xs bg-red-50 hover:bg-red-100 text-red-700 p-1.5 rounded disabled:opacity-50 min-w-[2rem] min-h-[2rem]"
              :disabled="
                purgingIds.includes(p.id) || bulkRestoring || bulkPurging
              "
              :aria-label="
                purgingIds.includes(p.id)
                  ? 'Permanently deleting project'
                  : 'Permanently delete project'
              "
              title="Delete project permanently (cannot be undone)"
              @click.prevent.stop="purgeOne(p.id)"
            >
              <span
                v-if="purgingIds.includes(p.id)"
                class="text-[10px] leading-none"
                aria-hidden="true"
                >…</span
              >
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="w-4 h-4"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
            <span
              v-if="p.has_application"
              class="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded"
            >
              Application
            </span>
            <MatchingBadge :rate="p.matching_rate" />
          </div>
        </div>
      </router-link>

      <div
        v-if="store.projects.length === 0"
        class="text-center py-12 text-gray-400"
      >
        The trash is empty.
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

const store = useProjectsStore();
const route = useRoute();
const router = useRouter();

const filters = reactive({
  q: '',
  sort: 'date',
});
const selectedIds = ref<number[]>([]);
const restoringIds = ref<number[]>([]);
const purgingIds = ref<number[]>([]);
const bulkRestoring = ref(false);
const bulkPurging = ref(false);
const isMounted = ref(false);

const allSelected = computed(
  () =>
    store.projects.length > 0 &&
    selectedIds.value.length === store.projects.length,
);

function isSelected(id: number) {
  return selectedIds.value.includes(id);
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
    selectedIds.value.push(id);
    return;
  }
  selectedIds.value = selectedIds.value.filter((x) => x !== id);
}

function toggleSelectAll() {
  selectedIds.value = allSelected.value ? [] : store.projects.map((p) => p.id);
}

function formatTrashedAt(raw: string | null | undefined): string {
  if (!raw) return '';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

function buildParamsFromFilters(): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.q.trim()) params.q = filters.q.trim();
  if (filters.sort === 'rate') {
    params.sort = 'rate';
    params.order = 'DESC';
  }
  return params;
}

function load() {
  const params = buildParamsFromFilters();
  store.setActiveTrashQuery(params);
  return store.fetchTrashedProjects(params);
}

function applyFilters() {
  selectedIds.value = [];
  const query = buildParamsFromFilters();
  void router.replace({
    path: '/trash',
    query,
  });
}

function applyRouteQueryToFilters() {
  const q = route.query;
  filters.q = typeof q.q === 'string' ? q.q : '';
  filters.sort = q.sort === 'rate' ? 'rate' : 'date';
}

async function restoreOne(projectId: number) {
  if (restoringIds.value.includes(projectId)) return;
  restoringIds.value.push(projectId);
  try {
    const result = await store.restoreProject(projectId);
    if (result?.error) {
      window.alert(result.error);
      return;
    }
    selectedIds.value = selectedIds.value.filter((id) => id !== projectId);
    await load();
  } finally {
    restoringIds.value = restoringIds.value.filter((id) => id !== projectId);
  }
}

async function restoreSelected() {
  if (selectedIds.value.length === 0) return;
  bulkRestoring.value = true;
  try {
    const ids = [...selectedIds.value];
    await Promise.all(ids.map((id) => store.restoreProject(id)));
    selectedIds.value = [];
    await load();
  } finally {
    bulkRestoring.value = false;
  }
}

async function purgeOne(projectId: number) {
  if (purgingIds.value.includes(projectId)) return;
  const ok = window.confirm(
    'Permanently delete this project? This cannot be undone — all related ' +
      'matching results, requirements, applications, and outcomes will be ' +
      'removed from the system.',
  );
  if (!ok) return;
  purgingIds.value.push(projectId);
  try {
    const result = await store.purgeProject(projectId);
    if (result?.error) {
      window.alert(result.error);
      return;
    }
    selectedIds.value = selectedIds.value.filter((id) => id !== projectId);
    await load();
  } finally {
    purgingIds.value = purgingIds.value.filter((id) => id !== projectId);
  }
}

async function purgeSelected() {
  if (selectedIds.value.length === 0) return;
  const ok = window.confirm(
    `Permanently delete ${selectedIds.value.length} selected project(s)? ` +
      'This cannot be undone — all related matching results, requirements, ' +
      'applications, and outcomes will be removed from the system.',
  );
  if (!ok) return;
  bulkPurging.value = true;
  try {
    const ids = [...selectedIds.value];
    await Promise.all(ids.map((id) => store.purgeProject(id)));
    selectedIds.value = [];
    await load();
  } finally {
    bulkPurging.value = false;
  }
}

onMounted(async () => {
  isMounted.value = true;
  applyRouteQueryToFilters();
  if (Object.keys(route.query).length === 0) {
    void router.replace({ path: '/trash', query: buildParamsFromFilters() });
  }
  await load();
});

watch(
  () => route.query,
  () => {
    if (route.path !== '/trash') return;
    applyRouteQueryToFilters();
    void load();
  },
  { deep: true },
);

onUnmounted(() => {
  isMounted.value = false;
});
</script>
