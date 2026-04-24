import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import './assets/main.css';

import ProjectList from './views/ProjectList.vue';
import ProjectDetail from './views/ProjectDetail.vue';
import Settings from './views/Settings.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: ProjectList },
    { path: '/project/:id', component: ProjectDetail, props: true },
    { path: '/settings', component: Settings },
  ],
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
