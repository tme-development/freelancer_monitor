<template>
  <div class="border rounded-lg p-3 mb-2" :class="borderClass">
    <div class="flex items-start gap-2">
      <span class="mt-0.5 text-sm" :class="iconClass">{{ icon }}</span>
      <div class="flex-1">
        <p class="text-sm font-medium text-gray-900">
          {{ match.requirement?.requirement_text }}
          <span
            v-if="match.requirement?.is_must_have"
            class="ml-1 text-xs text-red-600 font-semibold"
          >
            MUST
          </span>
        </p>
        <p v-if="match.explanation" class="text-xs text-gray-600 mt-1">
          {{ match.explanation }}
        </p>
        <p
          v-if="match.profile_evidence"
          class="text-xs text-gray-500 mt-1 italic"
        >
          Evidence: {{ match.profile_evidence }}
        </p>
      </div>
      <span
        class="text-xs px-2 py-0.5 rounded"
        :class="typeClass"
      >
        {{ match.match_type }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  match: {
    match_type: string;
    profile_evidence: string;
    explanation: string;
    requirement?: {
      requirement_text: string;
      is_must_have: boolean;
    };
  };
}>();

const icon = computed(() => {
  if (props.match.match_type === 'direct') return '✓';
  if (props.match.match_type === 'alternative') return '~';
  return '✗';
});

const iconClass = computed(() => {
  if (props.match.match_type === 'direct') return 'text-green-600';
  if (props.match.match_type === 'alternative') return 'text-yellow-600';
  return 'text-red-500';
});

const borderClass = computed(() => {
  if (props.match.match_type === 'direct') return 'border-green-200 bg-green-50/50';
  if (props.match.match_type === 'alternative') return 'border-yellow-200 bg-yellow-50/50';
  return 'border-red-200 bg-red-50/50';
});

const typeClass = computed(() => {
  if (props.match.match_type === 'direct') return 'bg-green-100 text-green-700';
  if (props.match.match_type === 'alternative') return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
});
</script>
