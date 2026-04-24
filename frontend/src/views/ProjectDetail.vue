<template>
  <div v-if="!project" class="text-center py-8 text-gray-400">Loading...</div>
  <div v-else class="space-y-6">
    <router-link to="/" class="text-sm text-blue-600 hover:underline">
      &larr; Back to list
    </router-link>

    <!-- Header -->
    <div class="bg-white border rounded-lg p-6">
      <div class="flex items-start justify-between">
        <div>
          <span class="text-xs text-gray-400">{{ project.company }}</span>
          <span
            v-if="project.is_endcustomer === true"
            class="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded"
          >
            End Customer
          </span>
          <span
            v-else-if="project.is_endcustomer === false"
            class="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
          >
            Broker
          </span>
          <h1 class="text-xl font-bold mt-1">{{ project.title }}</h1>
          <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
            <span>Published: {{ formatProjectPublishDate(project) }}</span>
            <span v-if="project.city">{{ project.city }}, {{ project.country }}</span>
            <span v-if="project.remote_percent">{{ project.remote_percent }}% Remote</span>
            <span v-if="project.duration_months">{{ project.duration_months }} months</span>
            <span v-if="project.start_text">Start: {{ project.start_text }}</span>
            <span v-if="project.industry">{{ project.industry }}</span>
          </div>
        </div>
        <div class="text-right">
          <MatchingBadge
            :rate="project.matching_results?.[0]?.matching_rate ?? null"
            class="text-lg"
          />
          <button
            @click="reanalyzeProject"
            :disabled="reanalyzing"
            class="mt-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded disabled:opacity-50"
          >
            {{ reanalyzing ? 'Re-analyzing...' : 'Re-analyze project' }}
          </button>
          <button
            @click="createApplication"
            :disabled="creatingApplication"
            class="mt-2 ml-2 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded disabled:opacity-50"
          >
            {{
              creatingApplication
                ? 'Generating...'
                : project.application
                ? 'Re-create application'
                : 'Create application'
            }}
          </button>
          <button
            @click="deleteProject"
            :disabled="deleting"
            class="mt-2 inline-flex items-center justify-center gap-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-700 px-2 py-1.5 rounded disabled:opacity-50"
            :aria-label="deleting ? 'Deleting project' : 'Delete project'"
          >
            <svg
              v-if="!deleting"
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
            <span v-if="deleting">Deleting…</span>
          </button>
          <a
            :href="project.project_url"
            target="_blank"
            class="block mt-2 text-xs text-blue-500 hover:underline"
          >
            Open on Freelancermap &rarr;
          </a>
        </div>
      </div>
      <p v-if="project.summary" class="mt-4 text-sm text-gray-600 bg-gray-50 rounded p-3">
        {{ project.summary }}
      </p>
    </div>

    <!-- Tabs -->
    <div class="flex border-b">
      <button
        v-for="tab in tabs"
        :key="tab"
        @click="activeTab = tab"
        :class="[
          'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
          activeTab === tab
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700',
        ]"
      >
        {{ tab }}
      </button>
    </div>

    <!-- Requirements + Matches -->
    <div v-if="activeTab === 'Matching'">
      <div v-if="reqMatches.length">
        <RequirementMatch
          v-for="rm in reqMatches"
          :key="rm.id"
          :match="rm"
        />
      </div>
      <div v-else class="text-sm text-gray-400 italic">
        No matching data available yet.
      </div>

      <div v-if="uncovered.length" class="mt-4">
        <h3 class="text-sm font-semibold text-red-600 mb-2">
          Uncovered Requirements ({{ uncovered.length }})
        </h3>
        <ul class="list-disc list-inside text-sm text-red-500 space-y-1">
          <li v-for="u in uncovered" :key="u.id">
            {{ u.requirement?.requirement_text }}
            <span v-if="u.requirement?.is_must_have" class="font-bold">(MUST)</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Application -->
    <div v-if="activeTab === 'Application'">
      <ApplicationView :application="project.application" />
    </div>

    <!-- Description -->
    <div v-if="activeTab === 'Description'" class="bg-white border rounded-lg p-6">
      <div class="prose prose-sm max-w-none" v-html="project.description_html"></div>
    </div>

    <!-- Metadata -->
    <div v-if="activeTab === 'Metadata'" class="bg-white border rounded-lg p-6 space-y-3">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div><span class="text-gray-500">External ID:</span> {{ project.external_id }}</div>
        <div>
          <span class="text-gray-500">Published:</span>
          {{ formatProjectPublishDate(project) }}
        </div>
        <div><span class="text-gray-500">Language:</span> {{ project.detected_language }}</div>
        <div><span class="text-gray-500">Application Channel:</span> {{ project.application_channel }}</div>
        <div><span class="text-gray-500">Contract Type:</span> {{ project.contract_type }}</div>
        <div><span class="text-gray-500">Workload:</span> {{ project.workload }}%</div>
        <div><span class="text-gray-500">Extension:</span> {{ project.extension_possible ? 'Yes' : 'No' }}</div>
      </div>
      <div v-if="project.application_instructions" class="mt-4 bg-gray-50 p-3 rounded text-sm">
        <strong>How to apply:</strong> {{ project.application_instructions }}
      </div>
      <div v-if="project.skills_json?.length" class="mt-4">
        <span class="text-sm text-gray-500">Skills:</span>
        <div class="flex flex-wrap gap-1 mt-1">
          <span
            v-for="s in project.skills_json"
            :key="s.codeId || s.name"
            class="text-xs bg-gray-100 px-2 py-0.5 rounded"
          >
            {{ s.name }}
          </span>
        </div>
      </div>
    </div>

    <!-- Outcome Tracking -->
    <div v-if="activeTab === 'Outcome'" class="bg-white border rounded-lg p-6">
      <h3 class="text-sm font-semibold mb-3">Application Outcome</h3>
      <p v-if="outcomeError" class="text-sm text-red-600 mb-3">{{ outcomeError }}</p>
      <div v-if="project.application?.outcomes?.length" class="space-y-2 mb-4">
        <div
          v-for="o in project.application.outcomes"
          :key="o.id"
          class="text-sm border rounded p-2"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <span class="font-medium">{{ o.status }}</span>
              <span class="text-gray-400 ml-2">{{ new Date(o.created_at).toLocaleDateString() }}</span>
            </div>
            <button
              type="button"
              class="text-xs bg-red-50 hover:bg-red-100 text-red-700 px-2 py-1 rounded disabled:opacity-50"
              :disabled="deletingOutcomeId === o.id"
              @click="removeOutcome(o.id)"
            >
              {{ deletingOutcomeId === o.id ? 'Deleting…' : 'Delete' }}
            </button>
          </div>
          <p v-if="o.notes" class="text-xs text-gray-500 mt-1">{{ o.notes }}</p>
        </div>
      </div>
      <div class="flex gap-2">
        <select v-model="newStatus" class="text-sm border rounded px-2 py-1">
          <option value="">Select status...</option>
          <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
        </select>
        <input
          v-model="newNotes"
          placeholder="Notes..."
          class="text-sm border rounded px-2 py-1 flex-1"
        />
        <button
          @click="submitOutcome"
          :disabled="!newStatus"
          class="text-sm bg-blue-500 text-white px-3 py-1 rounded disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectsStore, type ProjectSummary } from '../stores/projects';
