import { VideoProject, Channel, Agent, Notification, AutomationNode, TeamMember } from './types';

export const INITIAL_CHANNELS: Channel[] = [
  { id: 'canal_cristiano', name: 'Canal Cristiano', status: 'Produciendo', subscribers: 125000, avatar: '✝️', type: 'YouTube' },
  { id: 'canal_finanzas', name: 'Canal Finanzas', status: 'Publicado', subscribers: 84000, avatar: '📈', type: 'YouTube' },
  { id: 'canal_ia', name: 'Canal IA', status: 'En edición', subscribers: 45000, avatar: '🤖', type: 'TikTok' },
  { id: 'canal_podcast', name: 'Canal Podcast', status: 'Investigación', subscribers: 18000, avatar: '🎙️', type: 'Podcast' }
];

export const INITIAL_SERIES = [
  'Reflexiones',
  'Historias Bíblicas',
  'Shorts',
  'Podcast',
  'Versículos'
];

export const INITIAL_PROJECTS: VideoProject[] = [
  {
    id: 'ansiedad_biblia',
    title: '¿Qué dice la Biblia sobre la ansiedad?',
    series: 'Reflexiones',
    status: 'Edición',
    progress: 80,
    duration: '08:45',
    outline: [
      'Introducción: La ansiedad en el mundo actual',
      'Capítulo 1: Filipenses 4:6-7 - Oración y Paz',
      'Capítulo 2: Mateo 6:25-34 - No os afanéis',
      'Capítulo 3: 1 Pedro 5:7 - Echando vuestra ansiedad sobre Él',
      'Conclusión: Aplicación práctica y paz divina'
    ],
    script: `¿Te has sentido abrumado últimamente? En un mundo lleno de prisa, la ansiedad parece ser el compañero silencioso de muchos. Pero hoy, quiero invitarte a detenerte por un momento. ¿Qué dice realmente la Biblia sobre este sentimiento que a veces nos roba el aire?

Filipenses 4:6-7 nos da una clave poderosa: "Por nada estéis afanosos, sino sean conocidas vuestras peticiones delante de Dios en toda oración y ruego, con acción de gracias." No nos dice simplemente "no te preocupes", sino que nos da un camino activo: llevarlo todo en oración con agradecimiento.

Jesús mismo abordó esto en Mateo 6. Él mira a las aves del cielo y a los lirios del campo. Ninguno se afana, y sin embargo, el Padre Celestial los alimenta y viste con hermosura. ¿No valéis vosotros mucho más que ellos? La ansiedad no puede añadir un solo codo a nuestra estatura.

Finalmente, 1 Pedro 5:7 nos anima con una ternura infinita: "Echando toda vuestra ansiedad sobre él, porque él tiene cuidado de vosotros." No fuiste creado para llevar esa carga solo. Dios desea que se la entregues por completo.

Recuerda esto hoy: tu situación actual no define tu mañana, y la paz que sobrepasa todo entendimiento está disponible para ti ahora mismo. Respira, confía, y entrega tu día al Creador.`,
    scenes: [
      {
        id: 'scene_ans_1',
        text: 'Primer plano de una persona sentada junto a una ventana, mirando la lluvia con expresión pensativa.',
        imageUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&q=80&w=400',
        voiceoverPrompt: 'Tone: Calming, slow, deep. Speak about the heavy weight of anxiety in today\'s fast-paced world.',
        musicTrack: 'Peaceful Ambient Piano',
        duration: 10,
        transition: 'Fade'
      },
      {
        id: 'scene_ans_2',
        text: 'Manos abriendo una Biblia antigua iluminada por un rayo de sol dorado que entra por la ventana.',
        imageUrl: 'https://images.unsplash.com/photo-1504052442567-8256c7890e2d?auto=format&fit=crop&q=80&w=400',
        voiceoverPrompt: 'Tone: Inspiring. Read Philippians 4:6-7 with absolute reverence and clarity.',
        musicTrack: 'Soft Orchestral Strings',
        duration: 12,
        transition: 'Dissolve'
      },
      {
        id: 'scene_ans_3',
        text: 'Una toma de dron de un hermoso campo de flores silvestres meciéndose con el viento y pájaros volando en un cielo despejado.',
        imageUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&q=80&w=400',
        voiceoverPrompt: 'Tone: Joyful, hopeful. Describe Jesus\' words in Matthew 6 about the lilies of the field and birds.',
        musicTrack: 'Acoustic Guitar Harmony',
        duration: 15,
        transition: 'Whip Cut'
      }
    ],
    seoTitles: [
      '¿Qué dice la BIBLIA sobre la ANSIEDAD? | Encontrando Paz en la Tormenta',
      'El Remedio Bíblico para la Ansiedad y el Estrés (Filipenses 4)',
      '¿Ansioso? Escucha lo que Dios te dice HOY (Reflexión Cristiana)'
    ],
    seoDescription: '¿Estás pasando por un momento de ansiedad o estrés? En esta reflexión bíblica profunda analizamos Filipenses 4:6-7, Mateo 6 y 1 Pedro 5:7 para descubrir cómo la palabra de Dios nos ofrece una paz que sobrepasa todo entendimiento humano. Suscríbete para recibir más contenido inspirador diario.',
    seoTags: ['ansiedad', 'paz de Dios', 'Biblia', 'reflexion cristiana', 'Filipenses 4', 'Mateo 6', 'salud mental cristiana', 'Dios te habla hoy', 'oracion'],
    scheduledAt: '2026-06-29T18:00:00Z',
    thumbnailUrl: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 'moises_historia',
    title: 'La historia de Moisés',
    series: 'Historias Bíblicas',
    status: 'Guion',
    progress: 45,
    duration: '12:30',
    outline: [
      'Introducción: El decreto del Faraón y la canasta en el Nilo',
      'Capítulo 1: Criado en el palacio de Egipto',
      'Capítulo 2: El desierto de Madián y la zarza ardiente',
      'Capítulo 3: Las diez plagas y el cruce del Mar Rojo',
      'Conclusión: Los diez mandamientos y el legado de Moisés'
    ],
    script: `La historia de Moisés es una de las epopeyas más extraordinarias de la humanidad. Todo comienza en un momento de opresión absoluta, donde un Faraón temeroso ordena la muerte de todos los niños varones hebreos. Pero la fe de una madre desafía al imperio.

Colocado en una canasta de juncos untada con brea, el pequeño Moisés flota a la deriva en el río Nilo. Encontrado por la mismísima hija del Faraón, es adoptado en la realeza egipcia, creciendo con la mejor educación, riquezas y poder que el mundo antiguo podía ofrecer.

Pero su corazón pertenecía a su pueblo oprimido. Tras un trágico suceso, Moisés huye al desierto de Madián, donde pasa 40 años como un humilde pastor. Es allí, en el silencio del monte Horeb, donde Dios se le revela en una zarza que arde pero no se consume, entregándole la misión de su vida: "Deja ir a mi pueblo".

Lo que sigue es un choque de imperios y milagros. El Mar Rojo abriéndose de par en par, la columna de fuego guiándolos de noche y el maná cayendo del cielo. Moisés sube al Sinaí y desciende con las tablas escritas por el dedo de Dios. Hoy redescubriremos el viaje del libertador elegido.`,
    scenes: [
      {
        id: 'scene_moi_1',
        text: 'Vista cinematográfica del río Nilo al atardecer, juncos altos y una pequeña canasta de mimbre flotando suavemente.',
        imageUrl: 'https://images.unsplash.com/photo-1547191844-1afe2fb4aff7?auto=format&fit=crop&q=80&w=400',
        voiceoverPrompt: 'Epic historical style. Whisper with intensity. Setup Pharaoh\'s cruel decree and the basket on the Nile.',
        musicTrack: 'Ancient Egyptian Flutes & Choirs',
        duration: 12,
        transition: 'Fade to Black'
      },
      {
        id: 'scene_moi_2',
        text: 'Una majestuosa pirámide dominando el horizonte bajo un sol abrasador, con soldados egipcios desfilando.',
        imageUrl: 'https://images.unsplash.com/photo-1539650116574-8efeb43e2750?auto=format&fit=crop&q=80&w=400',
        voiceoverPrompt: 'Powerful. Describe Moses growing up in Pharaoh\'s palace, surrounded by unmatched opulence.',
        musicTrack: 'Heavy Brass and War Drums',
        duration: 10,
        transition: 'Crossfade'
      },
      {
        id: 'scene_moi_3',
        text: 'Un arbusto envuelto en espectaculares llamas doradas y azules en medio de un cañón desértico rocoso por la noche.',
        imageUrl: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&q=80&w=400',
        voiceoverPrompt: 'Reverent, mystical. God calling Moses from the burning bush. "Take off your sandals, for you stand on holy ground."',
        musicTrack: 'Ethereal Choirs and Violins',
        duration: 15,
        transition: 'Light Leak'
      }
    ],
    seoTitles: [
      'La Historia Completa de MOISÉS | Desde el Nilo hasta la Tierra Prometida',
      'Moisés y el Éxodo de Egipto: El Mayor Milagro de la Historia',
      '¿Por qué Dios eligió a Moisés? (Explicación Bíblica Profunda)'
    ],
    seoDescription: 'Acompañanos a revivir la épica historia de Moisés, el libertador de Israel. Desde su nacimiento en el Nilo, su crianza como príncipe egipcio, su encuentro con la zarza ardiente en el desierto, las plagas de Egipto, y la milagrosa apertura del Mar Rojo. Una producción cinematográfica para fortalecer tu fe.',
    seoTags: ['Moises', 'Exodo', 'Egipto', 'Mar Rojo', 'zarza ardiente', 'diez mandamientos', 'historias biblicas', 'historia de Moises', 'pelicula cristiana'],
    scheduledAt: '2026-07-02T15:00:00Z',
    thumbnailUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 'david_goliat',
    title: 'David vs Goliat: El poder de la fe',
    series: 'Historias Bíblicas',
    status: 'Ideas',
    progress: 10,
    duration: '10:15',
    outline: ['El gigante filisteo provoca a Israel', 'David llega al campamento', 'Cinco piedras lisas del arroyo', 'La victoria en el nombre de Jehová'],
    script: 'Un gigante de casi tres metros de altura desafía al ejército entero de Israel...',
    scenes: [],
    seoTitles: ['David vs Goliat: La batalla de la fe'],
    seoDescription: 'Análisis detallado de la batalla más famosa de la Biblia.',
    seoTags: ['David', 'Goliat', 'fe', 'Biblia'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 'mateo_cinco',
    title: 'El Sermón del Monte (Mateo 5)',
    series: 'Versículos',
    status: 'Investigación',
    progress: 25,
    duration: '15:00',
    outline: ['Las Bienaventuranzas', 'La sal de la tierra y la luz del mundo', 'Jesús y la ley', 'Amad a vuestros enemigos'],
    script: 'El Sermón del Monte es la mayor enseñanza de ética y reino jamás pronunciada...',
    scenes: [],
    seoTitles: ['Mateo 5 Explicado: Las Bienaventuranzas'],
    seoDescription: 'Un estudio versículo por versículo de Mateo 5.',
    seoTags: ['Mateo 5', 'Sermon del monte', 'Bienaventuranzas', 'Jesus'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 'oracion_madrugada',
    title: 'Oración de la mañana: Comienza tu día con Dios',
    series: 'Versículos',
    status: 'Narración IA',
    progress: 60,
    duration: '05:00',
    outline: ['Agradecimiento por el nuevo día', 'Petición de sabiduría y guía', 'Protección para la familia', 'Declaración de bendición'],
    script: 'Señor, en esta hermosa mañana me acerco a ti para darte gracias...',
    scenes: [],
    seoTitles: ['Oración de la Mañana: Empieza tu día con fe'],
    seoDescription: 'Una oración diaria poderosa para guiar tus pasos.',
    seoTags: ['oracion de la mañana', 'oracion diaria', 'Dios hoy'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 'oracion_dormir',
    title: 'Oración de la noche: Duerme en paz bajo sus alas',
    series: 'Versículos',
    status: 'Programado',
    progress: 95,
    duration: '06:00',
    outline: ['Agradecimiento por las bendiciones del día', 'Confesión y perdón', 'Entrega de cargas e inquietudes', 'Declaración de paz y descanso dulce'],
    script: 'Padre celestial, al cerrar mis ojos esta noche, te entrego cada preocupación...',
    scenes: [],
    seoTitles: ['Oración de la Noche para dormir en paz profunda'],
    seoDescription: 'Duerme tranquilo sabiendo que Dios cuida de ti.',
    seoTags: ['oracion de la noche', 'descanso', 'paz', 'dormir bien'],
    scheduledAt: '2026-06-26T21:00:00Z',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511289081367-46c54b574a41?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 'proverbios_sabiduria',
    title: 'Proverbios 3: Consejos para una vida bendecida',
    series: 'Versículos',
    status: 'Publicado',
    progress: 100,
    duration: '09:10',
    outline: ['Confía en Jehová con todo tu corazón', 'No seas sabio en tu propia opinión', 'Honra a Jehová con tus bienes', 'La sabiduría es más preciosa que los rubíes'],
    script: 'Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia...',
    scenes: [],
    seoTitles: ['Proverbios 3 Explicado: El Secreto de la Prosperidad Divina'],
    seoDescription: 'Análisis práctico del capítulo 3 del libro de Proverbios.',
    seoTags: ['Proverbios 3', 'sabiduria', 'confianza en Dios', 'proverbios'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=400'
  }
];

export const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: 'not_1', type: 'success', message: '✓ Voz narrada con éxito para "¿Qué dice la Biblia sobre la ansiedad?"', timestamp: 'Hace 5 min', read: false },
  { id: 'not_2', type: 'info', message: '✓ Video listo para previsualización (Escena 3 renderizada)', timestamp: 'Hace 20 min', read: false },
  { id: 'not_3', type: 'error', message: '✕ Error de conexión API en canal "Canal Finanzas" (Reintentando)', timestamp: 'Hace 1 hora', read: true },
  { id: 'not_4', type: 'success', message: '✓ "Proverbios 3" se ha publicado con éxito en YouTube', timestamp: 'Hace 3 horas', read: true },
  { id: 'not_5', type: 'info', message: '✓ Agente Investigador terminó la recopilación histórica de Moisés', timestamp: 'Hace 5 horas', read: true }
];

export const INITIAL_AGENTS: Agent[] = [
  {
    id: 'director',
    name: 'Director IA',
    role: 'Coordinador del Proyecto',
    status: 'Working',
    currentTask: 'Supervisando renderizado y sincronización de voz',
    avatar: '🎬',
    logs: [
      'Iniciando pipeline de producción para "¿Qué dice la Biblia sobre la ansiedad?"',
      'Asignando tareas de guion a Guionista IA',
      'Asignando tareas de imágenes a Diseñador IA',
      'Validando consistencia de audio y video en línea de tiempo'
    ]
  },
  {
    id: 'investigador',
    name: 'Investigador IA',
    role: 'Recopilador de Fuentes',
    status: 'Idle',
    currentTask: 'Esperando nuevo tema para analizar',
    avatar: '🔎',
    logs: [
      'Búsqueda finalizada sobre: "La historia de Moisés"',
      'Analizados 15 comentarios bíblicos y fuentes históricas',
      'Identificadas referencias clave en Éxodo, Hechos y Hebreos',
      'Extrayendo datos arqueológicos sobre el Egipto de Ramsés II'
    ]
  },
  {
    id: 'guionista',
    name: 'Guionista IA',
    role: 'Escritor de Contenido',
    status: 'Idle',
    currentTask: 'Esperando aprobación de outline',
    avatar: '✍️',
    logs: [
      'Guion completado para "La historia de Moisés"',
      'Estructura optimizada para retención del espectador (primeros 30s de gancho)',
      'Añadidos versículos textuales y pasajes dramáticos',
      'Adaptado tono a "Narrativo Emocional"'
    ]
  },
  {
    id: 'narrador',
    name: 'Narrador IA',
    role: 'Voz del Proyecto',
    status: 'Working',
    currentTask: 'Generando voz de Moisés (Voz: Kore)',
    avatar: '🎙️',
    logs: [
      'Voz de "Ansiedad" terminada correctamente (Formato WAV)',
      'Procesando entonación dramática de Moisés en escena 1',
      'Limpieza de ruidos y ajuste de respiración natural activados',
      'Sincronizando modulación a 24kHz'
    ]
  },
  {
    id: 'editor',
    name: 'Editor de Escenas IA',
    role: 'Montaje Visual',
    status: 'Working',
    currentTask: 'Compilando escenas y aplicando transiciones',
    avatar: '🎬',
    logs: [
      'Escena 1 de Moisés: Sincronizada con el audio',
      'Generando transiciones de tipo Fade para el bloque 2',
      'Añadiendo música de fondo "Ancient Egyptian Flutes"',
      'Ajustando pistas de subtítulos automáticos en español'
    ]
  },
  {
    id: 'seo',
    name: 'Especialista SEO IA',
    role: 'Optimización de Metadatos',
    status: 'Analyzing',
    currentTask: 'Analizando palabras clave competidoras de Moisés',
    avatar: '🚀',
    logs: [
      'Títulos sugeridos para Moisés creados con éxito',
      'Analizando volumen de búsqueda de palabras clave: "Moises Pelicula", "Exodo Egipto"',
      'Descripción optimizada con marcas de tiempo automáticas',
      'Generada lista de 15 tags de alta relevancia'
    ]
  },
  {
    id: 'publisher',
    name: 'Publisher Automatizado',
    role: 'Distribución y Programación',
    status: 'Idle',
    currentTask: 'Esperando confirmación de render final',
    avatar: '📤',
    logs: [
      'Publicación exitosa: "Proverbios 3: Consejos para una vida bendecida" subido a YouTube',
      'Generada publicación promocional para TikTok e Instagram',
      'Monitoreando estado de subida para el video de Ansiedad',
      'Programado Short de "Ansiedad en un minuto" para mañana 12:00'
    ]
  },
  {
    id: 'analista',
    name: 'Analista de Métricas IA',
    role: 'Optimización Post-Publicación',
    status: 'Analyzing',
    currentTask: 'Generando sugerencias de retención y miniaturas',
    avatar: '📊',
    logs: [
      'Alerta: El CTR en "Ansiedad" bajó de 6.2% a 4.1% en las últimas 2 horas',
      'Sugerencia: Cambiar la miniatura por la variante con mayor contraste y texto amarillo',
      'Recomendación: Acortar el gancho introductorio en el próximo video de reflexiones',
      'Informe mensual de crecimiento del Canal Cristiano generado'
    ]
  }
];

export const INITIAL_AUTOMATION_NODES: AutomationNode[] = [
  { id: 'node_trigger', type: 'trigger', label: 'Idea Recibida', description: 'Nueva idea añadida en Trello', status: 'success', config: { origin: 'Manual/Trello' } },
  { id: 'node_script', type: 'action', label: 'Generar Guion', description: 'Guionista IA crea estructura', status: 'success', config: { model: 'gemini-3.1-pro-preview' } },
  { id: 'node_tts', type: 'action', label: 'Narrar Voz IA', description: 'TTS con voz seleccionada', status: 'success', config: { voice: 'Kore (Profunda)' } },
  { id: 'node_scenes', type: 'action', label: 'Generar Imágenes de Escenas', description: 'Imágenes generadas para cada escena', status: 'running', config: { style: 'Cinemático 16:9' } },
  { id: 'node_render', type: 'action', label: 'Compilar y Renderizar', description: 'Une audio, subtítulos y video', status: 'idle', config: { quality: '1080p' } },
  { id: 'node_seo', type: 'action', label: 'Optimizar SEO', description: 'SEO Specialist genera títulos/tags', status: 'idle', config: { platform: 'YouTube/TikTok' } },
  { id: 'node_publish', type: 'action', label: 'Publicar y Analizar', description: 'Distribución multicanal', status: 'idle', config: { channels: 'Todos' } }
];

export const TEAM_MEMBERS: TeamMember[] = [
  { id: 'team_ramiro', name: 'Ramiro (Tú)', role: 'Director de Canal / Creador', avatar: '👨‍💼', status: 'Online', activeProject: '¿Qué dice la Biblia sobre la ansiedad?' },
  { id: 'team_sofia', name: 'Sofía', role: 'Editora Humana / QA', avatar: '👩‍💻', status: 'Online', activeProject: 'La historia de Moisés' },
  { id: 'team_diego', name: 'Diego', role: 'Diseñador de Miniaturas', avatar: '🎨', status: 'Offline' }
];
