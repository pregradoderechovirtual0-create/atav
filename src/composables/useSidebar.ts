import { ref, computed, watch } from 'vue'

const MOBILE_BREAKPOINT = 768

const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT : false)
const mobileOpen = ref(false)
const isOpen = ref(true)
let initialized = false

function updateMobile() {
  isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT
  if (!isMobile.value) mobileOpen.value = false
}

function initSidebar() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  updateMobile()
  window.addEventListener('resize', updateMobile)
}

function setSidebarWidth() {
  if (isMobile.value) {
    document.documentElement.style.setProperty('--sidebar-width', '0px')
  } else {
    document.documentElement.style.setProperty('--sidebar-width', isOpen.value ? '240px' : '72px')
  }
}

watch([isMobile, isOpen], setSidebarWidth, { immediate: true })

watch(mobileOpen, (open) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = open && isMobile.value ? 'hidden' : ''
})

export function useSidebar() {
  initSidebar()

  const sidebarVisible = computed(() => isMobile.value ? mobileOpen.value : true)

  function toggleSidebar() {
    if (isMobile.value) {
      mobileOpen.value = !mobileOpen.value
    } else {
      isOpen.value = !isOpen.value
    }
  }

  function openMobileMenu() {
    if (isMobile.value) mobileOpen.value = true
  }

  function closeMobileMenu() {
    mobileOpen.value = false
  }

  return {
    isMobile,
    mobileOpen,
    isOpen,
    sidebarVisible,
    toggleSidebar,
    openMobileMenu,
    closeMobileMenu,
  }
}
