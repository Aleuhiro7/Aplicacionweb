/* Textos de la guía de entrenamiento: los usan el PDF de la rutina (views.js) y la zona del cliente (cliente.js). */
(function () {
  window.GUIDES = {
    /** Página «Protocolo innegociable». */
    protocolIntro: 'Su incumplimiento impide la supervisión y la evolución del plan.',
    protocol: [
      ['Feedback visual (vídeos).', 'Grábate la serie más pesada de cada ejercicio. Sin esto no se puede corregir la técnica ni la intensidad.'],
      ['Registro de pesos.', 'Apunta el peso máximo logrado en cada serie pesada para asegurar la sobrecarga progresiva.'],
      ['Check-in y reporte.', 'Es obligatorio cumplir con el reporte semanal o mensual.'],
      ['Sinceridad e integridad.', 'No modifiques el plan ni la dieta por tu cuenta. Informa de inmediato ante cualquier dolor, lesión o exceso de estrés.'],
      ['Comunicación directa.', 'Ante cualquier duda, contáctame por WhatsApp de inmediato. No asumas nada.'],
      ['Gestión de ausencias.', 'Si fallas un día, cuenta como descanso. Retoma el plan exactamente donde lo dejaste. No te saltes sesiones.'],
      ['Calendario continuo.', 'No te rijas por semanas naturales. El objetivo es completar todas las sesiones en el orden establecido, aunque el ciclo tarde más de 7 días.'],
      ['Gestión de agujetas.', 'Si el dolor muscular es excesivo, sáltate ese día, haz el siguiente entrenamiento del ciclo y recupera el anterior cuando estés recuperado.'],
    ],
    /** Página «Cómo entrenar»: [título, texto] o [título, [líneas]]; las líneas pueden llevar <b>. */
    tips: [
      ['Calienta antes de empezar', [
        '<b>Movilidad:</b> 5–10 minutos antes de empezar el entreno.',
        '<b>Series de aproximación:</b> antes de las series efectivas de cada ejercicio, de 1 a 3 series de 7–8 repeticiones subiendo el peso: 50 %, 70 % y 90 % del peso que vas a usar.',
        '<b>Cuántas:</b> músculo grande o todavía frío, las 3 (50 %, 70 % y 90 %). Pequeño o ya caliente, 2 (70 % y 90 %) o solo 1 (70 %).',
      ]],
      ['Las 3 series de cada ejercicio', [
        '<b>1.ª serie · Efectiva:</b> 12–15 repeticiones, quedándote a 1 del fallo.',
        '<b>2.ª serie · Pesada:</b> sube el peso y llega al fallo total en 6–8 repeticiones.',
        '<b>3.ª serie · Agotamiento:</b> vuelve al peso de la 1.ª y llega al fallo total.',
      ]],
      ['La técnica, primero', 'Recorrido completo y controlado. Si la técnica se rompe, la serie ha terminado.'],
      ['Respeta los descansos', 'Usa el descanso que pone en cada ejercicio para rendir en la siguiente serie.'],
      ['Progresa poco a poco', 'Cuando completes todas las repeticiones con buena técnica, sube un poco el peso la próxima vez. Aumentar la intensidad también es progreso.'],
      ['Apunta tus pesos', 'Anota el peso y las repeticiones de cada serie para saber qué superar el próximo día.'],
      ['Escucha a tu cuerpo', 'Si algo duele (dolor, no esfuerzo), para y coméntamelo.'],
    ],
  };
})();
