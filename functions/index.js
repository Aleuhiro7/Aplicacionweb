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

const MODEL = 'claude-opus-5-5';

const SYSTEM = `Eres el asistente de David Orihuela, entrenador personal online en España. Le ayudas a revisar a sus clientes.
Recibirás en JSON los datos de un cliente: ficha, salud y lesiones, medidas (peso y cintura con fecha), dieta pautada (kcal, macros, mantenimiento),
rutina (días y ejercicios) y entrenos que el cliente ha apuntado en su diario (series con kg y repeticiones).

Método de David (tenlo en cuenta al valorar): 3 series por ejercicio — 1.ª efectiva de 12–15 repeticiones a 1 del fallo, 2.ª pesada de 6–8 al fallo total,
3.ª con el peso de la 1.ª al fallo por agotamiento; antes, 1–3 series de aproximación; descansos de 3 min en pierna, 1:30 min en bíceps, tríceps y hombros, y 2 min en el resto.
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

Máximo unas 300 palabras en total.

Al final, después del mensaje, añade una línea que sea exactamente <<<SUBIR_PESO>>> y debajo, en JSON, la lista de series en las que
el cliente ya debería subir el peso según sus entrenos apuntados (por ejemplo, porque en las últimas sesiones llega o pasa del máximo de
repeticiones de esa serie con el mismo peso). Formato: [{"ejercicio": "nombre exacto del ejercicio tal como sale en la rutina, sin lo de
entre paréntesis", "serie": 1, "motivo": "frase corta con los datos"}]. "serie" es 1, 2 o 3. Solo cuando los datos lo justifiquen
claramente; si no hay ninguna, pon []. No menciones esta lista en el texto.`;

/** La lista de «subir peso» que la IA pone al final (JSON); si viene mal, se ignora. */
function subirPeso(txt) {
  const m = String(txt).match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    return JSON.parse(m[0])
      .filter((x) => x && typeof x.ejercicio === 'string' && x.ejercicio.trim() && [1, 2, 3].includes(Number(x.serie)))
      .slice(0, 20)
      .map((x) => ({ ejercicio: x.ejercicio.trim().slice(0, 120), serie: Number(x.serie), motivo: String(x.motivo || '').slice(0, 200) }));
  } catch (e) { return []; }
}

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
    const todo = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    const [texto, lista = ''] = todo.split('<<<SUBIR_PESO>>>').map((x) => x.trim());
    if (!texto) throw new HttpsError('internal', 'La IA no ha devuelto texto.');
    return { texto, modelo: response.model, subirPeso: subirPeso(lista) };
  },
);

/* ---------- Revisión por enlace (revision.html?t=CÓDIGO) ----------
 * El entrenador crea cuestionarios/{código} con kind «revision» (con su uid como dueño). El cliente, sin cuenta,
 * envía aquí su peso, su cintura y 3 fotos (frente, perfil y espalda). Se guardan con permisos de servidor:
 * las fotos, en las fotos del entrenador (users/{dueño}/photos/{id}), y el resto en el propio enlace, que queda
 * respondido (solo se puede enviar una vez). La app del entrenador lo recoge y lo pasa a la ficha del cliente. */
const POSES = ['frente', 'perfil', 'espalda'];
const MAX_FOTO = 950 * 1024; // caracteres por foto (un documento de Firestore admite 1 MB)

