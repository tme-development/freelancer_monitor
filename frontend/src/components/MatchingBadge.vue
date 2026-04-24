<template>
  <span
    :class="[
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      colorClass,
    ]"
  >
    {{ rate !== null ? `${rate}%` : '—' }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ rate: number | null }>();

const colorClass = computed(() => {
  if (props.rate === null) return 'bg-gray-100 text-gray-600';
  if (props.rate >= 85) return 'bg-green-100 text-green-800';
  if (props.rate >= 70) return 'bg-blue-100 text-blue-800';
  if (props.rate >= 40) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
});
</script>
