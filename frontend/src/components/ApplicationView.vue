<template>
  <div v-if="application" class="space-y-4">
    <div
      v-if="!application.full_application_text && !application.motivation_paragraph"
      class="bg-gray-50 border rounded-lg p-4 text-sm text-gray-500"
    >
      No application text generated yet. Outcome tracking is available for this project.
    </div>
    <div v-if="application.motivation_paragraph" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h4 class="text-sm font-semibold text-blue-800 mb-2">Motivation</h4>
      <p class="text-sm text-blue-900 whitespace-pre-wrap">{{ application.motivation_paragraph }}</p>
    </div>

    <div v-if="application.full_application_text" class="bg-white border rounded-lg p-4">
      <h4 class="text-sm font-semibold text-gray-700 mb-2">Application Text</h4>
      <div class="text-sm text-gray-800 whitespace-pre-wrap">{{ application.full_application_text }}</div>
    </div>

    <div class="flex gap-4 text-xs text-gray-500">
      <span v-if="application.application_channel">Channel: <strong>{{ application.application_channel }}</strong></span>
      <span v-if="application.detected_language">Language: <strong>{{ application.detected_language }}</strong></span>
    </div>

    <div v-if="application.application_instructions" class="bg-gray-50 border rounded p-3">
      <p class="text-xs text-gray-600">
        <strong>How to apply:</strong> {{ application.application_instructions }}
      </p>
    </div>
  </div>
  <div v-else class="text-sm text-gray-400 italic">
    No application generated (matching rate below threshold).
  </div>
</template>

<script setup lang="ts">
defineProps<{
  application: {
    motivation_paragraph: string | null;
    application_body: string;
    full_application_text: string;
    application_channel: string;
    application_instructions: string;
    detected_language: string;
  } | null;
}>();
</script>
