/* Funciones de Firebase de la app de David Orihuela.
 *
 * resumenCliente: recibe los datos de un cliente (los prepara la app del entrenador) y devuelve un resumen
 * hecho por Claude: cómo va, puntos fuertes, qué vigilar, qué ajustaría y un mensaje para enviarle.
 *
 * - Solo la puede usar el entrenador: hay que haber entrado con la cuenta de Google (las cuentas de clientes,
 *   con correo y contraseña, quedan fuera) y, si se configura OWNER_UIDS, solo esas cuentas.
 * - La clave de Claude (ANTHROPIC_API_KEY) está en el servidor, nunca en la app. */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import Anthropic from '@anthropic-ai/sdk';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import webpush from 'web-push';

initializeApp();

const MODEL = 'claude-opus-5-5';

const SYSTEM = `Eres el asistente de David Orihuela, entrenador personal online en España. Le ayudas a revisar a sus clientes.
Recibirás en JSON los datos de un cliente: ficha, salud y lesiones, medidas (peso y cintura con fecha), dieta pautada (kcal, macros, mantenimiento),
rutina (días y ejercicios) y entrenos que el cliente ha apuntado en su diario (series con kg y repeticiones).

Método de David (tenlo en cuenta al valorar): 3 series por ejercicio — 1.ª efectiva de 12–15 repeticiones a 1 del fallo, 2.ª pesada de 6–8 al fallo total,
3.ª con el peso de la 1.ª al fallo por agotamiento; antes, 1–3 series de aproximación; descansos de 3 min en pierna y 2 min en el resto.
Progresar es subir peso o, con el mismo peso, hacer más repeticiones: aumentar la intensidad también es progreso.

Escribe en español de España, directo y práctico, para David (no para el cliente). Sé concreto: usa los números de los datos
(kg, cm, fechas, ejercicios). No inventes datos: si falta algo importante, dilo en una línea. No des consejos médicos; si hay lesiones o salud
delicada, recomienda tenerlo en cuenta o consultarlo con un profesional.

Formato (texto sencillo, sin tablas):
## Cómo va
2–4 frases con la valoración general.
## Puntos fuertes
- viñetas
## A vigilar
- viñetas (adherencia, días sin entrenar, estancamientos, series sin hacer, desvíos de peso o cintura…)
## Qué ajustaría
- viñetas con cambios concretos (dieta, rutina, cargas, descansos)
## Mensaje para el cliente
Un WhatsApp corto (3–5 líneas), cercano y motivador, en nombre de David, tuteando, con algún emoji.

Máximo unas 300 palabras en total.`;

export const resumenCliente = onCall(
  { region: 'europe-west1', timeoutSeconds: 120, memory: '512MiB', maxInstances: 3 },
  async (request) => {
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'Entra con tu cuenta de Google.');
    if (auth.token.firebase?.sign_in_provider !== 'google.com') {
      throw new HttpsError('permission-denied', 'Solo el entrenador puede usar la IA.');
    }
    const owners = (process.env.OWNER_UIDS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (owners.length && !owners.includes(auth.uid)) {
      throw new HttpsError('permission-denied', 'Esta cuenta no puede usar la IA.');
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new HttpsError('failed-precondition', 'Falta la clave de Claude (ANTHROPIC_API_KEY) en el servidor.');
    }

    const datos = request.data && request.data.cliente;
    if (!datos || typeof datos !== 'object') throw new HttpsError('invalid-argument', 'Faltan los datos del cliente.');
    const json = JSON.stringify(datos);
    if (json.length > 200000) throw new HttpsError('invalid-argument', 'Demasiados datos para un resumen.');

    const client = new Anthropic();
    let response;
    try {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        // Si Claude rechazara la petición por sus filtros de seguridad, el servidor la repite con otro modelo.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM,
        messages: [{ role: 'user', content: `Datos del cliente (hoy es ${new Date().toISOString().slice(0, 10)}):\n${json}` }],
      });
    } catch (error) {
      console.error('Error de Claude', error);
      if (error instanceof Anthropic.AuthenticationError) throw new HttpsError('failed-precondition', 'La clave de Claude no es válida.');
      if (error instanceof Anthropic.PermissionDeniedError) throw new HttpsError('failed-precondition', 'La cuenta de Claude no tiene permiso (¿saldo o facturación?).');
      if (error instanceof Anthropic.RateLimitError) throw new HttpsError('resource-exhausted', 'Demasiadas peticiones seguidas. Prueba en un minuto.');
      if (error instanceof Anthropic.BadRequestError) throw new HttpsError('invalid-argument', `Petición no válida: ${error.message}`);
      if (error instanceof Anthropic.APIError) throw new HttpsError('unavailable', 'Claude no está disponible ahora mismo. Prueba en un rato.');
      throw new HttpsError('internal', 'No se ha podido generar el resumen.');
    }

    if (response.stop_reason === 'refusal') {
      throw new HttpsError('failed-precondition', 'La IA no ha querido analizar estos datos. Revisa la ficha y prueba otra vez.');
    }
    const texto = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!texto) throw new HttpsError('internal', 'La IA no ha devuelto texto.');
    return { texto, modelo: response.model };
  },
);

