import { createApp } from 'vue'
import App from './App.vue'
import { router } from './enrutador'
import { limpiarMarcaRecargaChunk } from '@/lib/nucleo/chunkReload'
import './style.css'

limpiarMarcaRecargaChunk()

createApp(App).use(router).mount('#app')
