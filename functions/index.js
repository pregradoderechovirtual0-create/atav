const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");

initializeApp();

const ROLES_AUTORIZADOS = new Set(["Director", "Jefa Suprema"]);

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

exports.cambiarPasswordUsuario = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
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

  const userSnap = await getFirestore().collection("usuarios").doc(cedula).get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "Usuario no encontrado.");
  }

  const userData = userSnap.data();
  let uid = userData.auth_uid;
  const email = `${cedula}@atav.com`;

  if (!uid) {
    try {
      const authUser = await getAuth().getUserByEmail(email);
      uid = authUser.uid;
      await getFirestore().collection("usuarios").doc(cedula).update({ auth_uid: uid });
    } catch {
      throw new HttpsError(
        "not-found",
        "El usuario no tiene cuenta de acceso activa.",
      );
    }
  }

  await getAuth().updateUser(uid, { password: nuevaPassword });
  await getFirestore().collection("usuarios").doc(cedula).set(
    {
      registrado: true,
      auth_uid: uid,
      password_hash: hashPassword(nuevaPassword),
      passwordTemporal: false,
      authDesincronizado: false,
      claveTemporal: FieldValue.delete(),
      requiereCambioPassword: false,
    },
    { merge: true },
  );

  return { ok: true };
});
