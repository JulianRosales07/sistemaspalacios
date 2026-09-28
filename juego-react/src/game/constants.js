/* Constantes y configuración de Batería al 100 */

export const CONFIG = {
  LOGIN_URL: '/api/employees/active-basic/{cedula}',
  LOGIN_FALLBACK_URL: 'http://localhost:3001/api/employees/active-basic/{cedula}',
  EMPLOYEES_URL: '/api/employees',
  EMPLOYEES_FALLBACK_URL: 'http://localhost:3001/api/employees',
  LOGIN_METODO: 'GET',
  LOGIN_HEADERS: {},
  CAMPO_NOMBRE: 'nombre',
  CAMPO_AREA: 'dependencia',
  CAMPO_ESTADO: 'estado',
  ESTADO_VALIDO: 'ACTIVO',
  CAMPO_TOKEN: '',
  RESULTADOS_URL: 'https://usxypuoclgypnlfehllo.supabase.co/rest/v1/partida',
  RANKING_URL: 'https://usxypuoclgypnlfehllo.supabase.co/rest/v1/ranking?select=*',
  RANKING_FALLBACK_URL: 'https://usxypuoclgypnlfehllo.supabase.co/rest/v1/ranking_publico?select=*',
  RANKING_AREAS_URL: 'https://usxypuoclgypnlfehllo.supabase.co/rest/v1/ranking_areas?select=*',
  HEADERS: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzeHlwdW9jbGd5cG5sZmVobGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNTIyODYsImV4cCI6MjEwNTkyODI4Nn0.zjxq4EdlVYGJghJtZ6s5LLINlQ-D_r6eJYItNA_z2sw',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzeHlwdW9jbGd5cG5sZmVobGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNTIyODYsImV4cCI6MjEwNTkyODI4Nn0.zjxq4EdlVYGJghJtZ6s5LLINlQ-D_r6eJYItNA_z2sw'
  }
};

export const DEPARTAMENTOS_OFICIALES = [
  'ADMINISTRATIVO Y FINANCIERO',
  'COMUNICACIONES',
  'CONTACT CENTER',
  'GERENCIA GENERAL',
  'GESTIÓN HUMANA',
  'INFRAESTRUCTURA',
  'INGENIERÍA Y GESTIÓN',
  'LOGÍSTICA',
  'OPERACIONES',
  'PRODUCTO Y SERVICIO',
  'PROYECTOS TI'
];

export const DIFS = {
  facil: {
    nombre: 'Fácil',
    vel: 0.8,
    spawn: 1.25,
    drenaje: 0.7,
    tiempo: 1.25,
    dano: 0.75,
    trampas: 0.6,
    jefe: 80,
    hold: 0.25,
    descanso: 30,
    reintento: 70,
    mult: 1,
    nota: 'Más lento, más tiempo para decidir y más descanso entre capítulos.'
  },
  media: {
    nombre: 'Media',
    vel: 1,
    spawn: 1,
    drenaje: 1,
    tiempo: 1,
    dano: 1,
    trampas: 1,
    jefe: 100,
    hold: 0.35,
    descanso: 20,
    reintento: 60,
    mult: 1.5,
    nota: 'El reto equilibrado.'
  },
  dificil: {
    nombre: 'Difícil',
    vel: 1.22,
    spawn: 0.8,
    drenaje: 1.3,
    tiempo: 0.85,
    dano: 1.25,
    trampas: 1.4,
    jefe: 130,
    hold: 0.45,
    descanso: 10,
    reintento: 50,
    mult: 2,
    nota: 'Más rápido, más trampas y menos descanso entre capítulos.'
  }
};

export function multTxt(d) {
  return 'x' + d.mult.toLocaleString('es-CO');
}

export const K_SES = 'b100_sesion';
export const K_PERF = 'b100_perfil_';
export const K_RANK = 'b100_ranking';
export const K_SONIDO = 'b100_sonido';

export const P = {
  fondo: '#221B47',
  item: '#30286A',
  tinta: '#FFF4E0',
  suave: '#B9AED8',
  verde: '#3DDC84',
  rojo: '#FF5C5C',
  ambar: '#FFB347',
  azul: '#4FC3F7',
  morado: '#B266FF',
  mesa: '#3A3170',
  oscuro: '#150F2E'
};

export const EF = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif';
export const TF = '"Nunito","Trebuchet MS","Segoe UI",sans-serif';

