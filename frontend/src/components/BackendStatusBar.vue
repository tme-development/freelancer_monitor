<template>
  <div
    class="border-b border-gray-200 bg-slate-50/90 backdrop-blur-sm px-4 py-2 text-sm"
  >
    <div class="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
      <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Backend
      </span>

      <div class="flex flex-wrap items-center gap-1.5">
        <span
          v-for="step in steps"
          :key="step.phase"
          :class="pillClass(step.phase)"
          class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors"
        >
          <span
            class="h-1.5 w-1.5 rounded-full shrink-0"
            :class="
              activity.phase === step.phase ? 'bg-current opacity-90' : 'bg-gray-300'
            "
          />
          {{ step.label }}
        </span>
      </div>

      <div class="min-h-[1.25rem] flex items-center">
        <p
          v-if="activity.detail && activity.phase !== 'idle'"
          class="text-xs text-gray-600 truncate max-w-[min(28rem,50vw)]"
          :title="activity.detail || undefined"
        >
          {{ activity.detail }}
        </p>
        <p v-else-if="activity.phase === 'idle'" class="text-xs text-gray-400 italic">
          Idle
        </p>
      </div>

      <div class="ml-auto relative">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          @click="errorsOpen = !errorsOpen"
        >
          Errors
          <span
            class="rounded-full bg-gray-200 px-1.5 py-0 text-[10px] font-semibold text-gray-700 tabular-nums"
          >
            {{ activity.errors.length }}
          </span>
          <span class="text-gray-400" aria-hidden="true">{{
            errorsOpen ? '▲' : '▼'
          }}</span>
        </button>

        <div
          v-if="errorsOpen"
          class="absolute right-0 z-40 mt-1 w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <div
            class="max-h-48 overflow-y-auto p-2 text-xs text-left divide-y divide-gray-100"
          >
            <p
              v-if="activity.errors.length === 0"
              class="py-3 px-2 text-gray-400 text-center"
            >
              No recent errors
            </p>
            <div
              v-for="(e, i) in activity.errors"
              :key="i"
              class="py-2 px-2 hover:bg-gray-50"
            >
              <div class="text-[10px] text-gray-400 font-mono tabular-nums">
                {{ formatErrorTime(e.at) }}
              </div>
              <div class="text-red-800 break-words mt-0.5">{{ e.message }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  backendActivity,
  connectRealtime,
  type BackendActivityPhase,
} from '../realtime';

const API = import.meta.env.VITE_API_URL || '';

const errorsOpen = ref(false);

const activity = computed(() => backendActivity.value);

const steps: { phase: BackendActivityPhase; label: string }[] = [
  { phase: 'scraping', label: 'Scraping' },
  { phase: 'matching', label: 'Matching analyzes' },
  { phase: 'application', label: 'Application creation' },
];

function pillClass(phase: BackendActivityPhase) {
  const active = activity.value.phase === phase;
  if (active) {
    return 'border-blue-400 bg-blue-50 text-blue-800';
  }
  return 'border-transparent bg-white/60 text-gray-500';
}

function formatErrorTime(iso: string) {
  try {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  } catch {
    return iso;
  }
}

onMounted(async () => {
  connectRealtime();
  try {
    const url = API
      ? `${API.replace(/\/$/, '')}/api/backend-activity`
      : '/api/backend-activity';
    const res = await fetch(url);
    if (res.ok) {
      backendActivity.value = await res.json();
    }
  } catch {
    /* offline or wrong API — socket may still work */
  }
});
</script>
