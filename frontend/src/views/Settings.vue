<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Settings</h1>

    <div class="bg-white border rounded-lg p-6 space-y-6">
      <!-- Polling -->
      <section>
        <h2 class="text-sm font-semibold text-gray-700 mb-3">Polling</h2>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Interval (minutes)</label>
            <input
              :value="store.getSetting('polling_interval_minutes')"
              @change="update('polling_interval_minutes', ($event.target as HTMLInputElement).value)"
              type="number"
              class="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Search URL</label>
            <input
              :value="store.getSetting('freelancermap_search_url')"
              @change="update('freelancermap_search_url', ($event.target as HTMLInputElement).value)"
              type="text"
              class="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
        </div>
        <div class="mt-4 pt-4 border-t border-gray-100">
          <p class="text-xs text-gray-500 mb-3 max-w-xl">
            Pause stops the scraper from fetching listings and importing new projects. The timer still
            runs; backlog matching, applications, and alerts for existing rows continue.
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <div class="inline-flex rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <button
                type="button"
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed border-r border-gray-200"
                :class="scrapingPaused ? 'text-gray-400' : 'text-gray-800'"
                :disabled="scrapingPaused"
                title="Pause scraping"
                @click="setScrapingPaused(true)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  class="w-5 h-5 shrink-0"
                  aria-hidden="true"
                >
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
                Pause
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed"
                :class="!scrapingPaused ? 'text-gray-400' : 'text-emerald-800'"
                :disabled="!scrapingPaused"
                title="Resume scraping"
                @click="setScrapingPaused(false)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  class="w-5 h-5 shrink-0"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7L8 5z" />
                </svg>
                Resume
              </button>
            </div>
            <span
              v-if="scrapingPaused"
              class="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded"
            >
              Scraping paused
            </span>
            <span v-else class="text-xs text-gray-400">Scraping active</span>
          </div>
        </div>
      </section>

      <!-- Matching -->
      <section>
        <h2 class="text-sm font-semibold text-gray-700 mb-3">Matching Thresholds</h2>
        <div class="mb-4 pb-4 border-b border-gray-100">
          <p class="text-xs text-gray-500 mb-3 max-w-xl">
            Pause stops automatic matching and application generation in scheduler runs. New scraped
            projects are still imported and queued for processing after resume.
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <div class="inline-flex rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <button
                type="button"
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed border-r border-gray-200"
                :class="matchingPaused ? 'text-gray-400' : 'text-gray-800'"
                :disabled="matchingPaused"
                title="Pause matching"
                @click="setMatchingPaused(true)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  class="w-5 h-5 shrink-0"
                  aria-hidden="true"
                >
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
                Pause
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed"
                :class="!matchingPaused ? 'text-gray-400' : 'text-emerald-800'"
                :disabled="!matchingPaused"
                title="Resume matching"
                @click="setMatchingPaused(false)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  class="w-5 h-5 shrink-0"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7L8 5z" />
                </svg>
                Resume
              </button>
            </div>
            <span
              v-if="matchingPaused"
              class="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded"
            >
              Matching paused
            </span>
            <span v-else class="text-xs text-gray-400">Matching active</span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Application threshold (%)</label>
            <input
              :value="store.getSetting('matching_threshold_application')"
              @change="update('matching_threshold_application', ($event.target as HTMLInputElement).value)"
              type="number"
              class="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Very high alert threshold (%)</label>
            <input
              :value="store.getSetting('matching_threshold_very_high')"
              @change="update('matching_threshold_very_high', ($event.target as HTMLInputElement).value)"
              type="number"
              class="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </section>

      <!-- Weights -->
      <section>
        <h2 class="text-sm font-semibold text-gray-700 mb-3">Matching Weights</h2>
        <div class="grid grid-cols-4 gap-4">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Direct</label>
            <input
              :value="store.getSetting('weight_direct')"
              @change="update('weight_direct', ($event.target as HTMLInputElement).value)"
              type="number"
              step="0.1"
              class="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Alternative</label>
            <input
              :value="store.getSetting('weight_alternative')"
              @change="update('weight_alternative', ($event.target as HTMLInputElement).value)"
              type="number"
              step="0.1"
              class="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Must-have</label>
            <input
              :value="store.getSetting('weight_must_have')"
              @change="update('weight_must_have', ($event.target as HTMLInputElement).value)"
              type="number"
              step="0.1"
              class="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Nice-to-have</label>
            <input
              :value="store.getSetting('weight_nice_to_have')"
              @change="update('weight_nice_to_have', ($event.target as HTMLInputElement).value)"
              type="number"
              step="0.1"
              class="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </section>

      <!-- Audio -->
      <section>
        <h2 class="text-sm font-semibold text-gray-700 mb-3">Audio Alert</h2>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Alert audio file path</label>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
            <div class="flex-1 min-w-0">
              <input
                :value="store.getSetting('alert_audio_file')"
                @change="update('alert_audio_file', ($event.target as HTMLInputElement).value)"
                type="text"
                class="w-full border rounded px-3 py-1.5 text-sm"
              />
              <p class="text-xs text-gray-400 mt-1">
                Server filesystem path (e.g. under <code class="text-gray-600">/data/audio</code> in Docker).
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 px-4 py-1.5 text-sm font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
              :disabled="testSoundState === 'playing'"
              @click="testAlertSound"
            >
              {{ testSoundState === 'playing' ? 'Playing…' : 'Test sound' }}
            </button>
          </div>
        </div>
        <p v-if="testSoundError" class="text-xs text-red-600 mt-2">{{ testSoundError }}</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useSettingsStore } from '../stores/settings';

