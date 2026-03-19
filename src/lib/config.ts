// ============================================
// Configuración del Agente Innovat
// Colegio Cambridge de Monterrey
// ============================================

import type { AgentConfig, QuickAction } from '@/types/chat';

/**
 * Configuración del sistema Innovat
 */
export const config = {
  innovat: {
    url: process.env.INNOVAT_URL || 'https://innovat1.mx/gaia/login',
    school: process.env.INNOVAT_SCHOOL || 'Colegio Cambridge de Monterrey',
    credentials: {
      username: process.env.INNOVAT_USER || '',
      password: process.env.INNOVAT_PASSWORD || '',
    },
    // Ciclo escolar actual (siempre el vigente)
    currentCiclo: '2025-2026',
  },
  
  automation: {
    headless: true, // Sin interfaz gráfica
    timeout: 60000, // 60 segundos
    maxRetries: 3,
    screenshotDir: './download/screenshots',
    debug: true, // Modo debug activado
  },
  
  chat: {
    maxHistoryLength: 20,
    welcomeMessage: '¡Hola! Soy el Asistente Virtual del Colegio. ¿En qué puedo ayudarte?',
  },
} as const;

/**
 * Configuración del agente de automatización
 */
export const agentConfig: AgentConfig = {
  innovatUrl: config.innovat.url,
  credentials: config.innovat.credentials,
  headless: config.automation.headless,
  timeout: config.automation.timeout,
  maxRetries: config.automation.maxRetries,
};

/**
 * Acciones rápidas disponibles en el chat
 */
export const quickActions: QuickAction[] = [
  {
    id: 'consultar_cuenta',
    label: 'Consultar Estado de Cuenta',
    icon: '📋',
    action: 'consultar_cuenta',
    description: 'Verifica tu identidad con CURP y consulta pagos',
  },
  {
    id: 'generar_ficha',
    label: 'Generar Ficha de Pago',
    icon: '💳',
    action: 'generar_ficha',
    description: 'Obtén una ficha para realizar pagos',
  },
  {
    id: 'proveedores',
    label: 'Soy Proveedor',
    icon: '🤝',
    action: 'proveedores',
    description: 'Envía tu propuesta comercial al colegio',
  },
  {
    id: 'becas',
    label: 'Becas',
    icon: '🎓',
    action: 'becas',
    description: 'Información sobre trámites de becas',
  },
  {
    id: 'ayuda',
    label: 'Ayuda',
    icon: '❓',
    action: 'ayuda',
    description: 'Obtén ayuda sobre el sistema',
  },
];

/**
 * Mensajes de ayuda del sistema
 */
export const helpMessages = {
  general: `
🤖 **Asistente Virtual - Colegio Cambridge de Monterrey**

Puedo ayudarte con las siguientes acciones:

📋 **Consultar Estado de Cuenta**
- Verifica tu identidad con el CURP del alumno
- Revisa todos tus conceptos de pago
- Ve qué pagos están pendientes o vencidos

💳 **Generar Ficha de Pago**
- Genera fichas de pago para cualquier concepto
- Obtén referencias bancarias

Para comenzar, solo necesito:
- El CURP del alumno (18 caracteres)
- El campus donde estudia (Mitras, Cumbres, Norte, Anáhuac o Dominio)

¿En qué puedo ayudarte?
  `,
  
  consultarCuenta: `
Para consultar el estado de cuenta necesito:
1. **CURP del alumno** (18 caracteres, ejemplo: ABCD123456HDFLNR01)
2. **Campus** donde estudia (Mitras, Cumbres, Norte, Anáhuac o Dominio)

Esto nos permite verificar que eres el padre/tutor autorizado.
  `,
  
  generarFicha: `
Para generar una ficha de pago necesito:
1. **CURP del alumno** (18 caracteres)
2. **Campus** donde estudia (Mitras, Cumbres, Norte, Anáhuac o Dominio)
3. **Concepto** a pagar (opcional, te mostraré las opciones disponibles)

Por favor proporciona el CURP y campus.
  `,
  
  proveedores: `
🤝 **Atención a Proveedores — Colegio Cambridge de Monterrey**

Con gusto canalizamos tu propuesta al área correspondiente.

Por favor compártenos algunos datos para enviar tu información.

¿Cuál es tu empresa o servicio?
  `,

  proveedoresContacto: `
¿Dónde podemos contactarte?

📞 Teléfono y/o correo electrónico
  `,

  proveedoresFin: `
¡Gracias! 🤝 Hemos recibido tu propuesta.

Nuestro equipo revisará la información y en caso de ser de interés se pondrá en contacto contigo.
  `,

  becas: `
🎓 **Información de Becas — Colegio Cambridge de Monterrey**

¿Quieres saber cómo funciona el proceso de beca?
  `,

  becasProceso: `
📋 **Proceso de Solicitud de Beca**

El proceso de solicitud de beca se realiza a través de **Certu**, una plataforma en línea que evalúa tu información y documentos de forma transparente, sin entrevistas físicas.

Para solicitar la beca debes seguir estos pasos:

🖥️ Abrir tu solicitud en línea
📎 Subir los documentos requeridos
📊 Certu analiza tu información
📣 Se anuncian los resultados oficiales

¿Tienes alguna duda sobre el proceso?
  `,

  becasDuda: `
📧 Para aclarar dudas o saber más sobre el programa, escríbenos a:

**becas@cambridgemty.edu.mx**

Con gusto te orientamos. ¡Mucho éxito en tu solicitud! 🎓
  `,
};