import { clearProjectAlert } from '../realtime';
import { formatProjectPublishDate } from '../utils/projectPublishDate';
import MatchingBadge from '../components/MatchingBadge.vue';
import RequirementMatch from '../components/RequirementMatch.vue';
import ApplicationView from '../components/ApplicationView.vue';

const props = defineProps<{ id: string }>();
const store = useProjectsStore();
const router = useRouter();
const project = ref<any>(null);
const activeTab = ref('Matching');
const newStatus = ref('');
const newNotes = ref('');
const reanalyzing = ref(false);
const creatingApplication = ref(false);
const deleting = ref(false);
const deletingOutcomeId = ref<number | null>(null);
const outcomeError = ref('');

const tabs = ['Matching', 'Application', 'Description', 'Metadata', 'Outcome'];
const statuses = [
  'draft', 'sent', 'shortlisted', 'rejected',
  'interview', 'offer', 'won', 'lost', 'withdrawn',
];

const reqMatches = computed(() => {
  const mr = project.value?.matching_results?.[0];
  return mr?.requirement_matches || [];
});

const uncovered = computed(() =>
  reqMatches.value.filter((m: any) => m.match_type === 'none'),
);

async function submitOutcome() {
  if (!newStatus.value) return;
  outcomeError.value = '';
  const projectId = parseInt(props.id);
  const result = await store.addOutcome(projectId, newStatus.value, newNotes.value);
  if (result?.error) {
    outcomeError.value = result.error;
    return;
  }

  if (project.value?.application) {
    const existingOutcomes = Array.isArray(project.value.application.outcomes)
      ? project.value.application.outcomes
      : [];
    project.value.application.outcomes = [result, ...existingOutcomes];
  }

  project.value = await store.fetchProject(projectId);
  store.patchProject(projectId, {
    application_outcome_status: result.status ?? null,
  });
  newStatus.value = '';
  newNotes.value = '';
}

