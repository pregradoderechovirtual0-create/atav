const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");

initializeApp();

const db = getFirestore();

const ROLES_AUTORIZADOS = new Set(["Director", "Jefa Suprema"]);

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

async function obtenerOActualizarUidEmail(cedula, nuevaPassword) {
  const email = `${cedula}@atav.com`;

  try {
    const existing = await getAuth().getUserByEmail(email);
    await getAuth().updateUser(existing.uid, { password: nuevaPassword });
    return existing.uid;
  } catch (err) {
    if (err.code !== "auth/user-not-found") {
      throw err;
    }
  }

  const created = await getAuth().createUser({
    email,
    password: nuevaPassword,
    emailVerified: true,
  });
  return created.uid;
}

exports.cambiarPasswordUsuario = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Debes iniciar sesión como Director para restablecer contraseñas.",
    );
  }

  const cedula = String(request.data?.cedula || "").trim();
  const nuevaPassword = String(request.data?.nuevaPassword || "");

  if (!cedula || !/^\d+$/.test(cedula)) {
    throw new HttpsError("invalid-argument", "Cédula inválida.");
  }

  if (!nuevaPassword || nuevaPassword.length < 6) {
    throw new HttpsError(
      "invalid-argument",
      "La contraseña debe tener mínimo 6 caracteres.",
    );
  }

  const callerEmail = request.auth.token.email || "";
  const callerCedula = callerEmail.split("@")[0];

  if (!/^\d+$/.test(callerCedula)) {
    throw new HttpsError(
      "permission-denied",
      "Sesión inválida. Cierra sesión e ingresa de nuevo como Director.",
    );
  }

  const callerSnap = await getFirestore()
    .collection("usuarios")
    .doc(callerCedula)
    .get();

  if (!callerSnap.exists || !ROLES_AUTORIZADOS.has(callerSnap.data().rol)) {
    throw new HttpsError(
      "permission-denied",
      "No tienes permiso para cambiar contraseñas.",
    );
  }

  const userSnap = await getFirestore()
    .collection("usuarios")
    .doc(cedula)
    .get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "Usuario no encontrado.");
  }

  let uid;
  try {
    uid = await obtenerOActualizarUidEmail(cedula, nuevaPassword);
  } catch (err) {
    console.error("cambiarPasswordUsuario auth error:", err);
    throw new HttpsError(
      "internal",
      "No se pudo actualizar la cuenta de acceso en Firebase Authentication.",
    );
  }

  await getFirestore()
    .collection("usuarios")
    .doc(cedula)
    .set(
      {
        registrado: true,
        auth_uid: uid,
        password_hash: hashPassword(nuevaPassword),
        passwordTemporal: true,
        authDesincronizado: false,
        claveTemporal: FieldValue.delete(),
        requiereCambioPassword: false,
      },
      { merge: true },
    );

  return { ok: true, uid };
});

async function notificarSuscritosAntesDeCambio(before, after) {

  if (!after) return;

  if (
    before &&
    before.estado === after.estado
  ) {
    return;
  }

  if (after.estado !== "aprobada") {
    return;
  }


  const materiaCodigo = after.materia_codigo;

  if (!materiaCodigo) {
    console.log("Solicitud sin materia_codigo");
    return;
  }


  const estudiantes = await db
    .collection("suscripciones_materias")
    .where(
      "materia_codigo",
      "==",
      materiaCodigo
    )
    .get();


  if (estudiantes.empty) {
    console.log("No hay estudiantes inscritos");
    return;
  }


  const batch = db.batch();


estudiantes.forEach(async (doc) => {

  const estudiante = doc.data();


  const usuarioSnap = await db
    .collection("usuarios")
    .doc(estudiante.estudiante_id)
    .get();


  if (!usuarioSnap.exists) {
    console.log("Usuario no encontrado:", estudiante.estudiante_id);
    return;
  }


  const usuario = usuarioSnap.data();


  const ref = db
    .collection("notificaciones")
    .doc();


  batch.set(ref, {

    usuario_id: usuario.auth_uid,

    titulo:
      "Inasistencia docente aprobada",

    mensaje:
      `El docente ${after.docente_nombre || ""} tiene una inasistencia aprobada para la materia ${after.materia_label || materiaCodigo}.`,

    tipo:
      "inasistencia_docente",

    materia_codigo:
      materiaCodigo,

    solicitud_id:
      event.params.solicitudId,

    leida:
      false,

    ruta:
      "/estudiante/calendario",

    fecha_creacion:
      FieldValue.serverTimestamp()

  });

});


  await batch.commit();


  console.log(
    "Notificaciones enviadas a estudiantes"
  );

}

exports.notificarSuscritosSolicitud = onDocumentWritten(
  "solicitudes/{solicitudId}",
  async (event) => {

    await notificarSuscritosAntesDeCambio(
      event.data.before.exists
        ? event.data.before.data()
        : null,

      event.data.after.exists
        ? event.data.after.data()
        : null
    );

  }
);