export const INSIGNIAS = [
  ['escudo', '🛡️', 'Escudo de hierro', 'Rechaza 15 sobrecargas con Decir NO', p => (p.cont?.no || 0) >= 15],
  ['guardian', '🤝', 'Guardián del equipo', 'Frena 15 conflictos', p => (p.cont?.interv || 0) >= 15],
  ['desconectado', '✂️', 'Maestro de la desconexión', 'Corta 30 mensajes de trabajo', p => (p.cont?.cortes || 0) >= 30],
  ['ojo', '👁️', 'Ojo de lince', 'Descubre 10 trampas del Drenador', p => (p.cont?.trampas || 0) >= 10],
  ['respira', '🌬️', 'Respira hondo', 'Haz 5 pausas activas', p => (p.cont?.pausas || 0) >= 5],
  ['heroe', '🏆', 'Héroe de Nariño', 'Vence al Drenador', p => !!p.drenador]
];

export const ARTE = {
  Narrador: '#3E6FB0',
  Chispa: '#E8A23A',
  'El Drenador': '#4B2378'
};

export const HIST_INTRO = [
  ['Narrador', '🌋', 'Pasto amanece con neblina y con el Galeras de fondo. Desde aquí, Sistemas Palacios lleva internet por fibra y radio a los 64 municipios de Nariño, hasta veredas donde la antena llega a caballo.'],
  ['Narrador', '🌫️', 'Pero este año bajó del volcán una neblina distinta: el Drenador. Se alimenta del estrés, del maltrato y del trabajo que nunca termina. Cada vez que alguien del equipo se apaga, un nodo de la red pierde señal.'],
  ['Chispa', '⚡', '¡Quiubo! Soy Chispa y vivo en la fibra óptica. Para salvar la red necesitamos recuperar tres Núcleos de Energía: el de la sede, el del Centro de Operaciones y el de tu casa.'],
  ['Chispa', '⚠️', 'Dos advertencias. Tu batería pasa de un capítulo al siguiente: lo que pierdas, lo arrastras. Y el Drenador disfraza sus trampas de cosas buenas. Si algo brilla morado, desconfía.'],
  ['Chispa', '🎓', 'Tranquilo: antes de cada capítulo hay un tutorial corto para practicar sin perder nada.'],
  ['El Drenador', '👁️', 'Achichay… Aquí el frío cansa, y el cansancio es mío. Tarde o temprano, todos se desconectan.']
];

export const HIST_VICTORIA = [
  ['Narrador', '✨', 'La neblina se levantó sobre el valle de Atriz. Uno a uno, los nodos volvieron a tener señal: de Pasto a Tumaco y de Ipiales a La Unión.'],
  ['Chispa', '⚡', 'No lo venciste aguantando más, sino cuidándote mejor: pusiste límites, frenaste el maltrato, pediste apoyo y te desconectaste.'],
  ['Narrador', '🌱', 'La red de Sistemas Palacios es tan fuerte como la gente que la sostiene. El Drenador puede volver cuando normalizamos el estrés o el maltrato, pero ya sabes enfrentarlo, y no tienes que hacerlo solo.']
];

export const HIST_ESCAPO = [
  ['Narrador', '🌫️', 'El Drenador se escondió, debilitado, entre la neblina del Galeras.'],
  ['Chispa', '⚡', 'No importa. Lo que aprendiste hoy es lo que de verdad lo detiene: límites, apoyo y desconexión. Puedes volver a enfrentarlo cuando quieras.']
];

