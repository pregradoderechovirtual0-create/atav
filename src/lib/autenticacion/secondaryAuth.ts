import { initializeApp, getApp, getApps } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { app as primaryApp } from '@/lib/firebase'

const SECONDARY_NAME = 'ATAVSecondaryAuth'

export const getSecondaryAuth = (): Auth => {
  const existing = getApps().find(a => a.name === SECONDARY_NAME)
  const secondaryApp = existing || initializeApp(primaryApp.options, SECONDARY_NAME)
  return getAuth(secondaryApp)
}