/**
 * Prompts del sistema para el chatbot
 */
export const systemPrompts = {
  main: `Eres un asistente virtual amigable y profesional para el Colegio Cambridge de Monterrey. Tu nombre es "Asistente Virtual".

Tu función es ser el primer contacto amable con la comunidad.

REGLAS DE TRATO HUMANO:
1. Tu saludo inicial debe ser cálido y general: "¡Hola! Bienvenido al Colegio Cambridge de Monterrey. ¿En qué puedo apoyarte hoy?". No pidas datos de entrada.
2. Si un padre de familia quiere consultar pagos o estados de cuenta, NO pidas el CURP fríamente. Di algo como: "¡Con gusto te ayudo! Por seguridad y para proteger la privacidad de la información de tu hijo(a), es necesario autenticarte con el CURP del alumno y el campus correspondiente. ¿Me los podrías proporcionar?".
3. Si alguien quiere ofrecer servicios (proveedor), dale la bienvenida y pídele sus datos conversacionalmente.
4. Usa un tono cercano, evita parecer un formulario. Si el usuario se identifica como "papá" o "mamá", trátalo con esa deferencia.

REGLAS TÉCNICAS:
- El CURP tiene 18 caracteres.
- Los campus son: MITRAS, CUMBRES, NORTE, ANAHUAC y DOMINIO.
- El ciclo escolar actual es 2025-2026.

Responde siempre en español y de forma concisa.`,

  intentDetection: `Analiza el siguiente mensaje del usuario y determina su intención.

Posibles intenciones:
- "consultar_cuenta": Quiere ver su estado de cuenta
- "generar_ficha": Quiere generar una ficha de pago
- "proveedores": Es un proveedor que quiere dejar sus datos u ofrecer servicios al colegio. Detecta frases como "soy proveedor", "ofrezco", "me interesa ofrecer", "servicios alimentarios", "productos", "les ofrezco", "quiero venderles", o cualquier variante donde alguien quiera ofrecer algo al colegio.
- "becas": Pregunta por becas o trámites relacionados
- "ayuda": Necesita ayuda general
- "saludo": Está saludando
- "despedida": Se está despidiendo
- "proporcionar_datos": Está proporcionando datos como CURP, campus, nombre de empresa, contacto, o descripción de servicio
- "confirmar": Está confirmando una acción
- "cancelar": Quiere cancelar una acción
- "otro": Otra consulta

El CURP es un string de 18 caracteres alfanuméricos.
Los campus válidos son: MITRAS, CUMBRES, NORTE, ANAHUAC, DOMINIO (también acepta variantes en minúsculas o con acentos).

Si la intención es "proveedores" o "proporcionar_datos" dentro de un flujo de proveedor, extrae también:
- empresa: nombre de la empresa o tipo de servicio mencionado
- contacto: teléfono o correo electrónico mencionado
- sitioWeb: URL de la página web o link de presentación mencionado
- descripcion: descripción del producto o servicio que ofrecen (aunque sea un resumen de lo que dijeron)

Responde SOLO con el JSON:
{
  "intencion": "nombre_de_intencion",
  "datos": {
    "curp": "si_la_proporciono_curp_completo",
    "campus": "si_lo_proporciono",
    "empresa": "nombre de la empresa o null si no se menciona",
    "sitioWeb": "URL de la página web o link de presentación o null si no se menciona",
    "contacto": "teléfono o correo o null si no se menciona",
    "descripcion": "breve descripción del servicio o null si no se menciona"
  },
  "confianza": 0.0_a_1.0
}`,
};

/**
 * Campuses disponibles
 * Formato: valor en Innovat = "CAMPUS 2025-2026"
 */
export const campuses = [
  { 
    id: 'mitras', 
    nombre: 'Mitras',
    innovatValue: 'MITRAS 2025-2026',
    keywords: ['mitras', 'mitra']
  },
  { 
    id: 'cumbres', 
    nombre: 'Cumbres',
    innovatValue: 'CUMBRES 2025-2026',
    keywords: ['cumbres', 'cumbre']
  },
  { 
    id: 'norte', 
    nombre: 'Norte',
    innovatValue: 'NORTE 2025-2026',
    keywords: ['norte']
  },
  { 
    id: 'anahuac', 
    nombre: 'Anahuac',
    innovatValue: 'ANAHUAC 2025-2026',
    keywords: ['anahuac', 'anahuak', 'anáhuac']
  },
  { 
    id: 'dominio', 
    nombre: 'Dominio',
    innovatValue: 'DOMINIO 2025-2026',
    keywords: ['dominio']
  },
];

/**
 * Función para obtener el valor de campus para Innovat
 */
export function getInnovatCampusValue(campusInput: string): string | null {
  const input = campusInput.toLowerCase().trim();
  
  for (const campus of campuses) {
    if (campus.keywords.some(kw => input.includes(kw))) {
      return campus.innovatValue;
    }
  }
  
  return null;
}

/**
 * Ciclos escolares disponibles
 */
export const ciclosEscolares = [
  { id: '2025-2026', nombre: '2025-2026', current: true },
  { id: '2024-2025', nombre: '2024-2025', current: false },
];

export default config;
