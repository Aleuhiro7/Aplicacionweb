/* Ejercicios que vienen de serie en la biblioteca: bíceps y tríceps de los PDF de David; el resto,
 * catálogo de musculación con mancuernas, barra, máquinas de discos, máquinas guiadas y poleas.
 * Cada ejercicio: { id, name, group, pattern, equipment, sets, reps, rest, tempo, description, video }.
 * Al abrir la app se añaden a la biblioteca de cada usuario los que aún no tenga;
 * si se borra uno de estos, no se vuelve a añadir.
 * El material (equipment) no viene en los PDF: se ha deducido del nombre del ejercicio. */
(function () {
  'use strict';

  const list = [];
  /* Método de David: el mismo en todos los ejercicios de la biblioteca (las series y repeticiones de cada
   * lista de abajo ya no se usan; se dejan como referencia). «3 series × …» se muestra junto. */
  const METHOD_SETS = '3';
  /* Descanso: 3 minutos en todo lo de pierna, 1:30 en bíceps, tríceps y hombros, y 2 minutos en el resto. */
  const LEGS = ['Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Aductores', 'Gemelos'];
  const SHORT = ['Bíceps', 'Tríceps', 'Hombros']; // músculos pequeños: 1:30 min
  const restOf = (group) => (LEGS.includes(group) ? '3 min' : SHORT.includes(group) ? '1:30 min' : '2 min');
  const METHOD_REPS = '12–15 a 1 del fallo / 6–8 pesada al fallo / peso de la 1.ª al fallo';
  /** Añade los ejercicios de un patrón (comparten grupo, patrón, descanso y tempo). */
  function pattern(group, prefix, name, { rest = '', tempo = '' } = {}, exercises) {
    let k = 0; // los ejercicios con id propio (extra.id) no cambian la numeración de los demás
    exercises.forEach(([n, equipment, sets, reps, description, extra]) => {
      const own = extra && extra.id;
      if (!own) k++;
      list.push(Object.assign({
        id: own || `${prefix}-${k}`, name: n, group, pattern: name, equipment, sets: METHOD_SETS, reps: METHOD_REPS, rest: restOf(group), tempo, description, video: '',
      }, extra || {}, { sets: METHOD_SETS, reps: METHOD_REPS, rest: restOf(group) }));
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

  /* ======================= PECHO ======================= */
  pattern('Pecho', 'pec-p1', 'Patrón 1 · Press horizontal pesado (Masa y Fuerza)', { rest: '2 a 3 min', tempo: '3 s excéntrica / concéntrica explosiva' }, [
    ['Press de banca con barra', 'Barra', '3', STD(10, 8, '6–7'), 'Escápulas retraídas y pies firmes. Barra a la parte baja del pecho, codos a unos 45°. El básico de fuerza.'],
    ['Press de banca con mancuernas', 'Mancuernas', '3', STD(12, 10, 8), 'Mayor recorrido que con barra. Baja hasta notar el estiramiento del pecho sin perder la retracción escapular.'],
    ['Press plano en máquina de discos (convergente)', 'Máquina de discos', '3', STD(12, 10, 8), 'Trayectoria convergente que acompaña la aducción del brazo. Permite llegar al fallo con seguridad.'],
    ['Press plano en multipower (Smith)', 'Multipower', '3', STD(10, 8, '6–7'), 'Banco colocado para que la barra caiga a la altura del esternón. Muy útil para sobrecargar sin compañero.'],
    ['Press de pecho en máquina sentado', 'Máquina', '3', STD(12, 10, 8), 'Asiento a la altura del pecho medio. Empuja sin despegar la espalda del respaldo.'],
    ['Press con mancuernas agarre neutro (martillo)', 'Mancuernas', '3', CERCA(12, 10, 8), 'Palmas enfrentadas y codos más pegados. Más amable con el hombro y mucho trabajo de pecho y tríceps.'],
  ]);
  pattern('Pecho', 'pec-p2', 'Patrón 2 · Porción superior (clavicular)', { rest: '2 min', tempo: '3 s excéntrica / concéntrica explosiva' }, [
    ['Press inclinado con barra', 'Barra', '3', STD(10, 8, '6–7'), 'Banco a 30°. Barra a la parte alta del pecho, bajo las clavículas. Codos ligeramente cerrados.'],
    ['Press inclinado con mancuernas', 'Mancuernas', '3', STD(12, 10, 8), 'Banco a 30°. Baja profundo con las mancuernas a la altura del pecho alto y sube convergiendo sin chocar.'],
    ['Press inclinado en multipower (Smith)', 'Multipower', '3', STD(10, 8, '6–7'), 'Trayectoria fija que permite cargar mucho la porción superior con total estabilidad.'],
    ['Press inclinado en máquina de discos', 'Máquina de discos', '3', STD(12, 10, 8), 'Convergente e inclinado. Ideal para llevar la porción clavicular al fallo total con seguridad.'],
    ['Aperturas inclinadas con mancuernas', 'Mancuernas', '3', CERCA(15, 12, 10), 'Codos semiflexionados y fijos. Abre hasta el estiramiento y cierra como si abrazaras un árbol.'],
    ['Cruce de poleas de abajo arriba (low to high)', 'Polea', '3', CERCA(15, 12, 10), 'Poleas abajo. Lleva las manos hacia arriba y al centro, a la altura de la barbilla, apretando el pecho alto.'],
  ]);
  pattern('Pecho', 'pec-p3', 'Patrón 3 · Porción inferior y fondos', { rest: '2 min' }, [
    ['Press declinado con barra', 'Barra', '3', STD(10, 8, '6–7'), 'Banco declinado 15–20°. Barra a la parte baja del pecho. Mucha carga con poco estrés en el hombro.'],
    ['Press declinado con mancuernas', 'Mancuernas', '3', STD(12, 10, 8), 'Recorrido amplio y convergencia arriba. Controla la bajada para no perder la posición.'],
    ['Press declinado en máquina de discos', 'Máquina de discos', '3', STD(12, 10, 8), 'Empuje hacia abajo y adelante. Muy estable para sobrecargar la porción esternal inferior.'],
    ['Fondos en paralelas (énfasis pecho)', 'Peso corporal', '3', 'Al fallo técnico (Casi-Fallo)', 'Torso inclinado adelante y codos algo abiertos. Baja hasta notar el estiramiento del pecho. Lastra con disco si son fáciles.', { rest: '90 s' }],
    ['Fondos en máquina (asistida o de discos)', 'Máquina', '3', CERCA(12, 10, 8), 'Inclina el tronco adelante para cargar el pecho más que el tríceps.'],
    ['Cruce de poleas de arriba abajo (high to low)', 'Polea', '3', CERCA(15, 12, 10), 'Poleas altas. Lleva las manos hacia abajo y al centro, a la altura de la cadera, apretando 1 s.'],
  ]);
  pattern('Pecho', 'pec-p4', 'Patrón 4 · Aislamiento y estiramiento (aperturas)', { rest: '90 s', tempo: '2 s excéntrica / 1 s de estiramiento abajo / 1 s concéntrica' }, [
    ['Aperturas con mancuernas en banco plano', 'Mancuernas', '3', CERCA(15, 12, 10), 'Codos semiflexionados fijos. Baja hasta la línea del pecho y vuelve sin chocar las mancuernas.'],
    ['Aperturas en máquina (contractor / pec deck)', 'Máquina', '3', STD(15, 12, 10), 'Asiento con los manerales a la altura del pecho medio. Aprieta 1 s cuando las manos se juntan.'],
    ['Cruce de poleas a media altura', 'Polea', '3', STD(15, 12, 10), 'Paso adelante y ligera inclinación. Cierra las manos al frente del esternón con tensión constante.'],
    ['Aperturas en polea baja tumbado en banco', 'Polea y banco', '3', CERCA(15, 12, 10), 'Banco plano entre dos poleas bajas. Tensión máxima en el estiramiento, donde la mancuerna no llega.'],
    ['Aperturas unilaterales en polea', 'Polea', '3', CERCA(15, 12, 10), 'Un brazo cada vez para cruzar la línea media y acortar al máximo. Corrige asimetrías.'],
    ['Pullover con mancuerna (énfasis pecho)', 'Mancuerna', '3', CERCA(15, 12, 10), 'Tumbado transversal o a lo largo del banco. Codos ligeramente flexionados y baja por detrás de la cabeza.'],
  ]);
  pattern('Pecho', 'pec-p5', 'Patrón 5 · Finisher (congestión)', { rest: '30 a 45 s' }, [
    ['Flexiones (push-ups)', 'Peso corporal', '2', 'Al fallo (Fallo-Total)', 'Cuerpo en bloque, pecho al suelo y bloqueo arriba. Eleva los pies para cargar la porción superior.'],
    ['Flexiones con déficit (manos sobre discos o agarres)', 'Peso corporal y discos', '2', 'Al fallo (Fallo-Total)', 'Las manos elevadas permiten bajar más y estirar el pecho al máximo.'],
    ['Press con mancuernas juntas (squeeze press)', 'Mancuernas', '2', '15–20 (Fallo-Agotamiento)', 'Aprieta las mancuernas una contra otra durante todo el recorrido. Peso ligero, máxima contracción.'],
    ['Press Svend con disco', 'Disco', '2', '20 (Fallo-Agotamiento)', 'Disco entre las palmas a la altura del pecho; empuja al frente apretándolo con fuerza.'],
  ]);

  /* ======================= ESPALDA ======================= */
  pattern('Espalda', 'esp-p1', 'Patrón 1 · Tracción vertical (amplitud del dorsal)', { rest: '2 a 3 min', tempo: '3 s excéntrica / concéntrica explosiva' }, [
    ['Dominadas pronas (lastradas si es posible)', 'Peso corporal', '3', STD(10, 8, '6–7'), 'Agarre algo más ancho que los hombros. Lleva el pecho a la barra y baja hasta extender los brazos.'],
    ['Dominadas neutras o supinas', 'Peso corporal', '3', STD(10, 8, '6–7'), 'Agarre estrecho; el dorsal trabaja con más recorrido. Codos hacia las costillas al subir.'],
    ['Jalón al pecho agarre prono abierto', 'Polea', '3', STD(12, 10, 8), 'Pecho alto, ligera inclinación atrás. Tira con los codos hacia abajo, no con las manos.'],
    ['Jalón al pecho agarre neutro estrecho', 'Polea con triángulo', '3', STD(12, 10, 8), 'Mayor recorrido y más fuerza. Lleva el triángulo a la parte alta del pecho.'],
    ['Jalón en máquina de discos (convergente)', 'Máquina de discos', '3', STD(12, 10, 8), 'Trayectoria en arco que sigue la del dorsal. Se puede hacer a una mano.'],
    ['Jalón unilateral en polea alta (de rodillas o sentado)', 'Polea', '3', CERCA(12, 10, 8), 'Un brazo cada vez, tirando del codo hacia la cadera. Máximo estiramiento arriba.'],
    ['Jalón supino (agarre invertido)', 'Polea', '3', CERCA(12, 10, 8), 'Agarre a la anchura de los hombros con las palmas hacia ti. Mucho dorsal bajo.'],
  ]);
  pattern('Espalda', 'esp-p2', 'Patrón 2 · Remo horizontal pesado (grosor)', { rest: '2 a 3 min', tempo: '2 s excéntrica / 1 s de contracción arriba' }, [
    ['Remo con barra (torso inclinado)', 'Barra', '3', STD(10, 8, '6–7'), 'Torso a unos 45°, espalda neutra. Barra al ombligo y escápulas juntas arriba.'],
    ['Remo Pendlay', 'Barra', '3', STD(8, 6, 5), 'Torso paralelo al suelo; la barra vuelve al suelo en cada repetición. Tirón explosivo.'],
    ['Remo con barra en T (landmine o máquina de discos)', 'Máquina de discos', '3', STD(10, 8, '6–7'), 'Pecho apoyado si la máquina lo permite. Agarre neutro y tirón hacia el abdomen.'],
    ['Remo con mancuerna a una mano (apoyado en banco)', 'Mancuerna', '3', STD(12, 10, 8), 'Rodilla y mano en el banco. Lleva el codo hacia la cadera y estira bien abajo.'],
    ['Remo en máquina de discos con apoyo pectoral', 'Máquina de discos', '3', STD(12, 10, 8), 'El pecho apoyado anula el impulso. Ideal para llegar al fallo sin cargar la zona lumbar.'],
    ['Remo sentado en polea baja (triángulo)', 'Polea', '3', STD(12, 10, 8), 'Torso erguido; estira adelante sin redondear y tira del triángulo hasta el abdomen.'],
    ['Remo sentado en máquina', 'Máquina', '3', STD(12, 10, 8), 'Pecho contra el apoyo y espalda neutra. Tira de los agarres llevando los codos atrás pegados al cuerpo y junta las escápulas al final; vuelve estirando sin despegar el pecho.', { id: 'esp-p2-maq' }],
    ['Remo sentado en polea con barra (agarre abierto)', 'Polea con barra', '3', STD(12, 10, 8), 'Barra recta con agarre prono más ancho que los hombros. Torso erguido; tira hacia la parte baja del pecho con los codos abiertos para cargar espalda alta y dorsal, y estira adelante sin redondear.', { id: 'esp-p2-pab' }],
    ['Remo con pecho apoyado en banco inclinado (mancuernas)', 'Mancuernas y banco inclinado', '3', CERCA(12, 10, 8), 'Banco a 30–45°. Sin balanceo posible: trabajo estricto de dorsal y espalda media.'],
    ['Remo Meadows (landmine a una mano)', 'Barra (landmine)', '3', CERCA(12, 10, 8), 'De lado a la barra, agarre por el extremo. Gran estiramiento y tirón hacia la cadera.'],
    ['Remo en multipower', 'Multipower', '3', STD(10, 8, '6–7'), 'Trayectoria fija; permite concentrarse en tirar con los codos sin preocuparse del equilibrio.'],
  ]);
  pattern('Espalda', 'esp-p3', 'Patrón 3 · Dorsal en aislamiento y estiramiento', { rest: '90 s', tempo: '2 s excéntrica / 1 s de estiramiento / 1 s de contracción' }, [
    ['Pullover en polea alta con brazos rectos (cuerda o barra)', 'Polea', '3', STD(15, 12, 10), 'Brazos casi extendidos; lleva las manos de la altura de la cabeza a los muslos sin mover el torso.'],
    ['Pullover con mancuerna (énfasis dorsal)', 'Mancuerna', '3', CERCA(12, 10, 8), 'Codos más cerrados y cadera algo baja para estirar el dorsal en la bajada.'],
    ['Pullover en máquina', 'Máquina', '3', STD(12, 10, 8), 'Dorsal aislado sin intervención del bíceps. Recorrido completo.'],
    ['Remo unilateral en polea baja hacia la cadera', 'Polea', '3', CERCA(15, 12, 10), 'Tira en arco del codo hacia el bolsillo trasero. Énfasis en la parte baja del dorsal.'],
    ['Jalón unilateral con brazo estirado en polea', 'Polea', '3', CERCA(15, 12, 10), 'De lado a la polea; baja el brazo recto en arco hacia la cadera. Conexión mente-músculo máxima.'],
  ]);
  pattern('Espalda', 'esp-p4', 'Patrón 4 · Espalda alta y trapecio', { rest: '90 s', tempo: '1 s de contracción arriba (encogimientos 2 s)' }, [
    ['Encogimientos con barra', 'Barra', '3', STD(15, 12, 10), 'Sube los hombros hacia las orejas sin rotarlos y aguanta arriba 2 s.'],
    ['Encogimientos con mancuernas', 'Mancuernas', '3', STD(15, 12, 10), 'Mancuernas a los lados permiten un recorrido más natural.'],
    ['Encogimientos en multipower o máquina de discos', 'Multipower', '3', STD(15, 12, 10), 'Mucha carga con estabilidad. Ligera inclinación adelante para el trapecio medio.'],
    ['Encogimientos en polea baja', 'Polea', '3', CERCA(15, 12, 10), 'Tensión constante, sobre todo en la parte baja del recorrido.'],
    ['Remo con codos abiertos en máquina o polea (espalda alta)', 'Máquina', '3', CERCA(12, 10, 8), 'Codos a la altura de los hombros: romboides, trapecio medio y deltoides posterior.'],
  ]);
  pattern('Espalda', 'esp-p5', 'Patrón 5 · Zona lumbar (erectores)', { rest: '2 a 3 min' }, [
    ['Peso muerto convencional', 'Barra', '3', STD(8, 6, 5), 'Barra pegada a las piernas, espalda neutra y empuje del suelo con las piernas. El básico de la cadena posterior.'],
    ['Rack pull (peso muerto desde soportes)', 'Barra', '3', STD(8, 6, 5), 'Desde la altura de la rodilla. Mucha carga para erectores y trapecio con menos fatiga.'],
    ['Hiperextensiones en banco romano (con disco)', 'Banco romano y disco', '3', CERCA(15, 12, 10), 'Sube hasta alinear el cuerpo, sin hiperextender. Disco al pecho para progresar.', { rest: '90 s' }],
    ['Buenos días con barra', 'Barra', '3', CERCA(12, 10, 8), 'Barra en la espalda, rodillas algo flexionadas. Bisagra de cadera con espalda neutra.'],
  ]);

  /* ======================= HOMBROS ======================= */
  pattern('Hombros', 'hom-p1', 'Patrón 1 · Press vertical pesado (Masa y Fuerza)', { rest: '2 a 3 min', tempo: '3 s excéntrica / concéntrica explosiva' }, [
    ['Press militar con barra de pie', 'Barra', '3', STD(10, 8, '6–7'), 'Glúteos y abdomen apretados. Barra desde las clavículas hasta encima de la cabeza.'],
    ['Press militar sentado en multipower', 'Multipower', '3', STD(10, 8, '6–7'), 'Respaldo casi vertical. Baja hasta la barbilla y empuja sin bloquear del todo.'],
    ['Press con mancuernas sentado', 'Mancuernas', '3', STD(12, 10, 8), 'Codos ligeramente por delante del cuerpo. Baja hasta la altura de las orejas.'],
    ['Press Arnold', 'Mancuernas', '3', CERCA(12, 10, 8), 'Empieza con las palmas hacia ti y rota mientras subes. Mucho trabajo del deltoides anterior.'],
    ['Press de hombro en máquina de discos', 'Máquina de discos', '3', STD(12, 10, 8), 'Trayectoria convergente y estable para llegar al fallo con seguridad.'],
    ['Press de hombro en máquina sentado', 'Máquina', '3', STD(12, 10, 8), 'Ajusta el asiento para que los manerales queden a la altura de los hombros.'],
    ['Press landmine a una mano', 'Barra (landmine)', '3', CERCA(12, 10, 8), 'Empuje en diagonal, muy amable con el hombro. Bueno si hay molestias en el press vertical.'],
  ]);
  pattern('Hombros', 'hom-p2', 'Patrón 2 · Deltoides lateral (anchura)', { rest: '60 a 90 s', tempo: '2 s excéntrica / 1 s arriba' }, [
    ['Elevaciones laterales con mancuernas', 'Mancuernas', '3', STD(15, 12, 10), 'Codos ligeramente flexionados y por delante del cuerpo. Sube hasta la altura de los hombros, sin trampas.'],
    ['Elevación lateral unilateral en polea baja', 'Polea', '3', STD(15, 12, 10), 'Cable por detrás o por delante del cuerpo. Tensión constante desde el inicio del recorrido.'],
    ['Elevaciones laterales en máquina', 'Máquina', '3', STD(15, 12, 10), 'Hombro alineado con el eje de la máquina. Empuja con el codo, no con la mano.'],
    ['Elevación lateral inclinada apoyado (lean-away)', 'Mancuerna', '3', CERCA(15, 12, 10), 'Agárrate a un soporte e inclínate hacia el lado contrario: más tensión abajo.'],
    ['Elevación en Y con poleas cruzadas', 'Polea', '3', CERCA(15, 12, 10), 'Cables cruzados delante del cuerpo; sube en diagonal hacia arriba y afuera.'],
    ['Remo al mentón con agarre abierto (barra o polea)', 'Barra', '3', CERCA(12, 10, 8), 'Agarre ancho; lleva los codos hacia los lados hasta la altura de los hombros, no más arriba.'],
  ]);
  pattern('Hombros', 'hom-p3', 'Patrón 3 · Deltoides posterior', { rest: '60 a 90 s', tempo: '2 s excéntrica / 1 s de contracción' }, [
    ['Pájaros con mancuernas (torso inclinado)', 'Mancuernas', '3', STD(15, 12, 10), 'Torso casi paralelo al suelo. Abre los brazos hacia los lados sin juntar las escápulas.'],
    ['Pájaro en máquina (contractor invertido)', 'Máquina', '3', STD(15, 12, 10), 'De cara al respaldo; abre los brazos con los codos altos. Muy estricto.'],
    ['Face pull con cuerda', 'Polea con cuerda', '3', STD(15, 12, 10), 'Polea a la altura de la cara. Tira hacia los ojos abriendo la cuerda y rotando los hombros hacia fuera.'],
    ['Cruce invertido en poleas (de pie)', 'Polea', '3', CERCA(15, 12, 10), 'Cada mano coge el cable contrario a la altura de los hombros y abre en cruz.'],
    ['Pájaro tumbado en banco inclinado', 'Mancuernas y banco inclinado', '3', CERCA(15, 12, 10), 'Pecho apoyado: elimina el impulso y aísla el posterior.'],
  ]);
  pattern('Hombros', 'hom-p4', 'Patrón 4 · Deltoides anterior (opcional)', { rest: '60 a 90 s' }, [
    ['Elevaciones frontales con mancuernas', 'Mancuernas', '3', CERCA(12, 10, 8), 'Sube hasta la altura de los ojos, alternando o a la vez. Sin balanceo.'],
    ['Elevación frontal con disco', 'Disco', '3', CERCA(12, 10, 8), 'Agarre en los laterales del disco. Sube y baja controlando.'],
    ['Elevación frontal en polea baja', 'Polea', '3', CERCA(15, 12, 10), 'De espaldas a la polea con el cable entre las piernas. Tensión constante.'],
  ]);
  pattern('Hombros', 'hom-p5', 'Patrón 5 · Finisher (congestión)', { rest: '30 a 45 s' }, [
    ['Elevaciones laterales en serie descendente', 'Mancuernas', '2', '12 + 10 + 10 (Fallo-Agotamiento)', 'Al llegar al fallo, baja el peso un 20–30 % y sigue sin descanso dos veces.'],
    ['Elevación lateral parcial pesada (medio recorrido)', 'Mancuernas', '2', '20–25 (Fallo-Agotamiento)', 'Solo la mitad inferior del recorrido con más peso de lo normal. Quemazón extrema.'],
  ]);

  /* ======================= CUÁDRICEPS ======================= */
  pattern('Cuádriceps', 'cua-p1', 'Patrón 1 · Sentadilla pesada (Masa y Fuerza)', { rest: '2 a 3 min', tempo: '3 s excéntrica / concéntrica explosiva' }, [
    ['Sentadilla trasera con barra', 'Barra', '3', STD(10, 8, '6–7'), 'Pies a la anchura de los hombros, rodillas en la línea de los pies. Baja al menos hasta la paralela.'],
    ['Sentadilla frontal con barra', 'Barra', '3', STD(10, 8, '6–7'), 'Barra sobre los deltoides, codos altos. Torso más vertical y más cuádriceps.'],
    ['Sentadilla en multipower', 'Multipower', '3', STD(10, 8, '6–7'), 'Pies algo adelantados. Permite ir al fallo con seguridad.'],
    ['Sentadilla hack (máquina de discos)', 'Máquina de discos', '3', STD(12, 10, 8), 'Espalda apoyada y pies en la mitad baja de la plataforma para cargar el cuádriceps. Baja profundo.'],
    ['Sentadilla péndulo (máquina de discos)', 'Máquina de discos', '3', STD(12, 10, 8), 'Recorrido en arco muy profundo con la espalda apoyada. Una de las mejores para cuádriceps.'],
    ['Sentadilla con cinturón (belt squat)', 'Máquina de discos', '3', STD(12, 10, 8), 'La carga va a la cadera: cero carga en la columna. Ideal si hay molestias lumbares.'],
    ['Prensa inclinada 45° (máquina de discos)', 'Máquina de discos', '3', STD(12, 10, 8), 'Pies a la anchura de la cadera en la mitad de la plataforma. Baja sin que la pelvis se despegue.'],
  ]);
  pattern('Cuádriceps', 'cua-p2', 'Patrón 2 · Prensa y unilaterales', { rest: '2 min', tempo: '2 s excéntrica / concéntrica controlada' }, [
    ['Prensa inclinada con pies bajos', 'Máquina de discos', '3', STD(15, 12, 10), 'Prensa inclinada (45°) con los pies bajos en la plataforma para más cuádriceps. Recorrido completo sin bloquear las rodillas.'],
    ['Prensa horizontal en máquina', 'Máquina (sentado)', '3', STD(15, 12, 10), 'Sentado con la espalda apoyada y las piernas en línea recta, sin inclinación. Pies a la anchura de la cadera en la mitad de la plataforma; empuja hasta casi estirar sin bloquear las rodillas y vuelve controlando hasta 90° o algo más.', { id: 'cua-p2-hz' }],
    ['Prensa unilateral', 'Máquina de discos', '3', CERCA(12, 10, 8), 'Una pierna cada vez para corregir asimetrías.'],
    ['Sentadilla búlgara con mancuernas', 'Mancuernas y banco', '3', CERCA(12, 10, 8), 'Pie de atrás en el banco, torso erguido y rodilla adelante para cargar el cuádriceps.'],
    ['Sentadilla búlgara en multipower', 'Multipower y banco', '3', CERCA(12, 10, 8), 'La estabilidad de la máquina permite meter más carga.'],
    ['Zancadas caminando con mancuernas', 'Mancuernas', '3', '12 / 10 / 10 por pierna (Cerca-del-Fallo)', 'Paso medio y rodilla de atrás casi al suelo. Empuja con el talón de delante.'],
    ['Subida al cajón (step-up) con mancuernas', 'Mancuernas y cajón', '3', '12 / 10 / 8 por pierna (Cerca-del-Fallo)', 'Cajón a la altura de la rodilla. Sube sin impulsarte con la pierna de atrás.'],
    ['Sentadilla goblet con talones elevados', 'Mancuerna', '3', CERCA(15, 12, 10), 'Talones sobre un disco o cuña; las rodillas avanzan más y el cuádriceps trabaja más.'],
  ]);
  pattern('Cuádriceps', 'cua-p3', 'Patrón 3 · Aislamiento', { rest: '60 a 90 s', tempo: '2 s excéntrica / 1 s de contracción arriba' }, [
    ['Extensiones de cuádriceps en máquina', 'Máquina', '3', STD(15, 12, 10), 'Respaldo algo inclinado atrás para estirar el recto femoral. Aguanta 1 s arriba.'],
    ['Extensión de cuádriceps unilateral', 'Máquina', '3', CERCA(15, 12, 10), 'Una pierna cada vez. Muy útil para corregir diferencias.'],
    ['Sissy squat (asistida o en máquina)', 'Peso corporal', '3', 'Al fallo técnico (Casi-Fallo)', 'Rodillas adelante y cadera extendida. Estiramiento intenso del cuádriceps.'],
    ['Extensión de rodilla en polea baja (con tobillera)', 'Polea', '3', CERCA(15, 12, 10), 'Alternativa si no hay máquina. Tensión constante.'],
  ]);
  pattern('Cuádriceps', 'cua-p4', 'Patrón 4 · Finisher (congestión)', { rest: '30 a 45 s' }, [
    ['Prensa en serie larga', 'Máquina', '2', '30 (Fallo-Agotamiento)', 'Peso moderado y sin bloquear las rodillas. Quemazón máxima.'],
    ['Extensiones con pausas (descanso-pausa)', 'Máquina', '2', '15 + 6 + 4 (Fallo-Agotamiento)', 'Al fallo, descansa 15 s y saca más repeticiones con el mismo peso, dos veces.'],
  ]);

  /* ======================= ISQUIOTIBIALES ======================= */
  pattern('Isquiotibiales', 'isq-p1', 'Patrón 1 · Bisagra de cadera (estiramiento)', { rest: '2 a 3 min', tempo: '3 s excéntrica / concéntrica explosiva' }, [
    ['Peso muerto rumano con barra', 'Barra', '3', STD(10, 8, '6–7'), 'Rodillas algo flexionadas y fijas. Lleva la cadera atrás con la barra pegada a las piernas hasta notar el estiramiento.'],
    ['Peso muerto rumano con mancuernas', 'Mancuernas', '3', STD(12, 10, 8), 'Mancuernas delante de los muslos. Espalda neutra y cadera atrás.'],
    ['Peso muerto con piernas rígidas', 'Barra', '3', CERCA(10, 8, '6–7'), 'Rodillas casi extendidas: más estiramiento del isquio. Solo hasta donde mantengas la espalda neutra.'],
    ['Peso muerto rumano en multipower', 'Multipower', '3', STD(12, 10, 8), 'Trayectoria fija para centrarse en el estiramiento.'],
    ['Peso muerto rumano a una pierna con mancuerna', 'Mancuerna', '3', CERCA(12, 10, 8), 'Pierna libre atrás alineada con el tronco. Equilibrio y gran estiramiento.'],
    ['Pull-through en polea baja', 'Polea con cuerda', '3', CERCA(15, 12, 10), 'De espaldas a la polea con la cuerda entre las piernas. Bisagra pura de cadera.'],
  ]);
  pattern('Isquiotibiales', 'isq-p2', 'Patrón 2 · Flexión de rodilla (curl femoral)', { rest: '90 s', tempo: '3 s excéntrica / 1 s de contracción' }, [
    ['Curl femoral tumbado', 'Máquina', '3', STD(12, 10, 8), 'Cadera pegada al banco. Lleva los talones a los glúteos y baja lento.'],
    ['Curl femoral sentado', 'Máquina', '3', STD(12, 10, 8), 'La cadera flexionada estira el isquio: es la variante con más estímulo. Torso algo inclinado adelante.'],
    ['Curl femoral de pie unilateral', 'Máquina', '3', CERCA(12, 10, 8), 'Una pierna cada vez, cadera quieta.'],
    ['Curl femoral en máquina de discos', 'Máquina de discos', '3', STD(12, 10, 8), 'Recorrido completo y mucha carga con estabilidad.'],
    ['Curl femoral en polea baja con tobillera', 'Polea', '3', CERCA(15, 12, 10), 'De pie o tumbado. Alternativa cuando no hay máquina.'],
    ['Curl femoral con mancuerna tumbado', 'Mancuerna', '3', CERCA(12, 10, 8), 'Mancuerna entre los pies. Controla mucho la bajada.'],
    ['Curl nórdico', 'Peso corporal', '3', 'Al fallo técnico (Casi-Fallo)', 'Talones sujetos; déjate caer lo más lento posible. Excéntrica brutal y protector de lesiones.', { rest: '2 min' }],
  ]);
  pattern('Isquiotibiales', 'isq-p3', 'Patrón 3 · Finisher', { rest: '30 a 45 s' }, [
    ['Curl femoral sentado con descanso-pausa', 'Máquina', '2', '12 + 5 + 3 (Fallo-Agotamiento)', 'Al fallo, descansa 15 s y repite dos veces con el mismo peso.'],
    ['Hiperextensión con énfasis en isquios', 'Banco romano', '2', '20 (Fallo-Agotamiento)', 'Espalda neutra y bisagra desde la cadera, con el apoyo un poco más bajo de lo normal.'],
  ]);

  /* ======================= GLÚTEOS ======================= */
  pattern('Glúteos', 'glu-p1', 'Patrón 1 · Empuje de cadera pesado', { rest: '2 a 3 min', tempo: '2 s excéntrica / 2 s de contracción arriba' }, [
    ['Hip thrust con barra', 'Barra y banco', '3', STD(12, 10, 8), 'Espalda alta en el banco y barbilla al pecho. Sube hasta alinear tronco y muslos y aprieta 2 s.'],
    ['Hip thrust en máquina de discos', 'Máquina de discos', '3', STD(12, 10, 8), 'Mucha carga sin tener que colocar la barra. Pelvis en retroversión arriba.'],
    ['Hip thrust en multipower', 'Multipower y banco', '3', STD(12, 10, 8), 'Estable y fácil de cargar. Pies a la altura que haga trabajar más el glúteo.'],
    ['Puente de glúteo con barra (en el suelo)', 'Barra', '3', CERCA(15, 12, 10), 'Recorrido más corto pero mucha contracción. Bueno como segundo ejercicio.'],
    ['Hip thrust unilateral con mancuerna', 'Mancuerna y banco', '3', CERCA(12, 10, 8), 'Mancuerna sobre la cadera de la pierna que trabaja. Corrige asimetrías.'],
  ]);
  pattern('Glúteos', 'glu-p2', 'Patrón 2 · Estiramiento y unilaterales', { rest: '2 min', tempo: '3 s excéntrica / concéntrica controlada' }, [
    ['Sentadilla búlgara con énfasis glúteo', 'Mancuernas y banco', '3', CERCA(12, 10, 8), 'Paso largo y torso inclinado adelante; baja profundo para estirar el glúteo.'],
    ['Zancada hacia atrás con déficit', 'Mancuernas y disco', '3', '12 / 10 / 8 por pierna (Cerca-del-Fallo)', 'Pie de delante sobre un disco. Más recorrido y más glúteo.'],
    ['Peso muerto sumo con barra', 'Barra', '3', STD(10, 8, '6–7'), 'Pies muy abiertos y puntas afuera. Glúteo y aductores con mucha carga.'],
    ['Subida al cajón alto (step-up) con énfasis glúteo', 'Mancuernas y cajón', '3', '12 / 10 / 8 por pierna (Cerca-del-Fallo)', 'Cajón alto y torso inclinado. Empuja con el talón.'],
    ['Prensa con pies altos y abiertos', 'Máquina de discos', '3', STD(12, 10, 8), 'Pies en la parte alta de la plataforma: más cadera y glúteo.'],
    ['Hiperextensión 45° con énfasis glúteo', 'Banco romano y disco', '3', CERCA(15, 12, 10), 'Espalda alta redondeada, puntas afuera y aprieta glúteos para subir.'],
  ]);
  pattern('Glúteos', 'glu-p3', 'Patrón 3 · Glúteo medio y patadas', { rest: '60 a 90 s', tempo: '1 s de contracción' }, [
    ['Abducción de cadera en máquina (torso inclinado)', 'Máquina', '3', STD(20, 15, 12), 'Inclínate adelante para cargar el glúteo mayor superior y medio. Aguanta 1 s abierto.'],
    ['Abducción de cadera en polea baja de pie', 'Polea con tobillera', '3', CERCA(15, 12, 10), 'Pierna recta hacia el lado sin inclinar el tronco.'],
    ['Patada de glúteo en polea (kickback)', 'Polea con tobillera', '3', CERCA(15, 12, 10), 'Torso inclinado y apoyo firme. Lleva el talón atrás y arriba sin arquear la lumbar.'],
    ['Patada de glúteo en máquina', 'Máquina', '3', STD(15, 12, 10), 'Recorrido guiado; aprieta arriba 1 s.'],
  ]);
  pattern('Glúteos', 'glu-p4', 'Patrón 4 · Finisher', { rest: '30 a 45 s' }, [
    ['Abducción en máquina en 3 posiciones', 'Máquina', '2', '15 + 15 + 15 (Fallo-Agotamiento)', 'Torso inclinado, recto y reclinado sin descanso entre posiciones.'],
    ['Puente de glúteo con banda elástica (altas repeticiones)', 'Banda elástica', '2', '30–50 (Fallo-Agotamiento)', 'Banda sobre las rodillas, abriéndolas arriba. Solo congestión.'],
  ]);

  /* ======================= ADUCTORES ======================= */
  pattern('Aductores', 'adu-p1', 'Patrón 1 · Aducción y sentadilla abierta', { rest: '90 s', tempo: '2 s excéntrica / 1 s de contracción' }, [
    ['Aducción de cadera en máquina', 'Máquina', '3', STD(15, 12, 10), 'Abre hasta notar el estiramiento y cierra apretando 1 s.'],
    ['Aducción en polea baja de pie', 'Polea con tobillera', '3', CERCA(15, 12, 10), 'Cruza la pierna por delante de la de apoyo.'],
    ['Sentadilla sumo con mancuerna (goblet)', 'Mancuerna', '3', CERCA(15, 12, 10), 'Pies muy abiertos y bajada profunda.'],
    ['Plancha de Copenhague', 'Peso corporal', '3', '20–40 s por lado (Casi-Fallo)', 'Pierna de arriba sobre un banco y cuerpo en línea.'],
  ]);

  /* ======================= GEMELOS ======================= */
  pattern('Gemelos', 'gem-p1', 'Patrón 1 · Gemelo (rodilla extendida)', { rest: '60 a 90 s', tempo: '2 s de estiramiento abajo / 1 s arriba' }, [
    ['Elevación de talones de pie en máquina', 'Máquina', '3', STD(15, 12, 10), 'Rodillas extendidas. Baja hasta el estiramiento completo y aguanta 2 s abajo.'],
    ['Elevación de talones en multipower (con escalón)', 'Multipower y escalón', '3', STD(15, 12, 10), 'Puntas en un escalón o disco para ganar recorrido.'],
    ['Elevación de talones en prensa', 'Máquina de discos', '3', STD(15, 12, 10), 'Puntas en el borde de la plataforma y rodillas extendidas.'],
    ['Gemelo tipo burro (donkey) en máquina', 'Máquina de discos', '3', STD(15, 12, 10), 'Cadera flexionada: máximo estiramiento del gemelo.'],
    ['Elevación de talones a una pierna con mancuerna', 'Mancuerna y escalón', '3', CERCA(15, 12, 10), 'Apóyate con la mano libre. Recorrido completo.'],
  ]);
  pattern('Gemelos', 'gem-p2', 'Patrón 2 · Sóleo (rodilla flexionada)', { rest: '60 s', tempo: '2 s de estiramiento abajo / 1 s arriba' }, [
    ['Elevación de talones sentado en máquina', 'Máquina de discos', '3', STD(20, 15, 12), 'Rodillas a 90°: trabaja sobre todo el sóleo. Recorrido completo y lento.'],
    ['Elevación de talones sentado con mancuernas o barra', 'Mancuernas', '3', CERCA(20, 15, 12), 'Peso sobre las rodillas y puntas en un disco.'],
    ['Elevación de talones sentado en multipower', 'Multipower', '3', CERCA(20, 15, 12), 'Barra sobre los muslos con almohadilla.'],
  ]);
  pattern('Gemelos', 'gem-p3', 'Patrón 3 · Tibial y finisher', { rest: '30 a 45 s' }, [
    ['Elevación de punteras (tibial anterior)', 'Disco o máquina', '2', '20–25 (Cerca-del-Fallo)', 'Espalda en la pared y talones adelantados, o con disco en los pies.'],
    ['Gemelos en escalón sin peso (altas repeticiones)', 'Peso corporal', '2', '50 (Fallo-Agotamiento)', 'Rápidas y continuas. Solo congestión.'],
  ]);

  /* ======================= CORE / ABDOMEN ======================= */
  pattern('Core / Abdomen', 'abd-p1', 'Patrón 1 · Flexión de tronco con carga', { rest: '60 a 90 s', tempo: '2 s excéntrica / 1 s de contracción' }, [
    ['Crunch en polea alta de rodillas (cuerda)', 'Polea con cuerda', '3', STD(15, 12, 10), 'Cadera quieta; enrolla el tronco llevando los codos a las rodillas.'],
    ['Crunch en máquina', 'Máquina', '3', STD(15, 12, 10), 'Enrolla la columna en lugar de tirar con los brazos.'],
    ['Crunch en banco declinado con disco', 'Banco declinado y disco', '3', CERCA(15, 12, 10), 'Disco al pecho. Sube enrollando, no con la cadera.'],
  ]);
  pattern('Core / Abdomen', 'abd-p2', 'Patrón 2 · Elevación de piernas (zona inferior)', { rest: '60 a 90 s' }, [
    ['Elevación de piernas colgado', 'Barra de dominadas', '3', 'Al fallo técnico (Casi-Fallo)', 'Sin balanceo; lleva la pelvis hacia arriba al final. Rodillas flexionadas si es muy duro.'],
    ['Elevación de rodillas en silla romana (paralelas)', 'Silla romana', '3', CERCA(15, 12, 10), 'Espalda pegada al respaldo; enrolla la pelvis arriba.'],
    ['Crunch inverso en banco declinado', 'Banco declinado', '3', CERCA(15, 12, 10), 'Sujétate al banco y lleva las rodillas al pecho despegando la cadera.'],
    ['Rueda abdominal (ab wheel)', 'Rueda abdominal', '3', 'Al fallo técnico (Casi-Fallo)', 'Rodillas en el suelo y abdomen apretado; no dejes que se hunda la lumbar.'],
  ]);
  pattern('Core / Abdomen', 'abd-p3', 'Patrón 3 · Oblicuos y antirrotación', { rest: '60 s' }, [
    ['Pallof press en polea', 'Polea', '3', '12 / 10 / 10 por lado (Cerca-del-Fallo)', 'De lado a la polea; empuja al frente y resiste la rotación 2 s.'],
    ['Leñador en polea (de arriba abajo)', 'Polea', '3', '12 / 10 / 10 por lado (Cerca-del-Fallo)', 'Gira el tronco desde arriba hacia la cadera contraria con los brazos firmes.'],
    ['Inclinación lateral con mancuerna', 'Mancuerna', '3', '15 / 12 / 12 por lado (Cerca-del-Fallo)', 'Una sola mancuerna; inclínate hacia el lado contrario sin girar.'],
    ['Plancha con disco', 'Disco', '3', '30–60 s (Casi-Fallo)', 'Disco sobre la espalda; cuerpo en línea y glúteos apretados.'],
  ]);

  /* ======================= ANTEBRAZO ======================= */
  pattern('Antebrazo', 'ant-p1', 'Patrón 1 · Flexores, extensores y agarre', { rest: '60 s' }, [
    ['Curl de muñeca con barra (palmas arriba)', 'Barra', '3', STD(20, 15, 12), 'Antebrazos apoyados en el banco; deja rodar la barra hasta los dedos y sube.'],
    ['Extensión de muñeca con barra (palmas abajo)', 'Barra', '3', CERCA(20, 15, 12), 'Antebrazos apoyados; sube los nudillos sin mover el codo.'],
    ['Curl inverso con barra Z', 'Barra Z', '3', CERCA(15, 12, 10), 'Agarre prono; braquiorradial y extensores.'],
    ['Paseo del granjero con mancuernas', 'Mancuernas', '3', '30–40 m (Casi-Fallo)', 'Mancuernas pesadas, hombros atrás y pasos cortos.'],
  ]);

  /* Imágenes de cada ejercicio (posición inicial _0 y final _1) en img/ejercicios/.
   * Fotos de Free Exercise DB (github.com/yuhonas/free-exercise-db), de dominio público (Unlicense).
   * En algunos ejercicios sin foto exacta se usa la variante más parecida.
   * Horizontal_Leg_Press es una ilustración propia (no hay foto libre de la prensa horizontal). */
  const IMAGES = {
    "bic-p1-1": "Machine_Bicep_Curl",
    "bic-p1-2": "Standing_Biceps_Cable_Curl",
    "bic-p1-3": "EZ-Bar_Curl",
    "bic-p1-4": "Barbell_Curl",
    "bic-p1-5": "Preacher_Curl",
    "bic-p1-6": "Dumbbell_Alternate_Bicep_Curl",
    "bic-p1-7": "Close-Grip_EZ_Bar_Curl",
    "bic-p2-1": "Machine_Preacher_Curls",
    "bic-p2-2": "Preacher_Curl",
    "bic-p2-3": "One_Arm_Dumbbell_Preacher_Curl",
    "bic-p2-4": "Concentration_Curls",
    "bic-p2-5": "Spider_Curl",
    "bic-p2-6": "High_Cable_Curls",
    "bic-p3-1": "Hammer_Curls",
    "bic-p3-2": "Cable_Hammer_Curls_-_Rope_Attachment",
    "bic-p3-3": "Alternate_Hammer_Curl",
    "bic-p3-4": "Incline_Dumbbell_Curl",
    "bic-p3-5": "Standing_One-Arm_Cable_Curl",
    "bic-p3-6": "Standing_Biceps_Cable_Curl",
    "bic-p4-1": "Chin-Up",
    "bic-p4-2": "Close-Grip_EZ-Bar_Curl_with_Band",
    "tri-p1-1": "Dip_Machine",
    "tri-p1-2": "Dips_-_Triceps_Version",
    "tri-p1-3": "Close-Grip_Barbell_Bench_Press",
    "tri-p1-4": "Close-Grip_Dumbbell_Press",
    "tri-p1-5": "Weighted_Bench_Dip",
    "tri-p1-6": "Push-Ups_-_Close_Triceps_Position",
    "tri-p1-7": "EZ-Bar_Skullcrusher",
    "tri-p1-8": "Floor_Press",
    "tri-p2-1": "Standing_Low-Pulley_One-Arm_Triceps_Extension",
    "tri-p2-2": "Cable_Rope_Overhead_Triceps_Extension",
    "tri-p2-3": "Lying_Close-Grip_Barbell_Triceps_Extension_Behind_The_Head",
    "tri-p2-4": "Lying_Dumbbell_Tricep_Extension",
    "tri-p2-5": "Triceps_Overhead_Extension_with_Rope",
    "tri-p2-6": "Dumbbell_One-Arm_Triceps_Extension",
    "tri-p2-7": "Standing_Dumbbell_Triceps_Extension",
    "tri-p3-1": "Triceps_Pushdown_-_Rope_Attachment",
    "tri-p3-2": "Triceps_Pushdown_-_V-Bar_Attachment",
    "tri-p3-3": "Triceps_Pushdown",
    "tri-p3-4": "Tricep_Dumbbell_Kickback",
    "tri-p3-5": "Cable_One_Arm_Tricep_Extension",
    "tri-p3-6": "Kneeling_Cable_Triceps_Extension",
    "tri-p4-1": "Cable_One_Arm_Tricep_Extension",
    "tri-p4-2": "Reverse_Grip_Triceps_Pushdown",
    "tri-p4-3": "Cable_One_Arm_Tricep_Extension",
    "tri-p4-4": "Tricep_Dumbbell_Kickback",
    "pec-p1-1": "Barbell_Bench_Press_-_Medium_Grip",
    "pec-p1-2": "Dumbbell_Bench_Press",
    "pec-p1-3": "Leverage_Chest_Press",
    "pec-p1-4": "Smith_Machine_Bench_Press",
    "pec-p1-5": "Machine_Bench_Press",
    "pec-p1-6": "Dumbbell_Bench_Press_with_Neutral_Grip",
    "pec-p2-1": "Barbell_Incline_Bench_Press_-_Medium_Grip",
    "pec-p2-2": "Incline_Dumbbell_Press",
    "pec-p2-3": "Smith_Machine_Incline_Bench_Press",
    "pec-p2-4": "Leverage_Incline_Chest_Press",
    "pec-p2-5": "Incline_Dumbbell_Flyes",
    "pec-p2-6": "Low_Cable_Crossover",
    "pec-p3-1": "Decline_Barbell_Bench_Press",
    "pec-p3-2": "Decline_Dumbbell_Bench_Press",
    "pec-p3-3": "Leverage_Decline_Chest_Press",
    "pec-p3-4": "Dips_-_Chest_Version",
    "pec-p3-5": "Dip_Machine",
    "pec-p3-6": "Cable_Crossover",
    "pec-p4-1": "Dumbbell_Flyes",
    "pec-p4-2": "Butterfly",
    "pec-p4-3": "Cable_Crossover",
    "pec-p4-4": "Flat_Bench_Cable_Flyes",
    "pec-p4-5": "Single-Arm_Cable_Crossover",
    "pec-p4-6": "Bent-Arm_Dumbbell_Pullover",
    "pec-p5-1": "Pushups",
    "pec-p5-2": "Push-Up_Wide",
    "pec-p5-3": "Dumbbell_Bench_Press_with_Neutral_Grip",
    "pec-p5-4": "Svend_Press",
    "esp-p1-1": "Pullups",
    "esp-p1-2": "Chin-Up",
    "esp-p1-3": "Wide-Grip_Lat_Pulldown",
    "esp-p1-4": "V-Bar_Pulldown",
    "esp-p1-5": "Full_Range-Of-Motion_Lat_Pulldown",
    "esp-p1-6": "One_Arm_Lat_Pulldown",
    "esp-p1-7": "Underhand_Cable_Pulldowns",
    "esp-p2-1": "Bent_Over_Barbell_Row",
    "esp-p2-2": "Bent_Over_Barbell_Row",
    "esp-p2-3": "T-Bar_Row_with_Handle",
    "esp-p2-4": "One-Arm_Dumbbell_Row",
    "esp-p2-5": "Leverage_High_Row",
    "esp-p2-6": "Seated_Cable_Rows",
    "esp-p2-maq": "Leverage_Iso_Row",
    "esp-p2-pab": "Low_Pulley_Row_To_Neck",
    "esp-p2-7": "Dumbbell_Incline_Row",
    "esp-p2-8": "One-Arm_Long_Bar_Row",
    "esp-p2-9": "Smith_Machine_Bent_Over_Row",
    "esp-p3-1": "Straight-Arm_Pulldown",
    "esp-p3-2": "Straight-Arm_Dumbbell_Pullover",
    "esp-p3-3": "Bent-Arm_Barbell_Pullover",
    "esp-p3-4": "Seated_One-arm_Cable_Pulley_Rows",
    "esp-p3-5": "Rope_Straight-Arm_Pulldown",
    "esp-p4-1": "Barbell_Shrug",
    "esp-p4-2": "Dumbbell_Shrug",
    "esp-p4-3": "Smith_Machine_Behind_the_Back_Shrug",
    "esp-p4-4": "Cable_Shrugs",
    "esp-p4-5": "Cable_Rope_Rear-Delt_Rows",
    "esp-p5-1": "Barbell_Deadlift",
    "esp-p5-2": "Rack_Pulls",
    "esp-p5-3": "Hyperextensions_Back_Extensions",
    "esp-p5-4": "Good_Morning",
    "hom-p1-1": "Standing_Military_Press",
    "hom-p1-2": "Smith_Machine_Overhead_Shoulder_Press",
    "hom-p1-3": "Seated_Dumbbell_Press",
    "hom-p1-4": "Arnold_Dumbbell_Press",
    "hom-p1-5": "Leverage_Shoulder_Press",
    "hom-p1-6": "Machine_Shoulder_Military_Press",
    "hom-p1-7": "Single-Arm_Linear_Jammer",
    "hom-p2-1": "Side_Lateral_Raise",
    "hom-p2-2": "Standing_Low-Pulley_Deltoid_Raise",
    "hom-p2-3": "Cable_Seated_Lateral_Raise",
    "hom-p2-4": "One-Arm_Side_Laterals",
    "hom-p2-5": "Cable_Seated_Lateral_Raise",
    "hom-p2-6": "Upright_Barbell_Row",
    "hom-p3-1": "Seated_Bent-Over_Rear_Delt_Raise",
    "hom-p3-2": "Reverse_Machine_Flyes",
    "hom-p3-3": "Face_Pull",
    "hom-p3-4": "Cable_Rear_Delt_Fly",
    "hom-p3-5": "Lying_Rear_Delt_Raise",
    "hom-p4-1": "Front_Dumbbell_Raise",
    "hom-p4-2": "Front_Plate_Raise",
    "hom-p4-3": "Front_Cable_Raise",
    "hom-p5-1": "Side_Lateral_Raise",
    "hom-p5-2": "Power_Partials",
    "cua-p1-1": "Barbell_Squat",
    "cua-p1-2": "Front_Barbell_Squat",
    "cua-p1-3": "Smith_Machine_Squat",
    "cua-p1-4": "Hack_Squat",
    "cua-p1-5": "Lying_Machine_Squat",
    "cua-p1-6": "Barbell_Hack_Squat",
    "cua-p1-7": "Leg_Press",
    "cua-p2-1": "Narrow_Stance_Leg_Press",
    "cua-p2-hz": "Horizontal_Leg_Press",
    "cua-p2-2": "Leg_Press",
    "cua-p2-3": "Split_Squat_with_Dumbbells",
    "cua-p2-4": "Smith_Single-Leg_Split_Squat",
    "cua-p2-5": "Dumbbell_Lunges",
    "cua-p2-6": "Dumbbell_Step_Ups",
    "cua-p2-7": "Goblet_Squat",
    "cua-p3-1": "Leg_Extensions",
    "cua-p3-2": "Single-Leg_Leg_Extension",
    "cua-p3-3": "Weighted_Sissy_Squat",
    "cua-p3-4": "Leg_Extensions",
    "cua-p4-1": "Leg_Press",
    "cua-p4-2": "Leg_Extensions",
    "isq-p1-1": "Romanian_Deadlift",
    "isq-p1-2": "Stiff-Legged_Dumbbell_Deadlift",
    "isq-p1-3": "Stiff-Legged_Barbell_Deadlift",
    "isq-p1-4": "Smith_Machine_Stiff-Legged_Deadlift",
    "isq-p1-5": "Kettlebell_One-Legged_Deadlift",
    "isq-p1-6": "Pull_Through",
    "isq-p2-1": "Lying_Leg_Curls",
    "isq-p2-2": "Seated_Leg_Curl",
    "isq-p2-3": "Standing_Leg_Curl",
    "isq-p2-4": "Lying_Leg_Curls",
    "isq-p2-5": "Standing_Leg_Curl",
    "isq-p2-6": "Lying_Leg_Curls",
    "isq-p2-7": "Natural_Glute_Ham_Raise",
    "isq-p3-1": "Seated_Leg_Curl",
    "isq-p3-2": "Hyperextensions_Back_Extensions",
    "glu-p1-1": "Barbell_Hip_Thrust",
    "glu-p1-2": "Barbell_Hip_Thrust",
    "glu-p1-3": "Smith_Machine_Hip_Raise",
    "glu-p1-4": "Barbell_Glute_Bridge",
    "glu-p1-5": "Single_Leg_Glute_Bridge",
    "glu-p2-1": "Split_Squat_with_Dumbbells",
    "glu-p2-2": "Dumbbell_Rear_Lunge",
    "glu-p2-3": "Sumo_Deadlift",
    "glu-p2-4": "Dumbbell_Step_Ups",
    "glu-p2-5": "Leg_Press",
    "glu-p2-6": "Hyperextensions_Back_Extensions",
    "glu-p3-1": "Thigh_Abductor",
    "glu-p3-2": "One-Legged_Cable_Kickback",
    "glu-p3-3": "One-Legged_Cable_Kickback",
    "glu-p3-4": "Glute_Kickback",
    "glu-p4-1": "Thigh_Abductor",
    "glu-p4-2": "Hip_Lift_with_Band",
    "adu-p1-1": "Thigh_Adductor",
    "adu-p1-2": "Cable_Hip_Adduction",
    "adu-p1-3": "Plie_Dumbbell_Squat",
    "adu-p1-4": "Side_Bridge",
    "gem-p1-1": "Standing_Calf_Raises",
    "gem-p1-2": "Smith_Machine_Calf_Raise",
    "gem-p1-3": "Calf_Press_On_The_Leg_Press_Machine",
    "gem-p1-4": "Donkey_Calf_Raises",
    "gem-p1-5": "Standing_Dumbbell_Calf_Raise",
    "gem-p2-1": "Seated_Calf_Raise",
    "gem-p2-2": "Dumbbell_Seated_One-Leg_Calf_Raise",
    "gem-p2-3": "Barbell_Seated_Calf_Raise",
    "gem-p3-1": "Smith_Machine_Reverse_Calf_Raises",
    "gem-p3-2": "Standing_Calf_Raises",
    "abd-p1-1": "Cable_Crunch",
    "abd-p1-2": "Ab_Crunch_Machine",
    "abd-p1-3": "Decline_Crunch",
    "abd-p2-1": "Hanging_Leg_Raise",
    "abd-p2-2": "Knee_Hip_Raise_On_Parallel_Bars",
    "abd-p2-3": "Decline_Reverse_Crunch",
    "abd-p2-4": "Ab_Roller",
    "abd-p3-1": "Pallof_Press",
    "abd-p3-2": "Standing_Cable_Wood_Chop",
    "abd-p3-3": "Dumbbell_Side_Bend",
    "abd-p3-4": "Plank",
    "ant-p1-1": "Palms-Up_Barbell_Wrist_Curl_Over_A_Bench",
    "ant-p1-2": "Palms-Down_Wrist_Curl_Over_A_Bench",
    "ant-p1-3": "Reverse_Barbell_Curl",
    "ant-p1-4": "Farmers_Walk"
    };
  list.forEach((e) => { if (IMAGES[e.id]) e.img = IMAGES[e.id]; });

  window.LIBRARY_DEFAULT = list;

  /* Pautas de cada grupo muscular (se muestran en la biblioteca). */
  window.LIBRARY_GUIDES = {
    'Pecho': [
      { title: 'Pautas básicas', items: [
        'Estructura: un ejercicio del Patrón 1 (press horizontal) + uno del Patrón 2 (porción superior) + uno del Patrón 3 o 4. El Patrón 5 es un finisher opcional.',
        'Volumen: 3 series por ejercicio, siempre con el método de las 3 series (abajo).',
        'Frecuencia: 1–2 veces por semana.',
        'Técnica: escápulas retraídas y deprimidas en todos los presses; el pecho empuja, el hombro acompaña.',
      ] },
      { title: 'Calentamiento y activación', items: [
        'Movilidad: rotaciones de hombro y aperturas con banda.',
        'Activación: 2 series × 12 de aperturas en polea o press con peso muy ligero.',
      ] },
      { title: 'Patrón 1 · Press horizontal pesado', items: ['Objetivo: masa y fuerza base del pecho.', 'Descanso: 2 a 3 minutos.'] },
      { title: 'Patrón 2 · Porción superior', items: ['Objetivo: llenar la parte alta del pecho (bajo la clavícula).', 'Mecánica: banco a 30°; más inclinación carga el hombro.', 'Descanso: 2 minutos.'] },
      { title: 'Patrón 3 · Porción inferior y fondos', items: ['Objetivo: densidad del borde inferior del pecho.', 'Mecánica: declinados, fondos con torso inclinado y cruces de arriba abajo.'] },
      { title: 'Patrón 4 · Aislamiento y estiramiento', items: ['Objetivo: máxima tensión en el estiramiento con aperturas y poleas.', 'Tempo: 2 s excéntrica / 1 s de estiramiento / 1 s concéntrica.', 'Descanso: 90 segundos.'] },
      { title: 'Patrón 5 · Finisher', items: ['Objetivo: congestión final con flexiones o presses de apretar.', 'Descanso: 30 a 45 segundos.'] },
    ],
    'Espalda': [
      { title: 'Pautas básicas', items: [
        'Estructura: un ejercicio del Patrón 1 (tracción vertical) + uno del Patrón 2 (remo) + uno del Patrón 3 o 4. El Patrón 5 (lumbar) según el objetivo.',
        'Volumen: 3 series por ejercicio, siempre con el método de las 3 series (abajo).',
        'Frecuencia: 1–2 veces por semana.',
        'Técnica: tira con los codos, no con las manos. Las correas de agarre están permitidas en las series pesadas.',
      ] },
      { title: 'Calentamiento y activación', items: [
        'Movilidad: colgarse de la barra 20–30 s y rotaciones de hombro.',
        'Activación: 2 series × 12 de pullover en polea con peso ligero.',
      ] },
      { title: 'Patrón 1 · Tracción vertical (amplitud)', items: ['Objetivo: anchura del dorsal.', 'Descanso: 2 a 3 minutos.'] },
      { title: 'Patrón 2 · Remo horizontal (grosor)', items: ['Objetivo: densidad de la espalda media.', 'Mecánica: aprieta las escápulas 1 s arriba en cada repetición.', 'Descanso: 2 a 3 minutos.'] },
      { title: 'Patrón 3 · Dorsal en aislamiento', items: ['Objetivo: tensión en el dorsal sin bíceps (brazos rectos o tirones hacia la cadera).', 'Descanso: 90 segundos.'] },
      { title: 'Patrón 4 · Espalda alta y trapecio', items: ['Objetivo: trapecio, romboides y espalda alta.', 'Mecánica: encogimientos sin rotar los hombros, con 2 s de pausa arriba.'] },
      { title: 'Patrón 5 · Zona lumbar', items: ['Objetivo: fuerza de la cadena posterior y los erectores.', 'Regla de oro: espalda siempre neutra; si se redondea, se acaba la serie.'] },
    ],
    'Hombros': [
      { title: 'Pautas básicas', items: [
        'Estructura: un ejercicio del Patrón 1 (press) + uno del Patrón 2 (lateral) + uno del Patrón 3 (posterior). El anterior (Patrón 4) ya trabaja en los presses: solo si se busca específicamente.',
        'Volumen: 3 series por ejercicio, siempre con el método de las 3 series (abajo).',
        'Frecuencia: 1–2 veces por semana (el lateral y el posterior toleran más frecuencia).',
      ] },
      { title: 'Calentamiento y activación', items: [
        'Movilidad: rotaciones externas e internas con banda o polea ligera.',
        'Activación: 2 series × 15 de face pull ligero.',
      ] },
      { title: 'Patrón 1 · Press vertical pesado', items: ['Objetivo: masa y fuerza del deltoides.', 'Descanso: 2 a 3 minutos.'] },
      { title: 'Patrón 2 · Deltoides lateral', items: ['Objetivo: anchura de hombros.', 'Regla de oro: peso moderado y sin impulso; el codo sube, la mano lo acompaña.'] },
      { title: 'Patrón 3 · Deltoides posterior', items: ['Objetivo: hombro redondo y salud postural.', 'Mecánica: no juntes las escápulas: el trabajo es del hombro, no de la espalda.'] },
      { title: 'Patrón 5 · Finisher', items: ['Objetivo: congestión del lateral con series descendentes o parciales.', 'Descanso: 30 a 45 segundos.'] },
    ],
    'Cuádriceps': [
      { title: 'Pautas básicas', items: [
        'Estructura: un ejercicio del Patrón 1 (sentadilla) + uno del Patrón 2 (prensa o unilateral) + uno del Patrón 3 (aislamiento). Finisher opcional.',
        'Volumen: 3 series por ejercicio, siempre con el método de las 3 series (abajo).',
        'Frecuencia: 1–2 veces por semana.',
        'Técnica: rodillas en la línea de los pies y recorrido completo.',
      ] },
      { title: 'Calentamiento y activación', items: [
        'Movilidad: tobillo y cadera (sentadilla profunda sin peso, zancadas dinámicas).',
        'Activación: 2 series × 15 de extensiones de cuádriceps ligeras.',
      ] },
      { title: 'Patrón 1 · Sentadilla pesada', items: ['Objetivo: masa y fuerza.', 'Descanso: 2 a 3 minutos.'] },
      { title: 'Patrón 2 · Prensa y unilaterales', items: ['Objetivo: volumen de calidad con menos fatiga de la columna y corrección de asimetrías.', 'Descanso: 2 minutos.'] },
      { title: 'Patrón 3 · Aislamiento', items: ['Objetivo: tensión directa en el cuádriceps (recto femoral incluido).', 'Tempo: 2 s excéntrica / 1 s arriba.'] },
    ],
    'Isquiotibiales': [
      { title: 'Pautas básicas', items: [
        'Estructura: un ejercicio del Patrón 1 (bisagra de cadera) + uno del Patrón 2 (curl femoral). Finisher opcional.',
        'Volumen: 3 series por ejercicio, siempre con el método de las 3 series (abajo).',
        'Frecuencia: 1–2 veces por semana.',
      ] },
      { title: 'Calentamiento y activación', items: [
        'Movilidad: balanceos de pierna y buenos días sin peso.',
        'Activación: 2 series × 12 de curl femoral ligero.',
      ] },
      { title: 'Patrón 1 · Bisagra de cadera', items: ['Objetivo: estiramiento bajo carga (el mayor estímulo para el isquio).', 'Regla de oro: la cadera va atrás, la espalda no se redondea.', 'Descanso: 2 a 3 minutos.'] },
      { title: 'Patrón 2 · Curl femoral', items: ['Objetivo: flexión de rodilla. El curl sentado es la variante con más estímulo.', 'Tempo: 3 s excéntrica / 1 s de contracción.', 'Descanso: 90 segundos.'] },
    ],
    'Glúteos': [
      { title: 'Pautas básicas', items: [
        'Estructura: un ejercicio del Patrón 1 (empuje de cadera) + uno del Patrón 2 (estiramiento o unilateral) + uno del Patrón 3 (glúteo medio o patadas). Finisher opcional.',
        'Volumen: 3 series por ejercicio, siempre con el método de las 3 series (abajo).',
        'Frecuencia: 1–2 veces por semana.',
      ] },
      { title: 'Calentamiento y activación', items: [
        'Movilidad: aperturas de cadera y puente de glúteo sin peso.',
        'Activación: 2 series × 15–20 de abducción con banda o en máquina ligera.',
      ] },
      { title: 'Patrón 1 · Empuje de cadera', items: ['Objetivo: máxima contracción del glúteo mayor con mucha carga.', 'Mecánica: barbilla al pecho y pelvis en retroversión arriba; aguanta 2 s.', 'Descanso: 2 a 3 minutos.'] },
      { title: 'Patrón 2 · Estiramiento y unilaterales', items: ['Objetivo: trabajar el glúteo estirado (búlgaras, zancadas con déficit, sumo).', 'Mecánica: torso inclinado adelante para cargar más el glúteo.'] },
      { title: 'Patrón 3 · Glúteo medio y patadas', items: ['Objetivo: parte alta y lateral del glúteo.'] },
    ],
    'Aductores': [
      { title: 'Pautas básicas', items: [
        'Estructura: 1 ejercicio de 3 series al final del día de pierna.',
        'Útil para estabilidad de rodilla y cadera y para completar el volumen de la pierna.',
      ] },
    ],
    'Gemelos': [
      { title: 'Pautas básicas', items: [
        'Estructura: un ejercicio del Patrón 1 (gemelo) + uno del Patrón 2 (sóleo).',
        'Frecuencia: 2 veces por semana (se recuperan rápido).',
        'Regla de oro: 2 s de pausa en el estiramiento abajo. Sin rebotes.',
      ] },
      { title: 'Patrón 1 · Gemelo (rodilla extendida)', items: ['Objetivo: gastrocnemio, la parte visible del gemelo.'] },
      { title: 'Patrón 2 · Sóleo (rodilla flexionada)', items: ['Objetivo: sóleo, que da grosor a la pierna.'] },
    ],
    'Core / Abdomen': [
      { title: 'Pautas básicas', items: [
        'Estructura: un ejercicio del Patrón 1 (flexión) + uno del Patrón 2 (piernas) + uno del Patrón 3 (oblicuos o antirrotación).',
        'Frecuencia: 2–3 veces por semana, al final del entreno.',
        'Regla de oro: el abdomen se entrena con carga y progresión, como cualquier músculo.',
      ] },
    ],
    'Antebrazo': [
      { title: 'Pautas básicas', items: [
        'Estructura: 1–2 ejercicios al final del día de brazo o espalda.',
        'Los remos pesados y el peso muerto sin correas ya trabajan el agarre.',
      ] },
    ],
    'Bíceps': [
      { title: 'Pautas básicas', items: [
        'Estructura: selecciona un solo ejercicio de cada patrón de movimiento (Patrón 1 + Patrón 2 + Patrón 3). Añade el Finisher de forma opcional al final para agotamiento completo.',
        'Volumen: 3 series por ejercicio, siempre con el método de las 3 series (abajo).',
        'Frecuencia: 1 vez por semana.',
      ] },
      { title: 'Calentamiento y activación', items: [
        'Movilidad: rotaciones de muñecas + flexión/extensión de codos.',
        'Activación específica: 2 series × 10–12 reps con peso muy ligero (lejos del fallo) usando un curl básico en polea o mancuerna.',
      ] },
      { title: 'Patrón 1 · Curl pesado (Masa y Fuerza)', items: [
        'Objetivo: sobrecarga mecánica básica. Codos fijos y sin impulso.',
        'Mecánica: codos alineados. Ejercicios con barra, mancuernas pesadas o poleas base.',
        'Descanso: 2 a 3 minutos entre series.',
        'Progresión: si logras el número máximo de repeticiones en todas las series con técnica perfecta, aumenta el peso en la siguiente sesión (incremento lineal).',
      ] },
      { title: 'Patrón 2 · Aislamiento y detalle (pico y cabeza corta)', items: [
        'Objetivo: codos adelantados. Máxima contracción y acortamiento del bíceps.',
        'Mecánica: ejercicios en banco Scott, predicador o curls concentrados.',
        'Descanso: 90 a 120 segundos (al ser ejercicios de mayor aislamiento mecánico).',
      ] },
      { title: 'Patrón 3 · Estiramiento y braquial (grosor y cabeza larga)', items: [
        'Objetivo: longitud muscular y grosor lateral (cabeza larga y braquial). Codos retrasados por detrás del torso o agarres neutros.',
        'Mecánica: curls inclinados, Bayesian o variantes martillo.',
        'Tempo: 3 s excéntrica (enfatizando el estiramiento) / concéntrica explosiva.',
        'Descanso: 90 segundos.',
        'Regla de oro: el estiramiento es el protagonista. Si acortas el recorrido, anulas el objetivo. Jamás sacrifiques rango por peso.',
      ] },
      { title: 'Patrón 4 · Finisher (congestión final y bombeo extremo)', items: [
        'Objetivo: vaciar las reservas de glucógeno y lograr la máxima congestión sanguínea.',
        'Mecánica: ejercicios de aislamiento puro, autocarga o bandas elásticas. Opcional al final del entreno.',
        'Descanso: mínimo posible (30 a 45 segundos).',
        'Regla de oro: peso moderado-ligero. No busques mover kilos, busca mover sangre y provocar acidosis muscular (sensación de quemazón extrema).',
      ] },
    ],
    'Tríceps': [
      { title: 'Pautas básicas', items: [
        'Estructura: selecciona un solo ejercicio de cada patrón de movimiento (Patrón 1 + Patrón 2 + Patrón 3). Añade el Patrón 4 de forma opcional al final para agotamiento completo.',
        'Volumen: 3 series por ejercicio, siempre con el método de las 3 series (abajo).',
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
        'Descanso: 2 a 3 minutos (90 segundos en variantes de peso corporal).',
      ] },
      { title: 'Patrón 2 · Cabeza larga (construcción / estiramiento)', items: [
        'Objetivo: masa general y énfasis en la porción larga mediante flexión de hombro (trabajo tras nuca / estiramiento).',
        'Mecánica: trabajo tras nuca con flexión de hombro. Poleas, barra Z o mancuernas llevando el bíceps cerca de la oreja.',
        'Descanso: 90 a 120 segundos.',
      ] },
      { title: 'Patrón 3 · Cabeza lateral (herradura / densidad)', items: [
        'Objetivo: masa general, detalle y densidad mediante tracción vertical hacia abajo.',
        'Mecánica: extensiones verticales en polea con cuerda, barra recta o barra en V. Codos pegados a los costados.',
        'Tempo: 1 s excéntrica / 1 s bloqueo (apretando al máximo) / 1 s concéntrica.',
        'Descanso: 60 a 90 segundos.',
      ] },
      { title: 'Patrón 4 · Cabeza medial (aislamiento / detalle)', items: [
        'Objetivo: estimular la porción más profunda del tríceps mediante supinación (agarre invertido), máxima extensión y aislamiento unilateral.',
        'Mecánica: máximo aislamiento. Extensiones unilaterales con cable, agarres invertidos (supinos) o patadas de tríceps (Kickbacks) con cable para buscar el acortamiento completo.',
        'Tempo: 1 s excéntrica / 2 s de contracción estricta abajo / 1 s concéntrica.',
        'Descanso: 60 segundos.',
        'Regla de oro: cero balanceos. Olvídate de los kilos; el foco es el aislamiento puro y la tensión en el punto de bloqueo.',
      ] },
    ],
  };

  /* El método de las 3 series, explicado en las pautas de cada músculo (justo después de las pautas básicas). */
  const METHOD_GUIDE = { title: 'Método de las 3 series', items: [
    'Aproximación: antes de las series efectivas de cada ejercicio, haz de 1 a 3 series de aproximación de 7–8 repeticiones para calentar y preparar el músculo, con 1 min de descanso entre series.',
    'Cuántas: músculo grande o en frío, 3 series al 50, 70 y 90 % del peso efectivo; músculo mediano o templado, 2 series al 50 y 70 % del peso efectivo; músculo pequeño o ya caliente, 1 serie al 50 % del peso efectivo.',
    'Serie 1 · Efectiva: entre 12 y 15 repeticiones, quedándote a 1 repetición del fallo.',
    'Serie 2 · Pesada: sube el peso y llega al fallo total entre 6 y 8 repeticiones.',
    'Serie 3 · Agotamiento: vuelve al peso de la serie 1 y haz todas las repeticiones que puedas, hasta el fallo total.',
  ] };
  for (const [group, sections] of Object.entries(window.LIBRARY_GUIDES)) {
    const rest = LEGS.includes(group) ? 'Descanso: 3 minutos entre series.' : SHORT.includes(group) ? 'Descanso: 1 minuto y 30 segundos entre series.' : 'Descanso: 2 minutos entre series.';
    for (const sec of sections) sec.items = sec.items.map((t) => (/^Descanso:/.test(t) ? rest : t));
    const i = sections.findIndex((x) => x.title === 'Pautas básicas');
    sections.splice(i + 1, 0, METHOD_GUIDE);
  }
})();
