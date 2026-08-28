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

async function notificarSuscritosAntesDeCambio(before, after, fuente) {
  if (!after) return;
  const materiaCodigo = String(
    after.materia_codigo || after.curso || "",
  ).trim();
  if (!materiaCodigo) return;

  const cambioRelevante =
    !before ||
    [
      "estado",
      "fecha_inicio",
      "fecha_fin",
      "fechas_reprogramacion",
      "fecha",
      "hora",
      "descripcion",
    ].some(
      (campo) => JSON.stringify(before[campo]) !== JSON.stringify(after[campo]),
    );
  if (!cambioRelevante) return;

  const suscripciones = await getFirestore()
    .collection("suscripciones_materias")
    .where("materia_codigo", "==", materiaCodigo)
    .get();
  if (suscripciones.empty) return;

  const materia = String(
    after.materia_label || after.materia || after.nombre || materiaCodigo,
  );

let mensaje;

if (fuente === "solicitud") {

  if (after.estado === "aprobada") {

    mensaje =
      `El docente ${after.docente_nombre || ""} tiene una inasistencia aprobada para ${materia}. Revisa ATAV para consultar la nueva programación.`;

  } else {

    mensaje =
      `Hay una actualización docente para ${materia}. Revisa ATAV para ver los detalles.`;

  }

} else {

  mensaje =
    `Se actualizó un evento de ${materia}. Consulta el calendario de ATAV.`;

}

  await Promise.all(
    suscripciones.docs.map(async (suscripcion) => {
      const data = suscripcion.data();
      const notificacion = {
        usuario_id: data.estudiante_id,
        titulo: `Novedad en ${materiaCodigo}`,
        mensaje,
        tipo: "info",
        leida: false,
        ruta: "/estudiante/calendario",
        fecha_creacion: FieldValue.serverTimestamp(),
      };
      await getFirestore().collection("notificaciones").add(notificacion);

      const correo = String(data.correo_personal || "")
        .trim()
        .toLowerCase();
      if (correo) {
        await getFirestore()
          .collection("mail")
          .add({
            to: correo,
            message: {
              subject: `Novedad en ${materia}`,
              text: mensaje,
            },
            estudiante_id: data.estudiante_id,
            creado_en: FieldValue.serverTimestamp(),
          });
      }
    }),
  );
}

exports.notificarSuscritosSolicitud = onDocumentWritten(
  "solicitudes/{solicitudId}",
  async (event) => {
    await notificarSuscritosAntesDeCambio(
      event.data?.before.exists ? event.data.before.data() : null,
      event.data?.after.exists ? event.data.after.data() : null,
      "solicitud",
    );
  },
);

exports.notificarSuscritosEvento = onDocumentWritten(
  "eventos/{eventoId}",
  async (event) => {
    await notificarSuscritosAntesDeCambio(
      event.data?.before.exists ? event.data.before.data() : null,
      event.data?.after.exists ? event.data.after.data() : null,
      "evento",
    );
  },
);
