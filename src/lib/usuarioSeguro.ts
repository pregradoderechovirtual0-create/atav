const CAMPOS_SENSIBLES = ['password_hash', 'claveTemporal'] as const

export function sanitizarUsuario<T extends Record<string, unknown>>(
  data: T,
  id: string,
): Omit<T, 'password_hash' | 'claveTemporal'> & { id: string } {
  const copia = { ...data, id } as Record<string, unknown>
  for (const campo of CAMPOS_SENSIBLES) {
    delete copia[campo]
  }
  return copia as Omit<T, 'password_hash' | 'claveTemporal'> & { id: string }
}