export const enviarRevision = onCall(
  { region: 'europe-west1', timeoutSeconds: 60, memory: '256MiB', maxInstances: 5 },
  async (request) => {
    const d = request.data || {};
    const token = typeof d.token === 'string' && /^[a-f0-9]{20,64}$/.test(d.token) ? d.token : '';
    if (!token) throw new HttpsError('invalid-argument', 'Enlace no válido.');
    const peso = Number(String(d.peso || '').replace(',', '.'));
    const cintura = Number(String(d.cintura || '').replace(',', '.'));
    if (!(peso >= 25 && peso <= 350)) throw new HttpsError('invalid-argument', 'Revisa el peso.');
    if (!(cintura >= 30 && cintura <= 250)) throw new HttpsError('invalid-argument', 'Revisa la cintura.');
    const fotos = d.fotos || {};
    for (const p of POSES) {
      const f = fotos[p];
      if (typeof f !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(f)) throw new HttpsError('invalid-argument', `Falta la foto: ${p}.`);
      if (f.length > MAX_FOTO) throw new HttpsError('invalid-argument', `La foto «${p}» es demasiado grande.`);
    }
    const nota = String(d.nota || '').slice(0, 1500);

    const db = getFirestore();
    const ref = db.doc(`cuestionarios/${token}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', 'Este enlace ya no existe. Pide uno nuevo a tu entrenador.');
      const q = snap.data();
      if (q.kind !== 'revision' || !q.owner) throw new HttpsError('failed-precondition', 'Este enlace no es de revisión.');
      if (q.answeredAt) throw new HttpsError('already-exists', 'Esta revisión ya se envió.');
      const ids = {};
      for (const p of POSES) {
        const id = `rv${token.slice(0, 10)}${p}`;
        ids[p] = id;
        tx.set(db.doc(`users/${q.owner}/photos/${id}`), { data: fotos[p], clientId: q.clientId || '', updatedAt: FieldValue.serverTimestamp() });
      }
      tx.update(ref, { revision: { peso, cintura, nota, fotos: ids }, answeredAt: FieldValue.serverTimestamp() });
    });
    return { ok: true };
  },
);

/* ---------- Asistente por voz de la app del entrenador ----------
 * La app manda la conversación (lo que David ha dicho, lo que ha respondido Claude y los resultados de las
 * herramientas) y aquí se le pasa a Claude con las herramientas de la app. Las herramientas las ejecuta la propia
 * app (los datos están allí): esta función solo hace de puente, para que la clave de Claude no salga del servidor.
 * Las que cambian algo (apuntar, crear, registrar, enviar) la app las enseña y no las hace hasta que David confirma. */
const ASIS_SYSTEM = `Eres el asistente por voz de la app de gestión de David Orihuela, entrenador personal online en España.
David te habla (a veces desde el gimnasio, con prisa) y tú le ayudas a consultar y a hacer cosas en su app usando las herramientas.

Cómo trabajar:
- Para saber de quién habla, busca primero al cliente con buscar_clientes (los nombres pueden venir mal escritos por el dictado:
  busca por el nombre de pila y elige el que mejor encaje). Si hay varios posibles, pregúntale cuál.
- Para consultar, usa las herramientas y responde con los datos. Si falta un dato para hacer algo (por ejemplo el importe),
  pregúntalo en una frase corta.
- Para tocar la rutina de un cliente, mira primero ver_rutina (y buscar_ejercicio si hay que añadir uno).
- Las herramientas que cambian algo las confirma David en pantalla antes de hacerse: llámalas directamente, sin preguntar
  «¿lo hago?». Si el resultado dice que lo canceló, no insistas.
- MUY IMPORTANTE: solo puedes cambiar algo llamando a la herramienta. Nunca digas que has hecho un cambio («hecho», «lo he movido»,
  «cambiado»…) si en este turno no has llamado a la herramienta y su resultado ha sido ok. Si no puedes hacerlo, dilo.
- No inventes datos ni hagas cosas que no te ha pedido. Las fechas, en formato AAAA-MM-DD (hoy es la fecha que te indica la app).

Cómo responder (te van a escuchar en voz alta):
- En español de España, tuteando, muy breve: 1 a 3 frases. Sin listas largas, sin tablas, sin markdown ni emojis.
- Di los números como se dicen: «78,4 kilos», «60 euros», «el viernes 28».`;

const ASIS_TOOLS = [
  { name: 'buscar_clientes', description: 'Busca clientes por nombre (o parte del nombre). Sin texto, lista todos. Devuelve id, nombre, estado y datos básicos.',
    input_schema: { type: 'object', properties: { texto: { type: 'string', description: 'Nombre o parte del nombre' }, estado: { type: 'string', enum: ['activo', 'pausa', 'inactivo', 'todos'] } } } },
  { name: 'ficha_cliente', description: 'Datos de un cliente: edad, altura, medidas recientes (peso, cintura), pagos y próximo pago, revisiones, tareas, lesiones, rutina, dieta y entrenos recientes.',
    input_schema: { type: 'object', properties: { cliente_id: { type: 'string' } }, required: ['cliente_id'] } },
  { name: 'resumen_panel', description: 'Lo pendiente en el panel: pagos pendientes o vencidos, seguimientos y revisiones, tareas, clientes sin medidas iniciales, sin cuestionario de alimentación, sin rutina o sin dieta, y entrenos nuevos.',
    input_schema: { type: 'object', properties: {} } },
  { name: 'apuntar_medida', description: 'Apunta una medida (peso y/o cintura) a un cliente. Cambia datos: David lo confirma.',
    input_schema: { type: 'object', properties: { cliente_id: { type: 'string' }, peso: { type: 'number', description: 'kg' }, cintura: { type: 'number', description: 'cm' }, fecha: { type: 'string', description: 'AAAA-MM-DD; por defecto hoy' }, notas: { type: 'string' } }, required: ['cliente_id'] } },
  { name: 'crear_tarea', description: 'Crea una tarea pendiente relacionada con un cliente. Cambia datos: David lo confirma.',
    input_schema: { type: 'object', properties: { cliente_id: { type: 'string' }, texto: { type: 'string' }, fecha: { type: 'string', description: 'AAAA-MM-DD; opcional' } }, required: ['cliente_id', 'texto'] } },
  { name: 'completar_tarea', description: 'Marca una tarea como hecha (el id sale en ficha_cliente o resumen_panel). Cambia datos: David lo confirma.',
    input_schema: { type: 'object', properties: { tarea_id: { type: 'string' } }, required: ['tarea_id'] } },
  { name: 'registrar_pago', description: 'Registra que un cliente ha pagado. Si no se dice el importe se usa su cuota. Por defecto el próximo pago queda a 1 mes. Cambia datos: David lo confirma.',
    input_schema: { type: 'object', properties: { cliente_id: { type: 'string' }, importe: { type: 'number' }, meses: { type: 'integer', description: 'Meses que cubre el pago (1, 2, 3, 6…)' }, metodo: { type: 'string', enum: ['Transferencia', 'Bizum', 'Tarjeta', 'PayPal', 'Efectivo', 'Otro'] } }, required: ['cliente_id'] } },
  { name: 'enviar_enlace', description: 'Prepara en WhatsApp un enlace para el cliente: medidas (peso, cintura y fotos; primeras medidas o revisión), alimentacion (cuestionario de alimentación), cuestionario (cuestionario inicial) o zona (invitación a su app de entrenamiento). Cambia datos: David lo confirma.',
    input_schema: { type: 'object', properties: { cliente_id: { type: 'string' }, tipo: { type: 'string', enum: ['medidas', 'alimentacion', 'cuestionario', 'zona'] } }, required: ['cliente_id', 'tipo'] } },
  { name: 'ver_rutina', description: 'La rutina de un cliente: sus días con los ejercicios (id, nombre, músculo, series, repeticiones y descanso). Úsala antes de quitar o cambiar un ejercicio.',
    input_schema: { type: 'object', properties: { cliente_id: { type: 'string' } }, required: ['cliente_id'] } },
  { name: 'buscar_ejercicio', description: 'Busca ejercicios en la biblioteca por nombre o por músculo (para añadir o sustituir uno).',
    input_schema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] } },
  { name: 'quitar_ejercicio', description: 'Quita un ejercicio de la rutina de un cliente (el id sale en ver_rutina). Cambia datos: David lo confirma.',
    input_schema: { type: 'object', properties: { cliente_id: { type: 'string' }, ejercicio_id: { type: 'string' } }, required: ['cliente_id', 'ejercicio_id'] } },
  { name: 'anadir_ejercicio', description: 'Añade a un día de la rutina de un cliente un ejercicio de la biblioteca (el id sale en buscar_ejercicio), al final del día o en lugar de otro ejercicio (sustituir_id). Cambia datos: David lo confirma.',
    input_schema: { type: 'object', properties: { cliente_id: { type: 'string' }, dia: { type: 'integer', description: 'Número del día (1, 2, 3…)' }, biblioteca_id: { type: 'string' }, sustituir_id: { type: 'string', description: 'Opcional: id del ejercicio de la rutina al que sustituye' } }, required: ['cliente_id', 'dia', 'biblioteca_id'] } },
  { name: 'mover_ejercicio', description: 'Cambia el orden de un ejercicio en la rutina de un cliente: lo pone en la posición indicada (1 = el primero) de su día, o de otro día si se indica dia. Para reordenar varios, llámala una vez por ejercicio. Cambia datos: David lo confirma.',
    input_schema: { type: 'object', properties: { cliente_id: { type: 'string' }, ejercicio_id: { type: 'string' }, posicion: { type: 'integer', description: '1 = el primero del día' }, dia: { type: 'integer', description: 'Opcional: número del día al que moverlo' } }, required: ['cliente_id', 'ejercicio_id', 'posicion'] } },
  { name: 'cambiar_ejercicio', description: 'Cambia las series, las repeticiones o el descanso de un ejercicio de la rutina de un cliente. Cambia datos: David lo confirma.',
    input_schema: { type: 'object', properties: { cliente_id: { type: 'string' }, ejercicio_id: { type: 'string' }, series: { type: 'string' }, repeticiones: { type: 'string' }, descanso: { type: 'string', description: 'Ej.: 2 min, 1:30 min' } }, required: ['cliente_id', 'ejercicio_id'] } },
  { name: 'abrir', description: 'Abre una pantalla de la app: el panel, los pagos, o la ficha de un cliente en una pestaña (resumen, progreso, rutina, dieta, fotos, pagos, entrenos).',
    input_schema: { type: 'object', properties: { pantalla: { type: 'string', enum: ['panel', 'pagos', 'cliente'] }, cliente_id: { type: 'string' }, pestana: { type: 'string' } }, required: ['pantalla'] } },
];

/** Solo el entrenador: cuenta de Google y, si se ha configurado OWNER_UIDS, solo esas cuentas. */
function soloEntrenador(request) {
  const auth = request.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'Entra con tu cuenta de Google.');
  if (auth.token.firebase?.sign_in_provider !== 'google.com') throw new HttpsError('permission-denied', 'Solo el entrenador puede usar la IA.');
  const owners = (process.env.OWNER_UIDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (owners.length && !owners.includes(auth.uid)) throw new HttpsError('permission-denied', 'Esta cuenta no puede usar la IA.');
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpsError('failed-precondition', 'Falta la clave de Claude (ANTHROPIC_API_KEY) en el servidor.');
}

export const asistente = onCall(
  { region: 'europe-west1', timeoutSeconds: 60, memory: '256MiB', maxInstances: 3 },
  async (request) => {
    soloEntrenador(request);
    const messages = request.data && request.data.messages;
    if (!Array.isArray(messages) || !messages.length || messages.length > 60) throw new HttpsError('invalid-argument', 'Conversación no válida.');
    if (JSON.stringify(messages).length > 300000) throw new HttpsError('invalid-argument', 'La conversación es demasiado larga. Empieza una nueva.');
    const hoy = String((request.data && request.data.hoy) || new Date().toISOString().slice(0, 10)).slice(0, 40);
    const client = new Anthropic();
    let response;
    try {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' }, // equilibrio: rápido, pero sin saltarse las herramientas
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: `${ASIS_SYSTEM}\n\nHoy es ${hoy}.`,
        tools: ASIS_TOOLS,
        messages,
      });
    } catch (error) {
      console.error('Error de Claude (asistente)', error);
      if (error instanceof Anthropic.AuthenticationError) throw new HttpsError('failed-precondition', 'La clave de Claude no es válida.');
      if (error instanceof Anthropic.PermissionDeniedError) throw new HttpsError('failed-precondition', 'La cuenta de Claude no tiene permiso (¿saldo o facturación?).');
      if (error instanceof Anthropic.RateLimitError) throw new HttpsError('resource-exhausted', 'Demasiadas peticiones seguidas. Prueba en un minuto.');
      if (error instanceof Anthropic.BadRequestError) throw new HttpsError('invalid-argument', `Petición no válida: ${error.message}`);
      if (error instanceof Anthropic.APIError) throw new HttpsError('unavailable', 'Claude no está disponible ahora mismo. Prueba en un rato.');
      throw new HttpsError('internal', 'No se ha podido responder.');
    }
    // Se devuelve el contenido tal cual (los bloques de pensamiento incluidos): la app lo reenvía sin tocar en el siguiente turno.
    return { content: response.content, stop_reason: response.stop_reason };
  },
);
