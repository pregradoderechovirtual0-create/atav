import { ref, computed, onMounted, onUnmounted } from 'vue'
import { collection, query, where, onSnapshot, updateDoc, doc, type Unsubscribe } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { mapNotificacionDoc, type NotificacionData } from '@/lib/dominio/notificaciones'

const notificaciones = ref<NotificacionData[]>([])
const loading = ref(true)
const currentUid = ref<string | null>(null)

let firestoreUnsub: Unsubscribe | null = null
let authUnsub: (() => void) | null = null
let listenersCount = 0

const stopFirestoreListener = () => {
  if (firestoreUnsub) {
    firestoreUnsub()
    firestoreUnsub = null
  }
}

const startFirestoreListener = (uid: string) => {
  stopFirestoreListener()
  currentUid.value = uid
  loading.value = true

  const q = query(collection(db, 'notificaciones'), where('usuario_id', '==', uid))
  firestoreUnsub = onSnapshot(
    q,
    snap => {
      notificaciones.value = snap.docs
        .map(d => mapNotificacionDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.fechaSort - a.fechaSort)
      loading.value = false
    },
    error => {
      console.error('Error escuchando notificaciones:', error)
      loading.value = false
    }
  )
}

const startAuthListener = () => {
  if (authUnsub) return
  authUnsub = onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      startFirestoreListener(user.uid)
    } else {
      stopFirestoreListener()
      currentUid.value = null
      notificaciones.value = []
      loading.value = false
    }
  })
}

const stopAuthListener = () => {
  if (authUnsub) {
    authUnsub()
    authUnsub = null
  }
  stopFirestoreListener()
  currentUid.value = null
  notificaciones.value = []
}

export function useNotificaciones() {
  onMounted(() => {
    listenersCount++
    if (listenersCount === 1) startAuthListener()
  })

  onUnmounted(() => {
    listenersCount--
    if (listenersCount === 0) stopAuthListener()
  })

  const noLeidas = computed(() => notificaciones.value.filter(n => !n.leida).length)

  const recientes = computed(() => notificaciones.value.slice(0, 5))

  const marcarLeida = async (id: string) => {
    const notif = notificaciones.value.find(n => n.id === id)
    if (!notif || notif.leida) return
    notif.leida = true
    await updateDoc(doc(db, 'notificaciones', id), { leida: true })
  }

  const marcarTodasLeidas = async () => {
    const pendientes = notificaciones.value.filter(n => !n.leida)
    pendientes.forEach(n => { n.leida = true })
    await Promise.all(
      pendientes.map(n => updateDoc(doc(db, 'notificaciones', n.id), { leida: true }))
    )
  }

  return {
    notificaciones,
    loading,
    noLeidas,
    recientes,
    marcarLeida,
    marcarTodasLeidas,
  }
}