export const CAPS_META = [
  {
    id: 0,
    nombre: 'La sede',
    icono: '🏢',
    color: '#2BB3C0',
    tabla: 't-teal',
    lienzo: '#FFE066',
    dur: 45,
    drenaje: 0.45,
    no: true,
    resumen: 'Carga de trabajo y pausas',
    historia: [
      ['Narrador', '🏢', 'Es cierre de mes en la sede de Sistemas Palacios en Pasto. Los tickets llueven, los clientes llaman y la facturación no espera.'],
      ['Chispa', '🛡️', 'El Drenador disfrazó todo de urgente. Atrapa lo que te recarga, esquiva lo que te sobrecarga y, cuando haga falta, di que no.']
    ],
    pasos: [
      ['👆', 'Arrastra el dedo (o usa las flechas) para mover tu tabla.'],
      ['🟢', 'Atrapa lo verde: agua, almuerzo, apoyo, pausas.'],
      ['🔴', 'Esquiva lo rojo: urgencias sin priorizar, reuniones sin agenda, tareas de noche.'],
      ['🛡️', 'Toca Decir NO (o la barra espaciadora) para crear un escudo.'],
      ['👁️', 'Lo verde con brillo morado es una trampa. Esquívalo.']
    ],
    claves: [
      'Cuando todo es urgente, nada lo es: priorizar y decir que no también es trabajar bien.',
      'Las pausas no son tiempo perdido: recargan la concentración y bajan el estrés.'
    ]
  },
  {
    id: 1,
    nombre: 'Centro de Operaciones',
    icono: '🖥️',
    color: '#6DBA3C',
    tabla: 't-verde',
    lienzo: '#FFB8C6',
    dur: 45,
    drenaje: 0.35,
    no: false,
    resumen: 'Relaciones y buen trato',
    historia: [
      ['Narrador', '🖥️', 'En el Centro de Operaciones se vigila la red de todo Nariño. Pero entre pantalla y pantalla, el Drenador sembró gritos, burlas y chismes.'],
      ['Chispa', '⚡', 'Aquí la batería es de todo el equipo. Si un conflicto no se frena, se contagia de puesto en puesto.']
    ],
    pasos: [
      ['✋', 'Pon el dedo un instante sobre los conflictos rojos hasta que se llene el círculo verde.'],
      ['🔵', 'Toca rápido a quien pide ayuda.'],
      ['⚪', 'No toques los rumores grises: déjalos pasar.'],
      ['👁️', 'Si una burbuja azul brilla morado, es un chisme disfrazado. No la toques.']
    ],
    claves: [
      'El silencio frente al maltrato lo normaliza. Intervenir con respeto sí cambia las cosas.',
      'El Comité de Convivencia Laboral acompaña los casos de acoso con confidencialidad.'
    ]
  },
  {
    id: 2,
    nombre: 'La casa',
    icono: '🏠',
    color: '#EE9A2B',
    tabla: 't-naranja',
    lienzo: '#CDBDFF',
    dur: 45,
    drenaje: 0.35,
    no: false,
    resumen: 'Desconexión y vida personal',
    historia: [
      ['Narrador', '🌙', 'Son más de las 6. Hace frío en Pasto, achichay, y en casa huele a comida caliente. Pero el Drenador convirtió el celular en una puerta para que el trabajo se cuele.'],
      ['Chispa', '⚡', 'Protege tu tiempo con los tuyos. Si estás de turno de disponibilidad acordado, eso sí se atiende.']
    ],
    pasos: [
      ['✂️', 'Desliza el dedo sobre los mensajes de trabajo rojos para cortarlos.'],
      ['💚', 'Toca los momentos verdes (familia, descanso, amigos) para vivirlos.'],
      ['🚨', 'El turno acordado (ámbar) sí se atiende: tócalo.'],
      ['👁️', 'Si un momento verde brilla morado, es trabajo disfrazado: córtalo.']
    ],
    claves: [
      'La desconexión laboral es un derecho en Colombia (Ley 2191 de 2022).',
      'Dormir bien y compartir con los tuyos es la recarga más importante.'
    ]
  },
  {
    id: 3,
    nombre: 'El Drenador',
    icono: '👁️',
    color: '#8A55C9',
    tabla: 't-morado',
    lienzo: '#B266FF',
    dur: 60,
    drenaje: 0.4,
    no: false,
    resumen: 'La batalla final',
    historia: [
      ['Narrador', '🗼', 'Con los tres núcleos brillando llegaste al nodo principal, en lo alto del cerro, frente al Galeras. La neblina del Drenador cubre la torre.'],
      ['El Drenador', '👁️', '¿Crees que puedes con todo? Nadie puede con todo.'],
      ['Chispa', '⚡', 'No se trata de poder con todo, sino de saber qué cortar, qué recibir y cuándo pedir ayuda. ¡Vamos!']
    ],
    pasos: [
      ['✂️', 'Corta los ataques del Drenador antes de que te alcancen: cada corte lo debilita.'],
      ['💚', 'Toca a tus aliados (apoyo, pausas, agua) para recargarte y golpearlo más fuerte.'],
      ['👁️', 'Las trampas moradas se cortan, nunca se tocan: si las tocas, él se recupera.'],
      ['⏱️', 'Tienes 60 segundos para vencerlo.']
    ],
    claves: [
      'No se trata de aguantar más, sino de cuidarte mejor.',
      'Límites, apoyo y desconexión: esa es la receta contra el agotamiento.'
    ]
  }
];
