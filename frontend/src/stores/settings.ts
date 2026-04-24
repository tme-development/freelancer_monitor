import { defineStore } from 'pinia';
import { ref } from 'vue';

const API = import.meta.env.VITE_API_URL || '';

export interface SettingItem {
  id: number;
  key_name: string;
  value_text: string;
  value_type: string;
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<SettingItem[]>([]);

  async function fetchSettings() {
    const res = await fetch(`${API}/api/settings`);
    settings.value = await res.json();
  }

  async function updateSetting(key: string, value: string) {
    await fetch(`${API}/api/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    await fetchSettings();
  }

  function getSetting(key: string): string {
    return settings.value.find((s) => s.key_name === key)?.value_text || '';
  }

  return { settings, fetchSettings, updateSetting, getSetting };
});
