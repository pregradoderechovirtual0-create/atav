import { createApp } from 'vue'
import App from './App.vue'
import { router } from './enrutador'
import './style.css'

createApp(App).use(router).mount('#app')
