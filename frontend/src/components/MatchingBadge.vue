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
  if (props.rate === null) return 'bg-gray-100 text-gray-600 dark:bg-[#3c3c3c] dark:text-[#9da0a6]';
  if (props.rate >= 85) return 'bg-green-100 text-green-800 dark:bg-emerald-500/20 dark:text-emerald-200';
  if (props.rate >= 70) return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200';
  if (props.rate >= 40) return 'bg-yellow-100 text-yellow-800 dark:bg-amber-500/20 dark:text-amber-200';
  return 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200';
});
</script>