const API = import.meta.env.VITE_API_URL || '';

const store = useSettingsStore();
const testSoundState = ref<'idle' | 'playing'>('idle');
const testSoundError = ref('');

const scrapingPaused = computed(() => {
  const v =
    store.settings.find((s) => s.key_name === 'scraping_paused')?.value_text
      ?.trim()
      .toLowerCase() ?? '';
  return v === '1' || v === 'true' || v === 'yes';
});

const matchingPaused = computed(() => {
  const v =
    store.settings.find((s) => s.key_name === 'matching_paused')?.value_text
      ?.trim()
      .toLowerCase() ?? '';
  return v === '1' || v === 'true' || v === 'yes';
});

function update(key: string, value: string) {
  store.updateSetting(key, value);
}

async function setScrapingPaused(paused: boolean) {
  await store.updateSetting('scraping_paused', paused ? '1' : '0');
}

async function setMatchingPaused(paused: boolean) {
  await store.updateSetting('matching_paused', paused ? '1' : '0');
}

function alertAudioUrl(): string {
  const path = '/api/settings/alert-audio';
  return API ? `${API.replace(/\/$/, '')}${path}` : path;
}

/**
 * Test alert sound. Kept synchronous up to `play()` so the click counts as a user gesture.
 * Most failures are load errors (404/400/wrong API URL), not autoplay policy.
 */
function testAlertSound() {
  testSoundError.value = '';
  testSoundState.value = 'playing';

  const url = `${alertAudioUrl()}?t=${Date.now()}`;
  const audio = new Audio(url);

  try {
    const resolved = new URL(url, window.location.href);
    if (resolved.origin !== window.location.origin) {
      audio.crossOrigin = 'anonymous';
    }
  } catch {
    /* ignore invalid URL */
  }

  let settled = false;
  const done = () => {
    if (!settled) {
      settled = true;
      testSoundState.value = 'idle';
    }
  };

  audio.addEventListener('ended', done);

  audio.addEventListener('error', () => {
    const err = audio.error;
    let msg = 'Could not load alert audio. ';
    if (err) {
      switch (err.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          msg += 'Loading was aborted.';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          msg +=
            'Network error — backend unreachable, wrong VITE_API_URL (use a URL your browser can open, e.g. http://localhost:4000, not http://backend:4000), or proxy/CORS issues.';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          msg += 'The file is not a valid audio stream or is corrupted.';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          msg +=
            'No usable audio (often 404: file missing at the configured path, or 400: path not under /data or project data/). Open DevTools → Network → request "alert-audio" to see the status code.';
          break;
        default:
          msg += `Media error code ${err.code}.`;
      }
    } else {
      msg += 'Unknown error while loading the URL.';
    }
    testSoundError.value = msg;
    done();
  });

  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch((e: unknown) => {
      if (settled) return;
      const dom = e instanceof DOMException ? e : null;
      if (dom?.name === 'NotAllowedError') {
        testSoundError.value =
          'Playback was blocked by the browser (autoplay policy). Try the button again, or check site sound permissions.';
      } else {
        const detail =
          dom?.message ||
          (e instanceof Error ? e.message : String(e));
        testSoundError.value = `Playback failed${dom?.name ? ` (${dom.name})` : ''}: ${detail}`;
      }
      done();
    });
  }
}

onMounted(() => store.fetchSettings());
</script>