/* ---------- Aviso de fin de descanso (app de entrenamiento del cliente) ----------
 *
 * Con la app en segundo plano o el móvil bloqueado, el navegador congela la página y su cronómetro deja de
 * sonar. Por eso, al empezar un descanso, la app pide aquí un aviso: la función espera lo que dura el descanso y
 * manda una notificación al móvil (Web Push), que suena y vibra aunque la app esté cerrada. Si el cliente no
 * responde, la repite dos veces más (cada 30 s). Si pausa, reinicia o pasa de serie, la app lo cancela.
 *
 * acción «clave»     → devuelve la clave pública para suscribir el móvil a las notificaciones.
 * acción «programar» → { id, segundos, sub, titulo, texto }: espera y avisa (la llamada dura lo que el descanso).
 * acción «cancelar»  → { id }: ya no avisa.
 *
 * Las claves del envío (VAPID) se crean solas la primera vez y se guardan en Firestore (sistema/vapid), a donde
 * las apps no tienen acceso. Los avisos en curso están en avisos/{id} (se borran al terminar). */
const SITE = 'https://aleuhiro7.github.io/Aplicacionweb/';
const MAX_SEGUNDOS = 480; // descanso más largo que se avisa (la función puede durar 10 min)
const REPETIR = [0, 30, 60]; // segundos tras el fin del descanso en que suena el aviso si no se responde
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let vapid = null;
async function vapidKeys() {
  if (vapid) return vapid;
  const db = getFirestore();
  const ref = db.doc('sistema/vapid');
  vapid = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return snap.data();
    const keys = webpush.generateVAPIDKeys();
    tx.set(ref, keys);
    return keys;
  });
  webpush.setVapidDetails(SITE, vapid.publicKey, vapid.privateKey);
  return vapid;
}

const cleanId = (v) => (typeof v === 'string' && /^[a-z0-9]{6,40}$/i.test(v) ? v : '');

export const avisoDescanso = onCall(
  // CPU pequeña y una llamada por instancia: esperar casi no gasta (queda dentro de la capa gratuita).
  { region: 'europe-west1', timeoutSeconds: 600, memory: '128MiB', cpu: 'gcf_gen1', concurrency: 1, maxInstances: 60 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Entra con tu cuenta.');
    const data = request.data || {};
    const accion = data.accion;
    const keys = await vapidKeys();
    if (accion === 'clave') return { clave: keys.publicKey };

    const id = cleanId(data.id);
    if (!id) throw new HttpsError('invalid-argument', 'Falta el aviso.');
    const ref = getFirestore().doc(`avisos/${id}`);

    if (accion === 'cancelar') {
      await ref.set({ uid: request.auth.uid, cancelado: true, at: FieldValue.serverTimestamp() }, { merge: true });
      return { ok: true };
    }
    if (accion !== 'programar') throw new HttpsError('invalid-argument', 'Acción desconocida.');

    const segundos = Math.round(Number(data.segundos));
    const sub = data.sub;
    if (!(segundos >= 0 && segundos <= MAX_SEGUNDOS)) throw new HttpsError('invalid-argument', 'Descanso no válido.');
    if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys) {
      throw new HttpsError('invalid-argument', 'Suscripción no válida.');
    }
    const prev = await ref.get();
    if (prev.exists && prev.data().cancelado) return { ok: false }; // se canceló antes de llegar aquí
    await ref.set({ uid: request.auth.uid, cancelado: false, at: FieldValue.serverTimestamp() });

    const payload = (n) => JSON.stringify({
      id, n,
      titulo: String(data.titulo || '¡Descanso terminado!').slice(0, 80),
      texto: String(data.texto || 'Vuelve a la app para la siguiente serie.').slice(0, 160),
    });
    const inicio = Date.now();
    let enviados = 0;
    for (const extra of REPETIR) {
      const espera = inicio + (segundos + extra) * 1000 - Date.now();
      if (espera > 0) await sleep(espera);
      const snap = await ref.get();
      if (!snap.exists || snap.data().cancelado) break;
      try {
        await webpush.sendNotification(sub, payload(enviados), { TTL: 90, urgency: 'high', topic: 'descanso' });
        enviados++;
      } catch (error) {
        console.error('No se pudo enviar el aviso', error.statusCode, error.body);
        break; // suscripción caducada o rechazada
      }
    }
    await ref.delete().catch(() => {});
    return { ok: true, enviados };
  },
);
