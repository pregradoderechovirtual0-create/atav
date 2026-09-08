/**
 * Crea el usuario director en Firebase Auth + Firestore.
 * Uso: npm run seed:director
 */
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomBytes, pbkdf2Sync } from 'node:crypto'

const PROJECT_ID = 'atav-48646'
const API_KEY = 'AIzaSyABGRzmys3y7fv1wbGf_bJ_yfgjxzwTsUM'
const FIREBASE_CLI_CLIENT_ID =
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'

const USUARIO = {
  cedula: '1',
  nombre: 'usuario',
  correo: 'director@usc.edu.co',
  rol: 'Director',
  password: 'admin123',
  emailAuth: '1@atav.com',
}

function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

function firebaseToolsConfigPath() {
  const candidates = [
    join(homedir(), '.config', 'configstore', 'firebase-tools.json'),
    join(process.env.APPDATA || '', 'configstore', 'firebase-tools.json'),
  ]
  return candidates.find(p => existsSync(p))
}

async function obtenerTokenFirebaseCli() {
  const path = firebaseToolsConfigPath()
  if (!path) return null

  const cfg = JSON.parse(readFileSync(path, 'utf8'))
  const tokens = cfg.tokens
  if (!tokens?.refresh_token) return null

  if (tokens.access_token && tokens.expires_at > Date.now() + 60_000) {
    return tokens.access_token
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: FIREBASE_CLI_CLIENT_ID,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok) return null
  return data.access_token
}

async function crearOActualizarAuth() {
  const signIn = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: USUARIO.emailAuth,
        password: USUARIO.password,
        returnSecureToken: true,
      }),
    },
  )
  const signed = await signIn.json()
  if (signIn.ok) return signed.localId

  const signUp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: USUARIO.emailAuth,
        password: USUARIO.password,
        returnSecureToken: true,
      }),
    },
  )
  const data = await signUp.json()
  if (!signUp.ok) {
    throw new Error(data.error?.message || 'No se pudo crear Auth')
  }
  return data.localId
}

async function guardarFirestore(uid, accessToken) {
  const password_hash = hashPassword(USUARIO.password)
  const now = new Date().toISOString()

  const body = {
    fields: {
      cedula: { stringValue: USUARIO.cedula },
      nombre: { stringValue: USUARIO.nombre },
      correo: { stringValue: USUARIO.correo },
      rol: { stringValue: USUARIO.rol },
      registrado: { booleanValue: true },
      auth_uid: { stringValue: uid },
      password_hash: { stringValue: password_hash },
      passwordTemporal: { booleanValue: false },
      requiereCambioPassword: { booleanValue: false },
      createdAt: { timestampValue: now },
    },
  }

  const url =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/usuarios/${USUARIO.cedula}`

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const result = await res.json()
  if (!res.ok) {
    throw new Error(result.error?.message || 'No se pudo escribir en Firestore')
  }
}

async function main() {
  const uid = await crearOActualizarAuth()
  const token = await obtenerTokenFirebaseCli()
  if (!token) {
    throw new Error(
      'Inicia sesión en Firebase CLI (firebase login) y vuelve a ejecutar npm run seed:director',
    )
  }
  await guardarFirestore(uid, token)

  console.log('')
  console.log('Director creado correctamente:')
  console.log(`  Cédula:     ${USUARIO.cedula}`)
  console.log(`  Nombre:     ${USUARIO.nombre}`)
  console.log(`  Contraseña: ${USUARIO.password}`)
  console.log('  Entra con cédula 1 y contraseña admin123')
  console.log('')
}

main().catch((err) => {
  console.error('Error:', err.message || err)
  process.exit(1)
})