async function removeOutcome(outcomeId: number) {
  if (deletingOutcomeId.value !== null) return;
  const ok = window.confirm('Delete this outcome entry?');
  if (!ok) return;

  outcomeError.value = '';
  deletingOutcomeId.value = outcomeId;
  const projectId = parseInt(props.id);
  try {
    const result = await store.deleteOutcome(projectId, outcomeId);
    if (result?.error) {
      outcomeError.value = result.error;
      return;
    }

    if (project.value?.application?.outcomes) {
      project.value.application.outcomes = project.value.application.outcomes.filter(
        (o: any) => o.id !== outcomeId,
      );
    }

    project.value = await store.fetchProject(projectId);
    store.patchProject(projectId, {
      application_outcome_status: result.latest_outcome_status ?? null,
    });
  } finally {
    deletingOutcomeId.value = null;
  }
}

async function reanalyzeProject() {
  if (reanalyzing.value) return;
  reanalyzing.value = true;
  try {
    const projectId = parseInt(props.id);
    const result = await store.reanalyzeProject(projectId);
    project.value = await store.fetchProject(projectId);
    if (!result?.error) {
      store.patchProject(projectId, {
        matching_rate:
          typeof result?.matching_rate === 'number'
            ? result.matching_rate
            : null,
      });
    }
  } finally {
    reanalyzing.value = false;
  }
}

async function createApplication() {
  if (creatingApplication.value) return;
  creatingApplication.value = true;
  try {
    const projectId = parseInt(props.id);
    const result = await store.createApplication(projectId);
    project.value = await store.fetchProject(projectId);
    if (!result?.error) {
      const patch: Partial<ProjectSummary> = { has_application: true };
      if (typeof result?.matching_rate === 'number') {
        patch.matching_rate = result.matching_rate;
      }
      store.patchProject(projectId, patch);
    }
  } finally {
    creatingApplication.value = false;
  }
}

async function deleteProject() {
  if (deleting.value) return;
  const ok = window.confirm(
    'Delete this project from the dashboard? It will be hidden and not imported again.',
  );
  if (!ok) return;
  deleting.value = true;
  try {
    await store.deleteProject(parseInt(props.id));
    await router.push('/');
  } finally {
    deleting.value = false;
  }
}

onMounted(async () => {
  const projectId = parseInt(props.id);
  clearProjectAlert(projectId);
  project.value = await store.fetchProject(projectId);
});
</script>
