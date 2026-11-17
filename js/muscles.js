/* Músculos que trabaja cada ejercicio de serie: principales (rojo) y secundarios (naranja).
 * Se asignan por patrón (prefijo del id) con algunas excepciones por ejercicio. */
(function () {
  'use strict';
  const LABELS = {
    pecho: 'Pectoral', dorsal: 'Dorsales', trapecio: 'Trapecio', hombro_ant: 'Hombro anterior', hombro_lat: 'Hombro lateral',
    hombro_post: 'Hombro posterior', biceps: 'Bíceps', triceps: 'Tríceps', antebrazo: 'Antebrazo', abdomen: 'Abdomen',
    lumbar: 'Zona lumbar', gluteo: 'Glúteos', cuadriceps: 'Cuádriceps', isquios: 'Isquiotibiales', aductores: 'Aductores', gemelos: 'Gemelos',
  };
  const M = (p, s = []) => ({ p, s });
  const BY_PATTERN = {
    'bic-p1': M(['biceps'], ['antebrazo']), 'bic-p2': M(['biceps'], ['antebrazo']), 'bic-p3': M(['biceps', 'antebrazo']), 'bic-p4': M(['biceps'], ['antebrazo']),
    'tri-p1': M(['triceps'], ['pecho', 'hombro_ant']), 'tri-p2': M(['triceps']), 'tri-p3': M(['triceps']), 'tri-p4': M(['triceps']),
    'pec-p1': M(['pecho'], ['hombro_ant', 'triceps']), 'pec-p2': M(['pecho', 'hombro_ant'], ['triceps']), 'pec-p3': M(['pecho'], ['triceps', 'hombro_ant']),
    'pec-p4': M(['pecho'], ['hombro_ant']), 'pec-p5': M(['pecho'], ['triceps', 'hombro_ant']),
    'esp-p1': M(['dorsal'], ['hombro_post', 'biceps', 'antebrazo']), 'esp-p2': M(['dorsal', 'trapecio'], ['hombro_post', 'biceps', 'lumbar']),
    'esp-p3': M(['dorsal'], ['triceps']), 'esp-p4': M(['trapecio'], ['hombro_post', 'antebrazo']), 'esp-p5': M(['lumbar', 'gluteo'], ['isquios', 'trapecio', 'antebrazo']),
    'hom-p1': M(['hombro_ant', 'hombro_lat'], ['triceps', 'trapecio']), 'hom-p2': M(['hombro_lat'], ['trapecio']), 'hom-p3': M(['hombro_post'], ['trapecio']),
    'hom-p4': M(['hombro_ant'], ['pecho']), 'hom-p5': M(['hombro_lat'], ['trapecio']),
    'cua-p1': M(['cuadriceps', 'gluteo'], ['aductores', 'lumbar']), 'cua-p2': M(['cuadriceps', 'gluteo'], ['aductores', 'gemelos']),
    'cua-p3': M(['cuadriceps']), 'cua-p4': M(['cuadriceps']),
    'isq-p1': M(['isquios', 'gluteo'], ['lumbar', 'antebrazo']), 'isq-p2': M(['isquios'], ['gemelos']), 'isq-p3': M(['isquios'], ['lumbar']),
    'glu-p1': M(['gluteo'], ['isquios']), 'glu-p2': M(['gluteo', 'cuadriceps'], ['isquios', 'aductores']), 'glu-p3': M(['gluteo']), 'glu-p4': M(['gluteo']),
    'adu-p1': M(['aductores'], ['gluteo']),
    'gem-p1': M(['gemelos']), 'gem-p2': M(['gemelos']), 'gem-p3': M(['gemelos']),
    'abd-p1': M(['abdomen']), 'abd-p2': M(['abdomen']), 'abd-p3': M(['abdomen'], ['lumbar']),
    'ant-p1': M(['antebrazo'], ['biceps']),
  };
  const BY_ID = {
    'bic-p4-1': M(['dorsal', 'biceps'], ['antebrazo', 'hombro_post']),
    'tri-p1-6': M(['triceps'], ['pecho']),
    'pec-p4-6': M(['pecho'], ['dorsal', 'triceps']),
    'esp-p4-5': M(['hombro_post', 'trapecio'], ['biceps']),
    'hom-p2-6': M(['hombro_lat', 'trapecio'], ['biceps']),
    'hom-p3-3': M(['hombro_post'], ['trapecio']),
    'glu-p2-3': M(['gluteo', 'aductores', 'cuadriceps'], ['isquios', 'lumbar']),
    'glu-p2-5': M(['gluteo', 'cuadriceps'], ['isquios']),
    'cua-p1-7': M(['cuadriceps', 'gluteo'], ['aductores']),
    'adu-p1-4': M(['aductores'], ['abdomen']),
    'abd-p2-4': M(['abdomen'], ['dorsal', 'hombro_ant']),
    'abd-p3-4': M(['abdomen'], ['hombro_ant', 'gluteo']),
    'ant-p1-4': M(['antebrazo', 'trapecio'], ['abdomen']),
  };
  /** Músculos por defecto según el grupo (ejercicios añadidos a mano). */
  const BY_GROUP = {
    'Pecho': BY_PATTERN['pec-p1'], 'Espalda': BY_PATTERN['esp-p2'], 'Hombros': BY_PATTERN['hom-p1'], 'Bíceps': BY_PATTERN['bic-p1'], 'Tríceps': BY_PATTERN['tri-p2'],
    'Cuádriceps': BY_PATTERN['cua-p1'], 'Isquiotibiales': BY_PATTERN['isq-p1'], 'Glúteos': BY_PATTERN['glu-p1'], 'Gemelos': BY_PATTERN['gem-p1'],
    'Aductores': BY_PATTERN['adu-p1'], 'Antebrazo': BY_PATTERN['ant-p1'], 'Core / Abdomen': BY_PATTERN['abd-p1'],
  };
  function musclesOf(ex) {
    if (!ex) return null;
    if (ex.muscles) return ex.muscles;
    if (BY_ID[ex.id]) return BY_ID[ex.id];
    const pre = String(ex.id || '').split('-').slice(0, 2).join('-');
    if (BY_PATTERN[pre]) return BY_PATTERN[pre];
    if (ex.likeId) return musclesOf({ id: ex.likeId });
    return BY_GROUP[ex.group] || null;
  }
  window.Muscles = { LABELS, musclesOf };
})();
