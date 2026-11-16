/* Ejercicios que vienen de serie en la biblioteca (volcados de los PDF de David).
 * Cada ejercicio: { id, name, group, pattern, equipment, sets, reps, rest, tempo, description, video }.
 * Al abrir la app se añaden a la biblioteca de cada usuario los que aún no tenga;
 * si se borra uno de estos, no se vuelve a añadir.
 * El material (equipment) no viene en los PDF: se ha deducido del nombre del ejercicio. */
(function () {
  'use strict';

  const list = [];
  /** Añade los ejercicios de un patrón (comparten grupo, patrón, descanso y tempo). */
  function pattern(group, prefix, name, { rest = '', tempo = '' } = {}, exercises) {
    exercises.forEach(([n, equipment, sets, reps, description, extra], i) => {
      list.push(Object.assign({
        id: `${prefix}-${i + 1}`, name: n, group, pattern: name, equipment, sets, reps, rest, tempo, description, video: '',
      }, extra || {}));
    });
  }

  const STD = (a, b, c) => `${a} (Casi-Fallo) / ${b} (Fallo) / ${c} [Top Set] (Fallo-Total)`;
  const CERCA = (a, b, c) => `${a} (Cerca-del-Fallo) / ${b} (Fallo) / ${c} [Top Set] (Fallo-Total)`;

  /* ======================= BÍCEPS ======================= */
  pattern('Bíceps', 'bic-p1', 'Patrón 1 · Curl pesado (Masa y Fuerza)', { rest: '2 a 3 min' }, [
    ['Curl en máquina (asistida/convergente)', 'Máquina', '3', STD(12, 10, 8), 'Movimiento estrictamente guiado. Aprieta 1 segundo arriba.'],
    ['Curl en polea baja (barra recta o V)', 'Polea', '3', STD(12, 10, 8), 'Codos pegados a las costillas. Tensión constante en todo el recorrido.'],
    ['Curl con barra Z', 'Barra Z', '3', STD(10, 8, '6–7'), 'Menos estrés en muñecas que la barra recta. Máxima carga.'],
    ['Curl con barra recta', 'Barra', '3', STD(10, 8, '6–7'), 'Máxima supinación. El ejercicio fundamental para el bíceps.'],
    ['Curl en banco Scott (predicador)', 'Banco Scott', '3', CERCA(12, 10, 8), 'Anula cualquier balanceo. Estiramiento total en la parte baja.'],
    ['Curl alterno con mancuernas (pesado)', 'Mancuernas', '3', CERCA(12, 10, 8), 'Control total. Codos ligeramente adelantados.'],
    ['Curl con barra Z «21» (opcional · finisher de masa)', 'Barra Z', '3', '21 [7 abajo / 7 arriba / 7 completas] (Fallo-Agotamiento)', 'Sin tambalearse. Máximo bombeo para terminar el bloque pesado.'],
  ]);
  pattern('Bíceps', 'bic-p2', 'Patrón 2 · Aislamiento y detalle (cabeza corta / pico)', { rest: '90 a 120 s' }, [
    ['Predicador en máquina', 'Máquina', '3', STD(12, 10, 8), 'Ajusta el asiento para que el codo quede fijo. Aprieta al máximo en la contracción.'],
    ['Curl en banco Scott (barra Z)', 'Barra Z y banco Scott', '3', STD(12, 10, 8), 'Controla el estiramiento abajo sin perder tensión. Prohibido rebotar al subir.'],
    ['Curl en banco Scott (a una mano con mancuerna)', 'Mancuerna y banco Scott', '3', STD(12, 10, 8), 'Excelente para corregir asimetrías y mejorar el enfoque en la cabeza corta.'],
    ['Curl concentrado (apoyado en muslo)', 'Mancuerna', '3', STD(12, 10, '7–8'), 'Gira ligeramente la muñeca hacia afuera (supinación máxima) al subir para reventar el pico.'],
    ['Curl araña (Spider Curl) en banco inclinado', 'Banco inclinado', '3', CERCA(12, 10, 8), 'Pecho apoyado en el banco, brazos colgando hacia el suelo. Anula por completo la ayuda del hombro anterior.'],
    ['Curl en polea alta (estilo «Doble Bíceps Pose»)', 'Polea', '3', CERCA(15, 12, 10), 'Brazos paralelos al suelo durante todo el movimiento. Tensión constante desde los laterales para esculpir el pico.'],
  ]);
  pattern('Bíceps', 'bic-p3', 'Patrón 3 · Estiramiento y braquial', { rest: '90 s', tempo: '3 s excéntrica (enfatizando el estiramiento) / concéntrica explosiva' }, [
    ['Curl martillo con mancuernas', 'Mancuernas', '3', STD(12, 10, 8), 'Agarre neutro. El rey para desarrollar el braquial y el braquiorradial (antebrazo). Sin impulso.'],
    ['Curl en polea baja con cuerda (agarre neutro)', 'Polea con cuerda', '3', CERCA(15, 12, '8–10'), 'La cuerda permite una trayectoria natural. Tensión constante en el braquial.'],
    ['Curl con barra tipo martillo (barra romana / agarre neutro)', 'Barra romana', '3', CERCA(12, 10, 8), 'Si no dispones de esta barra, sustituye por barra Z en sus muescas internas o polea con cuerda.'],
    ['Curl en banco inclinado (mancuernas)', 'Mancuernas y banco inclinado', '3', CERCA(12, 10, 8), 'Crucial: el brazo debe quedar por detrás de la línea del cuerpo. Mantén los hombros pegados al banco.'],
    ['Curl Bayesian en polea (de espaldas a la torre)', 'Polea', '3', CERCA(12, 10, 8), 'El cable tira del brazo hacia atrás. Máxima elongación de la cabeza larga en la fase excéntrica.'],
    ['Curl con anillas/manerales en polea baja (torso inclinado adelante)', 'Polea', '3', CERCA(12, 10, 8), 'Torso estable y codos fijos detrás de ti. Siente la separación total entre el bíceps y el hombro.'],
  ]);
  pattern('Bíceps', 'bic-p4', 'Patrón 4 · Finisher (agotamiento metabólico)', { rest: '30 a 45 s' }, [
    ['Dominadas supinas (énfasis general)', 'Peso corporal', '2', 'Al fallo (Fallo-Total)', 'En la última repetición de cada serie, mantén la contracción isométrica arriba y realiza una excéntrica (bajada) ultra lenta de 5 segundos.'],
    ['Curl con banda elástica (High-Rep Burnout)', 'Banda elástica', '2', '50 continuas (Fallo-Agotamiento)', 'Usa una banda ligera. Movimientos cortos y rápidos. El único objetivo es meter la máxima cantidad de sangre al tejido.'],
  ]);

  /* ======================= TRÍCEPS ======================= */
  const TRI_P1 = { rest: '2 a 3 min', tempo: '3 s excéntrica / concéntrica explosiva' };
  pattern('Tríceps', 'tri-p1', 'Patrón 1 · Multiarticular pesado (Masa y Fuerza base)', TRI_P1, [
    ['Fondos en máquina', 'Máquina', '3', '12 (Cerca-del-Fallo) / 10 (Casi-Fallo) / 8 [Top Set] (Fallo-Total)', 'Inclínate ligeramente hacia adelante, codos pegados, aprieta abajo y bloquea arriba.'],
    ['Fondos en paralelas', 'Peso corporal', '3', 'Al fallo técnico (Casi-Fallo)', 'Codos pegados, torso inclinado, subida explosiva. Bloquea arriba manteniendo la tensión.', { rest: '90 s' }],
    ['Press cerrado con barra', 'Barra', '3', STD(12, 10, 8), 'Movimiento sólido. Barra al esternón, subida explosiva y bajada controlada.'],
    ['Press cerrado con mancuernas (banco plano)', 'Mancuernas', '3', STD(12, 10, 8), 'Las mancuernas se tocan pero no se apoyan. No bloquees arriba para mantener la tensión constante.'],
    ['Fondos entre bancos con peso', 'Bancos y discos', '3', STD(12, 10, 8), 'Apertura cómoda. Añade discos sobre las piernas. Bajada profunda y controlada.'],
    ['Flexiones tipo diamante', 'Peso corporal', '3', 'Al fallo técnico (Casi-Fallo)', 'Codos pegados al cuerpo, ejecución lenta. No cierres las manos en exceso para proteger las muñecas.', { rest: '90 s' }],
    ['Press francés con barra Z (variante pesada)', 'Barra Z', '3', STD(12, 10, 8), 'Codos fijos, baja la barra hacia la frente. Constructor de fuerza brutal con cargas altas.'],
    ['Floor Press con barra (agarre cerrado)', 'Barra', '3', STD(10, 8, 6), 'El suelo limita el recorrido, protegiendo hombros y permitiendo mayor sobrecarga. Movimiento explosivo desde la parada.'],
  ]);
  const TRI_GENERAL_TEMPO = '2 s excéntrica / 1 s bloqueo (extensión completa obligatoria)';
  pattern('Tríceps', 'tri-p2', 'Patrón 2 · Cabeza larga (enfoque construcción)', { rest: '90 a 120 s', tempo: TRI_GENERAL_TEMPO }, [
    ['Tríceps polea baja unilateral (trasnuca)', 'Polea', '3', STD(12, 10, 8), 'Polea a altura cómoda. Subida explosiva, bajada controlada y bloqueo arriba.'],
    ['Press francés en polea alta (inclinado de espaldas)', 'Polea', '3', STD(12, 10, 8), 'Codos cerca de la cabeza (evita que se abran). Asegura 1 segundo de contracción máxima al estirar.'],
    ['Press francés con barra Z (a la nuca)', 'Barra Z', '3', STD(12, 10, 8), 'Lleva la barra ligeramente por detrás de la frente para maximizar el estiramiento. Codos fijos.'],
    ['Press francés con mancuernas', 'Mancuernas', '3', STD(12, 10, 8), 'Lleva las mancuernas a los lados de la cara. Subida explosiva y tensión constante en la bajada.'],
    ['Tríceps con cuerda (trasnuca de espaldas a la polea)', 'Polea con cuerda', '3', STD(12, 10, 8), 'Abre bien la cuerda al final del recorrido. Mantén 1 segundo de contracción máxima.'],
    ['Extensión trasnuca unilateral con mancuerna (sentado)', 'Mancuerna', '3', CERCA(12, 10, 8), 'Al estar sentado bloqueas el torso. La mano libre puede estabilizar el codo de trabajo. Estiramiento profundo.'],
    ['Extensión trasnuca a dos manos con mancuerna pesada', 'Mancuerna', '3', CERCA(12, 10, 8), 'Sujeta la mancuerna por el disco superior en forma de copa. Permite meter mucha carga de forma segura.'],
  ]);
  pattern('Tríceps', 'tri-p3', 'Patrón 3 · Cabeza lateral (enfoque herradura) · altas repeticiones', { rest: '60 a 90 s', tempo: '1 s excéntrica / 1 s bloqueo (apretando al máximo) / 1 s concéntrica' }, [
    ['Extensiones con cuerda (polea alta)', 'Polea con cuerda', '3', STD(15, 12, 10), 'Codos pegados, apertura de la cuerda abajo (cruza las manos hacia los lados) y 1 s de contracción máxima.'],
    ['Tríceps en polea alta con barra en V', 'Polea con barra en V', '3', STD(15, 12, 10), 'Codos pegados, ligera inclinación del torso hacia adelante. Bloqueo y tensión máxima abajo.'],
    ['Tríceps en polea alta con barra recta', 'Polea con barra recta', '3', STD(15, 12, 10), 'Codos pegados, inclinación ligera. Controla de forma estricta tanto la subida como la bajada.'],
    ['Extensiones en polea estilo «Kickback» (con cable, sin mancuerna)', 'Polea', '3', CERCA(18, 15, 12), 'El uso del cable garantiza tensión constante en todo el recorrido. Mantén el codo alto y fijo para un acortamiento completo.'],
    ['Extensión unilateral directa con cable (sin maneral o con tobillera/muñequera)', 'Polea', '3', STD(15, 12, 10), 'Sujeta la bola del cable o usa correillas para eliminar la fatiga del agarre. Brazo totalmente pegado al costado.'],
    ['Extensiones en polea alta de espaldas (empuje hacia adelante)', 'Polea', '3', STD(15, 12, 10), 'Brazos paralelos al suelo. Cambia el vector de fuerza tradicional, obligando a la cabeza medial a estabilizar de forma constante.'],
  ]);
  pattern('Tríceps', 'tri-p4', 'Patrón 4 · Cabeza medial (aislamiento / detalle)', { rest: '60 s', tempo: '1 s excéntrica / 2 s de contracción estricta abajo / 1 s concéntrica' }, [
    ['Tríceps polea alta unilateral con agarre invertido (supino)', 'Polea', '3', STD(18, 15, 12), 'Palma de la mano mirando hacia arriba. Crucial para activar la cabeza medial de forma directa. Mantén el hombro relajado y abajo.'],
    ['Tríceps polea alta a dos manos con barra recta (agarre invertido)', 'Polea con barra recta', '3', STD(15, 12, 10), 'Permite meter un poco más de carga que la variante unilateral. Asegura que los codos no se abran hacia los lados durante la bajada.'],
    ['Extensión unilateral cruzada en polea alta (sin maneral)', 'Polea', '3', STD(18, 15, 12), 'Agarra directamente la bola del cable. Colócate de lado a la polea y empuja en diagonal hacia el suelo, respetando la línea natural de las fibras del tríceps.'],
    ['Patada de tríceps (Kickback) en polea con agarre supino', 'Polea', '3', CERCA(18, 15, 12), 'Tronco inclinado hacia adelante y codo fijado arriba por encima de la línea de la espalda. Gira la palma hacia el techo al bloquear atrás.'],
  ]);

  window.LIBRARY_DEFAULT = list;

  /* Pautas de cada grupo muscular (se muestran en la biblioteca). */
  window.LIBRARY_GUIDES = {
    'Bíceps': [
      { title: 'Pautas básicas', items: [
        'Estructura: selecciona un solo ejercicio de cada patrón de movimiento (Patrón 1 + Patrón 2 + Patrón 3). Añade el Finisher de forma opcional al final para agotamiento completo.',
        'Volumen: máximo 3 series efectivas por ejercicio para garantizar máxima intensidad sin acumular fatiga innecesaria.',
        'Frecuencia: 1 vez por semana.',
      ] },
      { title: 'Calentamiento y activación', items: [
        'Movilidad: rotaciones de muñecas + flexión/extensión de codos.',
        'Activación específica: 2 series × 10–12 reps con peso muy ligero (lejos del fallo) usando un curl básico en polea o mancuerna.',
      ] },
      { title: 'Patrón 1 · Curl pesado (Masa y Fuerza)', items: [
        'Objetivo: sobrecarga mecánica básica. Codos fijos y sin impulso.',
        'Mecánica: codos alineados. Ejercicios con barra, mancuernas pesadas o poleas base.',
        'Volumen: 3 series × 12 / 10 / 6–8 reps (Casi-Fallo / Fallo / Top Set Fallo-Total).',
        'Descanso: 2 a 3 minutos entre series.',
        'Progresión: si logras el número máximo de repeticiones en todas las series con técnica perfecta, aumenta el peso en la siguiente sesión (incremento lineal).',
      ] },
      { title: 'Patrón 2 · Aislamiento y detalle (pico y cabeza corta)', items: [
        'Objetivo: codos adelantados. Máxima contracción y acortamiento del bíceps.',
        'Mecánica: ejercicios en banco Scott, predicador o curls concentrados.',
        'Volumen: 3 series × 12 / 10 / 8 reps (Casi-Fallo / Fallo / Top Set Fallo-Total).',
        'Descanso: 90 a 120 segundos (al ser ejercicios de mayor aislamiento mecánico).',
      ] },
      { title: 'Patrón 3 · Estiramiento y braquial (grosor y cabeza larga)', items: [
        'Objetivo: longitud muscular y grosor lateral (cabeza larga y braquial). Codos retrasados por detrás del torso o agarres neutros.',
        'Mecánica: curls inclinados, Bayesian o variantes martillo.',
        'Tempo: 3 s excéntrica (enfatizando el estiramiento) / concéntrica explosiva.',
        'Volumen: 3 series × 12–15 / 10–12 / 8–10 reps (Cerca-del-Fallo / Fallo / Top Set Fallo-Total).',
        'Descanso: 90 segundos.',
        'Regla de oro: el estiramiento es el protagonista. Si acortas el recorrido, anulas el objetivo. Jamás sacrifiques rango por peso.',
      ] },
      { title: 'Patrón 4 · Finisher (congestión final y bombeo extremo)', items: [
        'Objetivo: vaciar las reservas de glucógeno y lograr la máxima congestión sanguínea.',
        'Mecánica: ejercicios de aislamiento puro, autocarga o bandas elásticas. Opcional al final del entreno.',
        'Volumen: 2 series × al fallo o altas repeticiones (+50 reps) (Fallo-Agotamiento).',
        'Descanso: mínimo posible (30 a 45 segundos).',
        'Regla de oro: peso moderado-ligero. No busques mover kilos, busca mover sangre y provocar acidosis muscular (sensación de quemazón extrema).',
      ] },
    ],
    'Tríceps': [
      { title: 'Pautas básicas', items: [
        'Estructura: selecciona un solo ejercicio de cada patrón de movimiento (Patrón 1 + Patrón 2 + Patrón 3). Añade el Patrón 4 con solo 2 series de forma opcional al final para agotamiento completo.',
        'Volumen: máximo 3 series efectivas por ejercicio para garantizar máxima intensidad sin acumular fatiga innecesaria.',
        'Frecuencia: 1 vez por semana.',
        'Tempo general: 2 s excéntrica / 1 s bloqueo (extensión completa obligatoria). Excepción: 3 s en el Patrón Pesado.',
        'Descanso: 2 minutos entre series (2–3 minutos en los multiarticulares pesados).',
      ] },
      { title: 'Calentamiento y activación', items: [
        'Movilidad: rotaciones de muñecas + flexión/extensión de codos.',
        'Activación específica: 2 series × 10–12 reps con peso muy ligero (lejos del fallo) usando extensiones con cuerda en polea alta.',
      ] },
      { title: 'Patrón 1 · Multiarticular pesado (fuerza y masa)', items: [
        'Objetivo: construcción de fuerza y masa base. Máxima sobrecarga mecánica.',
        'Mecánica: cargas pesadas libres o asistidas. Presses cerrados, fondos en paralelas o máquina y press francés pesado.',
        'Tempo: 3 s excéntrica / concéntrica explosiva.',
        'Volumen: 3 series × 12 / 10 / 6–8 reps (Casi-Fallo / Fallo / Top Set Fallo-Total).',
        'Descanso: 2 a 3 minutos (90 segundos en variantes de peso corporal).',
      ] },
      { title: 'Patrón 2 · Cabeza larga (construcción / estiramiento)', items: [
        'Objetivo: masa general y énfasis en la porción larga mediante flexión de hombro (trabajo tras nuca / estiramiento).',
        'Mecánica: trabajo tras nuca con flexión de hombro. Poleas, barra Z o mancuernas llevando el bíceps cerca de la oreja.',
        'Volumen: 3 series × 12 / 10 / 8 reps (Casi-Fallo / Fallo / Top Set Fallo-Total).',
        'Descanso: 90 a 120 segundos.',
      ] },
      { title: 'Patrón 3 · Cabeza lateral (herradura / densidad)', items: [
        'Objetivo: masa general, detalle y densidad mediante tracción vertical hacia abajo.',
        'Mecánica: rangos altos. Extensiones verticales en polea con cuerda, barra recta o barra en V. Codos pegados a los costados.',
        'Tempo: 1 s excéntrica / 1 s bloqueo (apretando al máximo) / 1 s concéntrica.',
        'Volumen: 3 series × 15 / 12 / 10 reps (Casi-Fallo / Fallo / Top Set Fallo-Total).',
        'Descanso: 60 a 90 segundos.',
      ] },
      { title: 'Patrón 4 · Cabeza medial (aislamiento / detalle)', items: [
        'Objetivo: estimular la porción más profunda del tríceps mediante supinación (agarre invertido), máxima extensión y aislamiento unilateral.',
        'Mecánica: rangos muy altos y máximo aislamiento. Extensiones unilaterales con cable, agarres invertidos (supinos) o patadas de tríceps (Kickbacks) con cable para buscar el acortamiento completo.',
        'Tempo: 1 s excéntrica / 2 s de contracción estricta abajo / 1 s concéntrica.',
        'Volumen: 3 series × 18 / 15 / 12 reps o variantes al Fallo-Agotamiento (+20 reps).',
        'Descanso: 60 segundos.',
        'Regla de oro: cero balanceos. Olvídate de los kilos; el foco es el aislamiento puro y la tensión en el punto de bloqueo.',
      ] },
    ],
  };
})();
