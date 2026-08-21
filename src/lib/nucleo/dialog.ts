import { reactive } from 'vue'

export type DialogKind = 'alert' | 'confirm' | 'confirm-solicitud' | 'prompt'
export type DialogVariant = 'default' | 'danger' | 'success' | 'error'

export interface DialogDetalleItem {
  label: string
  value: string
}

export interface DialogSolicitudPayload {
  nombre: string
  cedula: string
  tipo: string
  detalles: DialogDetalleItem[]
  titulo?: string
}

export interface DialogOptions {
  title?: string
  confirmText?: string
  cancelText?: string
  variant?: DialogVariant
  inputPlaceholder?: string
  inputDefault?: string
}

export const dialogState = reactive({
  open: false,
  kind: 'alert' as DialogKind,
  title: '',
  message: '',
  variant: 'default' as DialogVariant,
  confirmText: 'Aceptar',
  cancelText: 'Cancelar',
  inputValue: '',
  inputPlaceholder: '',
  solicitudNombre: '',
  solicitudCedula: '',
  solicitudTipo: '',
  solicitudDetalles: [] as DialogDetalleItem[],
})

let resolver: ((value: boolean | string | null) => void) | null = null

const closeDialog = (value: boolean | string | null) => {
  dialogState.open = false
  dialogState.solicitudNombre = ''
  dialogState.solicitudCedula = ''
  dialogState.solicitudTipo = ''
  dialogState.solicitudDetalles = []
  const resolve = resolver
  resolver = null
  resolve?.(value)
}

export const dialog = {
  alert(message: string, options: DialogOptions = {}) {
    return new Promise<void>((resolve) => {
      resolver = () => resolve()
      Object.assign(dialogState, {
        open: true,
        kind: 'alert',
        title: options.title || 'Aviso',
        message,
        variant: options.variant || 'default',
        confirmText: options.confirmText || 'Aceptar',
        cancelText: options.cancelText || 'Cancelar',
        inputValue: '',
        inputPlaceholder: '',
        solicitudNombre: '',
        solicitudCedula: '',
        solicitudTipo: '',
        solicitudDetalles: [],
      })
    })
  },

  confirm(message: string, options: DialogOptions = {}) {
    return new Promise<boolean>((resolve) => {
      resolver = (value) => resolve(Boolean(value))
      Object.assign(dialogState, {
        open: true,
        kind: 'confirm',
        title: options.title || 'Confirmar',
        message,
        variant: options.variant || 'default',
        confirmText: options.confirmText || 'Confirmar',
        cancelText: options.cancelText || 'Cancelar',
        inputValue: '',
        inputPlaceholder: '',
        solicitudNombre: '',
        solicitudCedula: '',
        solicitudTipo: '',
        solicitudDetalles: [],
      })
    })
  },

  confirmSolicitud(payload: DialogSolicitudPayload) {
    return new Promise<boolean>((resolve) => {
      resolver = (value) => resolve(Boolean(value))
      Object.assign(dialogState, {
        open: true,
        kind: 'confirm-solicitud',
        title: payload.titulo || 'Confirmar envío',
        message: '',
        variant: 'default',
        confirmText: 'Confirmar y enviar',
        cancelText: 'Cancelar',
        inputValue: '',
        inputPlaceholder: '',
        solicitudNombre: payload.nombre,
        solicitudCedula: payload.cedula,
        solicitudTipo: payload.tipo,
        solicitudDetalles: payload.detalles,
      })
    })
  },

  prompt(message: string, options: DialogOptions = {}) {
    return new Promise<string | null>((resolve) => {
      resolver = (value) => resolve(typeof value === 'string' ? value : null)
      Object.assign(dialogState, {
        open: true,
        kind: 'prompt',
        title: options.title || 'Ingresar dato',
        message,
        variant: options.variant || 'default',
        confirmText: options.confirmText || 'Aceptar',
        cancelText: options.cancelText || 'Cancelar',
        inputValue: options.inputDefault || '',
        inputPlaceholder: options.inputPlaceholder || '',
        solicitudNombre: '',
        solicitudCedula: '',
        solicitudTipo: '',
        solicitudDetalles: [],
      })
    })
  },
}

export const acceptDialog = () => {
  if (dialogState.kind === 'prompt') {
    const value = dialogState.inputValue.trim()
    if (!value) return
    closeDialog(value)
    return
  }
  closeDialog(true)
}

export const cancelDialog = () => {
  closeDialog(
    dialogState.kind === 'confirm'
      || dialogState.kind === 'confirm-solicitud'
      || dialogState.kind === 'prompt'
      ? false
      : null,
  )
}
