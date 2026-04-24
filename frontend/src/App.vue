<template>
  <div class="min-h-screen">
    <nav class="bg-white border-b border-gray-200 px-6 py-3">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <router-link to="/" class="text-lg font-bold text-gray-800">
          Freelancermap Monitor
        </router-link>
        <div class="flex gap-4">
          <router-link
            to="/"
            class="text-sm text-gray-600 hover:text-gray-900"
          >
            Projects
          </router-link>
          <router-link
            to="/settings"
            class="text-sm text-gray-600 hover:text-gray-900"
          >
            Settings
          </router-link>
        </div>
      </div>
    </nav>
    <BackendStatusBar />
    <main class="max-w-7xl mx-auto px-6 py-6">
      <router-view />
    </main>
    <AudioAlert />
  </div>
</template>

<script setup lang="ts">
import AudioAlert from './components/AudioAlert.vue';
import BackendStatusBar from './components/BackendStatusBar.vue';
</script>
