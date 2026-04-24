<template>
  <!--
    Non-visual by default: plays the alert sound whenever a new high-match
    alarm arrives. Only renders a small, unobtrusive pill when the browser
    blocks autoplay and the user must enable sound with a click.
  -->
  <div
    v-if="needsSoundUnlock"
    class="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-white/95 border border-green-500 text-green-700 text-xs rounded-full shadow px-3 py-1.5"
  >
    <span>Click once to enable alert sound</span>
    <button
      type="button"
      class="rounded-full bg-green-600 hover:bg-green-700 text-white px-2 py-0.5"
      @click="unlockSound"
    >
      Enable
    </button>
  </div>
  <audio ref="audioEl" :src="audioSrc" preload="auto" />
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { alertSoundPing } from '../realtime';

const API = import.meta.env.VITE_API_URL || '';

const audioEl = ref<HTMLAudioElement | null>(null);
const needsSoundUnlock = ref(false);
const pendingPlayback = ref(false);

/** Same URL as Settings "Test sound" — streams the configured server file. */
const audioSrc = computed(() => {
  const path = '/api/settings/alert-audio';
  return API ? `${API.replace(/\/$/, '')}${path}` : path;
});

watch(alertSoundPing, (next, prev) => {
  if (next <= prev) return;
  if (!audioEl.value) return;
  void playAlertSound();
});

async function playAlertSound() {
  if (!audioEl.value) return;

  const base = audioEl.value;
  const playback = base.cloneNode(true) as HTMLAudioElement;
  playback.preload = 'auto';
  playback.src = `${audioSrc.value}?t=${Date.now()}`;
  playback.currentTime = 0;

  try {
    await playback.play();
    needsSoundUnlock.value = false;
  } catch {
    // Browsers can block audio playback without user interaction.
    needsSoundUnlock.value = true;
    pendingPlayback.value = true;
  }
}

async function unlockSound() {
  if (!audioEl.value) return;
  try {
    audioEl.value.muted = true;
    audioEl.value.currentTime = 0;
    await audioEl.value.play();
    audioEl.value.pause();
    audioEl.value.currentTime = 0;
    audioEl.value.muted = false;
    needsSoundUnlock.value = false;

    if (pendingPlayback.value) {
      pendingPlayback.value = false;
      await playAlertSound();
    }
  } catch {
    needsSoundUnlock.value = true;
  }
}

onMounted(() => {
  if (!audioEl.value) return;
  audioEl.value.load();
});
</script>
