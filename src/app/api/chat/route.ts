// ============================================
// API de Chat para el Asistente Virtual (Gemini)
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { systemPrompts, helpMessages, campuses } from '@/lib/config'
import { db } from '@/lib/db'
import type { Message, ChatAction, ChatRequest, ChatResponse, AutomationParams } from '@/types/chat'

// ─── Session storage persistente entre hot-reloads de Next.js ───────────────
type SessionData = {
  pendingAction?: ChatAction
  collectedData?: {
    curp?: string
    campus?: string
    conceptoId?: string
    empresa?: string
    contacto?: string
    descripcion?: string   // Descripción del servicio/producto del proveedor
    sitioWeb?: string      // Link o página web de la propuesta
  }
  lastIntent?: string
}

const globalForSessions = globalThis as unknown as {
  chatSessions: Map<string, SessionData> | undefined
}

const sessions: Map<string, SessionData> =
  globalForSessions.chatSessions ?? new Map<string, SessionData>()

if (process.env.NODE_ENV !== 'production') {
  globalForSessions.chatSessions = sessions
}

// Initialize Google Generative AI
/**
 * POST /api/chat
 * Procesa mensajes del usuario y genera respuestas usando Google Gemini
 */
export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json()
    const { message, sessionId, history = [] } = body

    // Initialize Google Generative AI inside the handler to ensure fresh API keys
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
    
    if (!apiKey) {
      console.error('[Chat API] Missing GOOGLE_GENERATIVE_AI_API_KEY')
      return NextResponse.json(
        { 
          error: 'Configuration error',
          message: {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: 'Lo siento, el sistema de IA no está configurado (falta GOOGLE_GENERATIVE_AI_API_KEY).',
            timestamp: new Date(),
          }
        },
        { status: 500 }
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: 'Message and sessionId are required' },
        { status: 400 }
      )
    }

    // Get or create session
    let session = sessions.get(sessionId)
    if (!session) {
      session = {}
      sessions.set(sessionId, session)
    }

    // Detect intent first
    let intentResult;
    try {
      intentResult = await detectIntent(genAI, message)
    } catch (error: any) {
      if (error.message?.includes('429') || error.status === 429) {
        return NextResponse.json({
          message: {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: '⚠️ El sistema está un poco saturado por el momento (límite de peticiones). Por favor, intenta de nuevo en unos segundos.',
            timestamp: new Date(),
          }
        })
      }
      throw error;
    }
    
    // Process the intent and generate response
    const response = await processIntent(genAI, message, intentResult, session, history)

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Chat API] Error:', error)
    return NextResponse.json(
      { 
        error: 'Error processing message',
        message: {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Lo siento, ocurrió un error al procesar tu mensaje. Por favor intenta de nuevo.',
          timestamp: new Date(),
        }
      },
      { status: 500 }
    )
  }
}
/**
 * Detect user intent from message using Gemini (with fallback)
 */
async function detectIntent(
  genAI: any,
  message: string
): Promise<{
  intent: string
  data: { 
    curp?: string; 
    campus?: string; 
    empresa?: string;
    contacto?: string;
    sitioWeb?: string;
    descripcion?: string;
  }
  confidence: number
}> {
  // Try models that were found in the diagnostic list
  const modelNames = ['gemini-flash-latest', 'gemini-pro-latest', 'gemini-2.0-flash']
  let lastError: any = null

  // Pre-check for CURP in message (manual extraction as backup)
  const curpRegex = /[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d/i
  const curpMatch = message.match(curpRegex)
  const extractedCurp = curpMatch ? curpMatch[0].toUpperCase() : undefined

  // Pre-check for keywords
  const lowerMsg = message.toLowerCase()
  const isConsultarCuenta = lowerMsg.includes('estado de cuenta') || 
                            lowerMsg.includes('cuanto debo') || 
                            lowerMsg.includes('deuda');
  const isGenerarFicha = lowerMsg.includes('ficha') || lowerMsg.includes('pagar');
  const hasAccountKeywords = isConsultarCuenta || isGenerarFicha || lowerMsg.includes('pago');

  // Manual campus extraction
  const campusKeywords: Record<string, string[]> = {
    'mitras': ['mitras', 'mitra'],
    'norte': ['norte'],
    'cumbres': ['cumbres', 'cumbre'],
    'anahuac': ['anahuac', 'anáhuac', 'anahuak'],
    'dominio': ['dominio']
  }
  let extractedCampus: string | undefined = undefined
  for (const [val, keys] of Object.entries(campusKeywords)) {
    if (keys.some(k => lowerMsg.includes(k))) {
      extractedCampus = val.toUpperCase()
      break
    }
  }

  const isSupplier = 
    lowerMsg.includes('proveedor') || 
    lowerMsg.includes('ofrecer') || 
    lowerMsg.includes('ofrezco') || 
    lowerMsg.includes('compras') || 
    lowerMsg.includes('vender') ||
    lowerMsg.includes('vendo') ||
    lowerMsg.includes('distribuyo') ||
    lowerMsg.includes('les ofrezco') ||
    lowerMsg.includes('me interesa ofrecer') ||
    lowerMsg.includes('servicio de') ||
    lowerMsg.includes('ofrecerles') ||
    lowerMsg.includes('propuesta') ||
    lowerMsg.includes('limpieza') ||
    lowerMsg.includes('jardinería') ||
    lowerMsg.includes('mantenimiento') ||
    lowerMsg.includes('seguridad') ||
    lowerMsg.includes('insumos') ||
    lowerMsg.includes('comercial') ||
    lowerMsg.includes('catálogo');

  // Manual extractions for supplier data (as backup)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]+)/i
  const urlMatch = message.match(urlRegex)
  const extractedUrl = urlMatch ? urlMatch[0] : undefined

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i
  const emailMatch = message.match(emailRegex)
  const extractedEmail = emailMatch ? emailMatch[0] : undefined

  const phoneRegex = /(\d{10}|\d{3}[-\s]\d{3}[-\s]\d{4})/
  const phoneMatch = message.match(phoneRegex)
  const extractedPhone = phoneMatch ? phoneMatch[0] : undefined

  // Intento de extraer nombre de empresa del mensaje (respaldo si la IA falla)
  const empresaRegex = /(?:empresa\s+(?:llamada?\s+)?|compan[yi]a\s+(?:llamada?\s+)?|soy\s+(?:de\s+)?|represento\s+(?:a\s+)?(?:la\s+)?(?:empresa\s+)?)["']?([\w\s._-]{2,40}?)(?:["']|\s+y\s|,|\.|$)/i
  const empresaMatch = message.match(empresaRegex)
  const extractedEmpresa = empresaMatch ? empresaMatch[1].trim() : undefined

  const isBecas = lowerMsg.includes('beca') || lowerMsg.includes('apoyo');

  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
      })
      
      const prompt = `${systemPrompts.intentDetection}
      
MENSAJE DEL USUARIO: "${message}"

RECUERDA: Si el usuario menciona "estado de cuenta", "cuanto debo", "ficha de pago" o similar, la intención debe ser "consultar_cuenta" o "generar_ficha".
Si detectas un CURP (18 caracteres), inclúyelo en el campo "datos.curp".`
      
      const result = await model.generateContent(prompt)
      const responseText = result.response.text() || '{}'
      
      console.log(`[Chat API] Raw intent response (${modelName}):`, responseText);

      const parsed = JSON.parse(responseText)
      let intent = parsed.intencion || 'otro'
      const data = parsed.datos || {}

      // FORZAR INTENCIÓN: Si hay un CURP o palabras clave
      if (extractedCurp) {
        intent = 'consultar_cuenta'
        data.curp = extractedCurp
        console.log(`[Chat API] ⚠️ Forzando intención a 'consultar_cuenta' por detección de CURP.`);
      } else if (isGenerarFicha && (intent === 'otro' || intent === 'consultar_cuenta')) {
        // Preferir generar_ficha si se menciona explícitamente "ficha"
        intent = 'generar_ficha'
        console.log(`[Chat API] ⚠️ Forzando intención a 'generar_ficha' por palabras clave.`);
      } else if (isConsultarCuenta && intent === 'otro') {
        intent = 'consultar_cuenta'
        console.log(`[Chat API] ⚠️ Forzando intención a 'consultar_cuenta' por palabras clave.`);
      } else if (isSupplier && (intent === 'otro' || intent === 'saludo')) {
        intent = 'proveedores'
        if (!data.descripcion && lowerMsg.length > 20) {
          data.descripcion = message
        }
      } else if (isBecas && intent === 'otro') {
        intent = 'becas'
      }

      // Asegurar el campus si se detectó manualmente
      if (extractedCampus) {
        data.campus = extractedCampus
      }

      // Proactivamente agregar datos extraídos manualmente si faltan en el JSON de la IA
      if (extractedUrl && !data.sitioWeb)     data.sitioWeb = extractedUrl
      if (extractedEmail && !data.contacto)   data.contacto = extractedEmail
      if (extractedPhone && (!data.contacto || data.contacto === extractedEmail)) {
        data.contacto = data.contacto ? `${data.contacto} / ${extractedPhone}` : extractedPhone
      }
      if (extractedEmpresa && !data.empresa)  data.empresa = extractedEmpresa
      if ((intent === 'proveedores' || isSupplier) && !data.descripcion && message.length > 15) {
        data.descripcion = message
      }

      return {
        intent: intent,
        data: data,
        confidence: 1.0,
      }
    } catch (error: any) {
      lastError = error
      if (error.status === 404) continue
      break 
    }
  }

  console.warn('[Chat API] ⚠️ Intent detection hit quota or failed. Using manual detection fallback.');
  
  // Final Fallback: Manual detection if AI is blocked by 429 or fails
  let finalIntent = isGenerarFicha ? 'generar_ficha' : 
                   (extractedCurp || isConsultarCuenta || extractedCampus) ? 'consultar_cuenta' : 'otro';
  if (isSupplier) finalIntent = 'proveedores';
  if (isBecas) finalIntent = 'becas';

  return { 
    intent: finalIntent, 
    data: { 
      curp: extractedCurp,
      campus: extractedCampus,
      sitioWeb: extractedUrl,
      contacto: extractedEmail || extractedPhone,
      empresa: extractedEmpresa,
      descripcion: isSupplier && message.length > 15 ? message : undefined,
    }, 
    confidence: 0.5 
  }
}

/**
 * Valida el formato de un CURP mexicano
 */
function isValidCURP(curp: string): boolean {
  const curpRegex = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z]{2}$/i
  return curpRegex.test(curp)
}

function formatCURP(curp: string): string {
  return curp.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * Limpia y extrae el nombre del concepto de un mensaje
 */
function extractConcepto(message: string): string | undefined {
  const match = message.match(/(?:ficha para|ficha de|pagar|pago de)\s+(.*)/i);
  if (match) return match[1].trim();
  
  // Si directamente menciona el concepto
  const lower = message.toLowerCase();
  if (lower.includes('colegiatura') || lower.includes('extrac') || lower.includes('ajedrez') || 
      lower.includes('pintura') || lower.includes('musica') || lower.includes('música') || 
      lower.includes('deportes') || lower.includes('danza')) {
    return message.trim();
  }
  
  return undefined;
}

/**
 * Process detected intent and generate appropriate response
 */
async function processIntent(
  genAI: any,
  message: string,
  intentResult: { intent: string; data: { curp?: string; campus?: string; empresa?: string; contacto?: string; descripcion?: string }; confidence: number },
  session: { 
    pendingAction?: ChatAction; 
    collectedData?: { 
      curp?: string; 
      campus?: string; 
      conceptoId?: string;
      empresa?: string;
      contacto?: string;
      descripcion?: string;
      archivoUrl?: string;
    } 
  },
  history: Message[]
): Promise<ChatResponse> {
  const { intent, data } = intentResult
  const messageId = `msg-${Date.now()}`

  // Extraer concepto si la intención es generar ficha
  const conceptoExtraido = extractConcepto(message)
  if (conceptoExtraido && (intent === 'generar_ficha' || intent === 'proporcionar_datos')) {
    if (!session.collectedData) session.collectedData = {}
    session.collectedData.conceptoId = conceptoExtraido
  }

  // Initialize collected data if needed
  if (!session.collectedData) {
    session.collectedData = {}
  }

  // Extract data from model response if present
  if (data.curp) {
    const formattedCurp = formatCURP(data.curp)
    if (isValidCURP(formattedCurp)) {
      session.collectedData.curp = formattedCurp
    }
  }
  if (data.campus) {
    session.collectedData.campus = data.campus
  }
  // Extract supplier data if AI detected it (Allow overwriting to fix errors if user provides better info)
  if ((data as any).empresa) {
    (session.collectedData as any).empresa = (data as any).empresa
  }
  if ((data as any).contacto) {
    (session.collectedData as any).contacto = (data as any).contacto
  }
  if ((data as any).descripcion) {
    (session.collectedData as any).descripcion = (data as any).descripcion
  }
  if ((data as any).sitioWeb) {
    (session.collectedData as any).sitioWeb = (data as any).sitioWeb
  }

  // Also try to extract CURP pattern (18 alphanumeric characters) manually as backup
  const curpMatch = message.match(/\b([A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z]{2})\b/i)
  if (curpMatch) {
    const formattedCurp = formatCURP(curpMatch[1])
    if (isValidCURP(formattedCurp)) {
      session.collectedData.curp = formattedCurp
    }
  }

  // Check for campus mentions manually (Aggressive backup)
  const campusLower = message.toLowerCase()
  const allCampuses = [
    { id: 'mitras', nombre: 'MITRAS' },
    { id: 'cumbres', nombre: 'CUMBRES' },
    { id: 'norte', nombre: 'NORTE' },
    { id: 'anahuac', nombre: 'ANAHUAC', variants: ['anahuac', 'anáhuac'] },
    { id: 'dominio', nombre: 'DOMINIO', variants: ['dominio'] }
  ]
  
  for (const c of allCampuses) {
    const variants = (c as any).variants || [c.id];
    if (variants.some((v: string) => campusLower.includes(v)) || campusLower.includes(c.nombre.toLowerCase())) {
      session.collectedData.campus = c.nombre
      console.log(`[Chat API] 📍 Campus forzado en sesión: ${c.nombre}`)
      break
    }
  }

  // Si hay un flujo de becas activo, ignorar a Gemini y continuar el flujo
  if (session.lastIntent === 'becas_inicio' || session.lastIntent === 'becas_proceso') {
    return await processBecasFlow(message, session, messageId)
  }

  if (session.lastIntent === 'proveedores_empresa' || session.lastIntent === 'proveedores_contacto') {
    return await proveedoresFlow(message, session, messageId)
  }

  // Handle different intents
  switch (intent) {
    case 'consultar_cuenta':
      session.pendingAction = 'consultar_cuenta'
      return await handleActionRequest('consultar_cuenta', session, genAI, history, messageId)

    case 'generar_ficha':
      session.pendingAction = 'generar_ficha'
      return await handleActionRequest('generar_ficha', session, genAI, history, messageId)

    case 'proveedores':
    case 'proporcionar_datos': {
      // Iniciar flujo fijo de proveedores sin IA
      session.lastIntent = 'proveedores_empresa'
      session.collectedData = session.collectedData || {}
      const { helpMessages: hm } = await import('@/lib/config')
      return {
        message: {
          id: messageId,
          role: 'assistant',
          content: hm.proveedores,
          timestamp: new Date(),
          metadata: { proveedoresStep: 'empresa' }
        },
      }
    }

    case 'becas': {
      // Flujo fijo de becas según diagrama — sin IA, solo botones
      const lowerMsg = message.toLowerCase()

      // Paso 3b: Usuario tiene duda → mandar correo
      if (
        session.lastIntent === 'becas_proceso' &&
        (lowerMsg === 'si' || lowerMsg === 'sí' || lowerMsg.includes('duda') || lowerMsg.includes('saber más') || lowerMsg.includes('saber mas'))
      ) {
        session.lastIntent = 'becas_fin'
        return {
          message: {
            id: messageId,
            role: 'assistant',
            content: helpMessages.becasDuda,
            timestamp: new Date(),
            metadata: { becasStep: 'fin' }
          },
        }
      }

      // Paso 3a: Usuario NO tiene duda → FIN
      if (
        session.lastIntent === 'becas_proceso' &&
        (lowerMsg === 'no' || lowerMsg.includes('no por ahora') || lowerMsg.includes('gracias'))
      ) {
        session.lastIntent = undefined
        return {
          message: {
            id: messageId,
            role: 'assistant',
            content: '¡Con gusto! Si en otro momento necesitas información sobre becas, aquí estaré. 😊 ¿En qué más puedo ayudarte?',
            timestamp: new Date(),
            metadata: { becasStep: 'fin' }
          },
        }
      }

      // Paso 2: Usuario quiere saber el proceso → explicar Certu
      if (
        lowerMsg === 'si' || lowerMsg === 'sí' ||
        lowerMsg.includes('cuéntame') || lowerMsg.includes('cuentame') ||
        lowerMsg.includes('sí, cuéntame') || lowerMsg.includes('proceso') ||
        session.lastIntent === 'becas_inicio'
      ) {
        session.lastIntent = 'becas_proceso'
        return {
          message: {
            id: messageId,
            role: 'assistant',
            content: helpMessages.becasProceso,
            timestamp: new Date(),
            metadata: { becasStep: 'proceso' }
          },
        }
      }

      // Paso 1: Inicio del flujo — preguntar si quiere saber el proceso
      session.lastIntent = 'becas_inicio'
      return {
        message: {
          id: messageId,
          role: 'assistant',
          content: helpMessages.becas,
          timestamp: new Date(),
          metadata: { becasStep: 'inicio' }
        },
      }
    }

    case 'ayuda':
      return {
        message: {
          id: messageId,
          role: 'assistant',
          content: helpMessages.general,
          timestamp: new Date(),
        },
      }

    case 'saludo':
      return {
        message: {
          id: messageId,
          role: 'assistant',
          content: '¡Hola! 👋 Bienvenido al Asistente Virtual del Colegio Cambridge de Monterrey.\n\nEstoy aquí para ayudarte con:\n\n📋 **Consultas de estado de cuenta**\n💳 **Generación de fichas de pago**\n🤝 **Atención a proveedores**\n❓ **Dudas sobre becas o información general**\n\n¿En qué puedo apoyarte hoy?',
          timestamp: new Date(),
        },
      }

    case 'despedida':
      return {
        message: {
          id: messageId,
          role: 'assistant',
          content: '¡Hasta pronto! 👋 Si necesitas algo más, estaré aquí para ayudarte. ¡Que tengas un excelente día!',
          timestamp: new Date(),
        },
      }

    case 'proporcionar_datos':
    case 'confirmar':
      if (session.pendingAction === 'proveedores') {
        return await handleActionRequest('proveedores', session, genAI, history, messageId)
      }
      if (session.pendingAction) {
        return checkAndExecuteAction(session, messageId)
      }
      break

    case 'cancelar':
      session.pendingAction = undefined
      session.collectedData = {}
      return {
        message: {
          id: messageId,
          role: 'assistant',
          content: 'De acuerdo, he cancelado la operación. ¿Hay algo más en lo que pueda ayudarte?',
          timestamp: new Date(),
        },
      }

    case 'otro':
      // Si estamos en el flujo de proveedores, la IA acumula datos
      if (session.pendingAction === 'proveedores') {
        return await handleActionRequest('proveedores', session, genAI, history, messageId)
      }

      // Si tenemos una acción pendiente y el mensaje es muy corto (podría ser un campus o dato omitido por la IA)
      if (session.pendingAction && message.split(' ').length < 4) {
        // Si el mensaje contiene un campus o parece un CURP, intentamos ejecutar
        const lowerMsg = message.toLowerCase();
        const seemsLikeData = isValidCURP(formatCURP(message)) || 
                             ['mitras', 'cumbres', 'norte', 'anahuac', 'anáhuac', 'dominio'].some(c => lowerMsg.includes(c));
        
        if (seemsLikeData) {
          return checkAndExecuteAction(session, messageId)
        }
      }
      
      // Si el usuario cambia notablemente de tema (mensaje largo que no es saludo ni datos)
      if (message.length > 30 && intent === 'otro') {
        console.log(`[Chat API] 🧹 Limpiando sesión por cambio de tema detectado.`);
        session.pendingAction = undefined
        session.collectedData = {}
      }
      break
  }

  // Check if we have pending action with ALL data collected after processing the message
  if (session.pendingAction && session.collectedData.curp && session.collectedData.campus) {
    // Solo auto-ejecutamos si la intención era proporcionar datos o relacionada
    if (intent === 'consultar_cuenta' || intent === 'generar_ficha' || intent === 'proporcionar_datos' || intent === 'confirmar') {
      return checkAndExecuteAction(session, messageId)
    }
  }

  // Default: use Gemini to generate response
  return generateAIResponse(genAI, message, history, messageId)
}

/**
 * Handle action request — async para poder usar Gemini en el flujo de proveedores
 */
async function handleActionRequest(
  action: ChatAction,
  session: { 
    pendingAction?: ChatAction; 
    collectedData?: { 
      curp?: string; 
      campus?: string; 
      conceptoId?: string;
      empresa?: string;
      contacto?: string;
      descripcion?: string;
      sitioWeb?: string;
    } 
  },
  genAI?: any,
  history?: Message[],
  messageId?: string
): Promise<ChatResponse> {
  const msgId = messageId || `msg-${Date.now()}`
  const collected = (session.collectedData || {}) as {
    curp?: string; campus?: string; conceptoId?: string;
    empresa?: string; contacto?: string; descripcion?: string; sitioWeb?: string;
  }

  // ─── Flujo de pagos / cuenta (sin cambios, sigue siendo el robot) ─────────
  if (action === 'consultar_cuenta' || action === 'generar_ficha') {
    const needs: string[] = []
    if (!collected.curp) needs.push('CURP del alumno')
    if (!collected.campus) needs.push('campus')

    if (needs.length > 0) {
      const actionName = action === 'consultar_cuenta' ? 'consultar el estado de cuenta' : 'generar la ficha de pago'
      return {
        message: {
          id: msgId,
          role: 'assistant',
          content: `Para ${actionName}, necesito verificar tu identidad:\n\n${needs.map(n => `📌 **${n.charAt(0).toUpperCase() + n.slice(1)}**`).join('\n')}\n\n${collected.curp ? `✅ CURP: ${collected.curp}` : ''}\n${collected.campus ? `✅ Campus: ${collected.campus}` : ''}\n\n🔒 El CURP nos permite verificar que eres el padre/tutor autorizado del alumno.\n\nPor favor proporciona${needs.length === 1 ? ' el dato faltante' : ' los datos'} para continuar.`,
          timestamp: new Date(),
        },
      }
    }

    return {
      message: {
        id: msgId,
        role: 'assistant',
        content: `Perfecto, voy a verificar tu identidad y procesar tu solicitud:\n\n🆔 **CURP:** ${collected.curp}\n🏫 **Campus:** ${collected.campus}\n\n⏳ Verificando en el sistema...`,
        timestamp: new Date(),
      },
      requiresAction: true,
      actionData: {
        action,
        curp: collected.curp,
        campus: collected.campus,
        matricula: collected.curp,
        conceptoId: collected.conceptoId,
      },
    }
  }

  if (action === 'proveedores') {
    const tieneEmpresa     = !!collected.empresa && collected.empresa.length > 2
    const tieneDescripcion = !!collected.descripcion && collected.descripcion.length > 5
    const tieneSitioWeb    = !!collected.sitioWeb && (collected.sitioWeb.includes('http') || collected.sitioWeb.includes('www.') || collected.sitioWeb.includes('.com'))
    // Contacto: admitir números telefónicos o correos
    const tieneContacto    = !!collected.contacto && (collected.contacto.includes('@') || /[0-9]{8,}/.test(collected.contacto.replace(/\s/g, '')))

    console.log(`[Chat API] 🔍 Status Proveedor: Empresa:${tieneEmpresa}, Desc:${tieneDescripcion}, Web:${tieneSitioWeb}, Contacto:${tieneContacto}`)

    // Si tenemos todo, generar confirmación personalizada con IA
    if (tieneEmpresa && tieneDescripcion && tieneSitioWeb && tieneContacto) {
      console.log(`[Chat API] ✅ Propuesta completa: ${collected.empresa} | ${collected.sitioWeb}`)

      // 💾 Guardar la propuesta en la base de datos para revisión posterior
      try {
        await db.propuestaProveedor.create({
          data: {
            empresa:     collected.empresa!,
            descripcion: collected.descripcion!,
            sitioWeb:    collected.sitioWeb!,
            contacto:    collected.contacto!,
            sessionId:   session.pendingAction ? undefined : undefined, // se puede pasar si se tiene
          }
        })
        console.log('[Chat API] 💾 Propuesta guardada exitosamente en BD.')
      } catch (dbError) {
        console.error('[Chat API] ❌ Error al guardar propuesta en BD:', dbError)
        // No interrumpimos el flujo si la BD falla, respondemos igual
      }

      session.pendingAction = undefined
      session.collectedData = {}

      // Intentar generar confirmación personalizada con IA
      if (genAI) {
        try {
          const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' })
          const prompt = `Eres el asistente virtual del Colegio Cambridge de Monterrey. Un proveedor acaba de registrar su propuesta:
- Empresa/Servicio: ${collected.empresa}
- Descripción: ${collected.descripcion}
- Sitio/Link: ${collected.sitioWeb}
- Contacto: ${collected.contacto}

Genera un mensaje de confirmación profesional y personalizado (máximo 4 líneas) agradeciendo la información y confirmando que será revisada por el área de compras.`
          const result = await model.generateContent(prompt)
          const aiConfirmation = result.response.text()?.trim()
          if (aiConfirmation && aiConfirmation.length > 10) {
            return {
              message: {
                id: msgId,
                role: 'assistant',
                content: aiConfirmation,
                timestamp: new Date(),
              },
            }
          }
        } catch (e) {
          console.warn('[Chat API] No se pudo generar confirmación personalizada con IA')
        }
      }

      // Fallback
      return {
        message: {
          id: msgId,
          role: 'assistant',
          content: `¡Información recibida! 🙌 Muchas gracias por tu propuesta para **${collected.empresa}**. Nuestro equipo de compras revisará el sitio web proporcionado (${collected.sitioWeb}) y se pondrán en contacto contigo si hay interés. ¡Excelente día!`,
          timestamp: new Date(),
        },
      }
    }

    // Construir el contexto de la conversación para que la IA decida qué preguntar
    const contexto: string[] = []
    if (tieneEmpresa)     contexto.push(`- Empresa/Servicio: ${collected.empresa}`)
    if (tieneDescripcion) contexto.push(`- Descripción del servicio: ${collected.descripcion}`)
    if (tieneSitioWeb)    contexto.push(`- Sitio Web/Link: ${collected.sitioWeb}`)
    if (tieneContacto)    contexto.push(`- Contacto: ${collected.contacto}`)

    const faltante: string[] = []
    if (!tieneEmpresa)     faltante.push('nombre de la empresa o tipo de servicio que ofrece')
    if (!tieneDescripcion) faltante.push('una breve descripción del producto o servicio')
    if (!tieneSitioWeb)    faltante.push('un link, página web o enlace a su propuesta digital (por seguridad no aceptamos archivos directamente)')
    if (!tieneContacto)    faltante.push('datos de contacto (teléfono y/o correo)')

    // Intentar usar IA para la pregunta conversacional
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' })
        const prompt = `Eres el asistente virtual del Colegio Cambridge de Monterrey, atendiendo a un proveedor potencial.

Datos que ya tenemos del proveedor:
${contexto.length > 0 ? contexto.join('\n') : '(ninguno aún — es el primer contacto)'}

Información que aún nos falta obtener (POR ESTE ORDEN):
${faltante.map(f => `- ${f}`).join('\n')}

IMPORTANTE: 
1. Si YA diste la bienvenida en el historial de chat, NO la vuelvas a dar. Sé directo.
2. Por seguridad del colegio, NO pedimos archivos adjuntos. Pedimos un LINK, URL o Página Web donde podamos ver su propuesta.
3. Genera UNA sola pregunta o comentario amable para obtener lo que sigue en la lista.

Responde solo la pregunta, sin comillas.`

        const result = await model.generateContent(prompt)
        const aiQuestion = result.response.text()?.trim()
        if (aiQuestion && aiQuestion.length > 10) {
          return {
            message: {
              id: msgId,
              role: 'assistant',
              content: aiQuestion,
              timestamp: new Date(),
            },
          }
        }
      } catch (e) {
        console.warn('[Chat API] No se pudo generar pregunta de proveedor con IA, usando fallback.')
      }
    }
    
    // Fallback escalonado si la IA no está disponible
    if (!tieneEmpresa) {
      return {
        message: {
          id: msgId,
          role: 'assistant',
          content: '¡Con mucho gusto! 🤝 Para canalizar tu propuesta con el área de compras del colegio, cuéntame: ¿cuál es el nombre de tu empresa o qué tipo de servicio/producto representas?',
          timestamp: new Date(),
        },
      }
    }
    if (!tieneDescripcion) {
      return {
        message: {
          id: msgId,
          role: 'assistant',
          content: `Perfecto, gracias por compartirlo. ¿Podrías darme una breve descripción de lo que ofreces al colegio? Una breve explicación es suficiente.`,
          timestamp: new Date(),
        },
      }
    }
    if (!tieneSitioWeb) {
      return {
        message: {
          id: msgId,
          role: 'assistant',
          content: `¡Entendido! Por seguridad del colegio, no aceptamos archivos directamente. ¿Podrías compartirme un link, página web o enlace a tu propuesta digital?`,
          timestamp: new Date(),
        },
      }
    }
    
    // Solo falta contacto
    return {
      message: {
        id: msgId,
        role: 'assistant',
        content: `Excelente información. Por último, ¿cómo podemos contactarte? Compártenos tu teléfono y/o correo electrónico para que el equipo de compras pueda comunicarse contigo si hay interés.`,
        timestamp: new Date(),
      },
    }
  }

  return {
    message: {
      id: msgId,
      role: 'assistant',
      content: '¿En qué más puedo ayudarte?',
      timestamp: new Date(),
    },
  }
}

/**
 * Check action readiness
 */
function checkAndExecuteAction(
  session: { 
    pendingAction?: ChatAction; 
    collectedData?: { 
      curp?: string; 
      campus?: string; 
      conceptoId?: string;
      empresa?: string;
      contacto?: string;
    } 
  },
  messageId: string
): ChatResponse {
  const action = session.pendingAction
  const collected = session.collectedData || {}

  if (!action) {
    return {
      message: {
        id: messageId,
        role: 'assistant',
        content: 'No tengo una acción pendiente. ¿En qué puedo ayudarte?',
        timestamp: new Date(),
      },
    }
  }

  if (collected.curp && !isValidCURP(collected.curp)) {
    return {
      message: {
        id: messageId,
        role: 'assistant',
        content: `⚠️ El CURP proporcionado no tiene el formato correcto.\n\nEl CURP debe tener 18 caracteres con el formato: AAAA000000XXXXXX00\n\nPor favor verifica e ingresa el CURP correcto del alumno.`,
        timestamp: new Date(),
      },
    }
  }

  if (collected.curp && collected.campus) {
    const actionData: AutomationParams = {
      action,
      curp: collected.curp,
      campus: collected.campus,
      conceptoId: collected.conceptoId,
    }
    
    session.pendingAction = undefined
    // Limpiamos pero mantenemos datos de identificación por si quiere otra ficha inmediata
    const tempConcepto = collected.conceptoId;
    session.collectedData = { curp: collected.curp, campus: collected.campus }

    return {
      message: {
        id: messageId,
        role: 'assistant',
        content: `Perfecto, tengo todos los datos necesarios:\n\n🆔 **CURP:** ${collected.curp}\n🏫 **Campus:** ${collected.campus}\n\n⏳ Verificando identidad y procesando tu solicitud...`,
        timestamp: new Date(),
      },
      requiresAction: true,
      actionData,
    }
  }

  const needs: string[] = []
  if (!collected.curp) needs.push('CURP del alumno (18 caracteres)')
  if (!collected.campus) needs.push('campus')

  return {
    message: {
      id: messageId,
      role: 'assistant',
      content: `Aún necesito: ${needs.join(' y ')}.\n\nPor favor proporciona${needs.length === 1 ? ' este dato' : ' estos datos'} para continuar.`,
      timestamp: new Date(),
    },
  }
}

/**
 * Generate Gemini response for general queries (with fallback)
 */
async function generateAIResponse(
  genAI: any,
  message: string,
  history: Message[],
  messageId: string
): Promise<ChatResponse> {
  const modelNames = ['gemini-flash-latest', 'gemini-pro-latest', 'gemini-1.5-flash']
  let lastError: any = null

  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      
      // Gemini requires the first message in history to be from the 'user'
      const formattedHistory = history.slice(-6).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }))

      // Filter out leading model messages if any
      let firstUserIndex = formattedHistory.findIndex(m => m.role === 'user')
      const finalHistory = firstUserIndex !== -1 ? formattedHistory.slice(firstUserIndex) : []

      const chat = model.startChat({
        history: finalHistory,
        generationConfig: { maxOutputTokens: 500 },
      })

      const result = await chat.sendMessage([
        { text: systemPrompts.main },
        { text: message }
      ])

      const responseContent = result.response.text() || '...'
      return {
        message: {
          id: messageId,
          role: 'assistant',
          content: responseContent,
          timestamp: new Date(),
        },
      }
    } catch (error: any) {
      lastError = error
      if (error.status === 404) continue
      break
    }
  }

  console.error('[Chat API] Gemini response error:', lastError?.message);
  
  // Friendly error message for 429
  let friendlyMsg = `Lo siento, el sistema de IA está recibiendo muchas consultas en este momento. Por favor, intenta de nuevo en un minuto.`;
  if (lastError?.message?.includes('429') || lastError?.status === 429) {
    friendlyMsg = `⚠️ **Límite de mensajes alcanzado (429)**\n\nEl sistema gratuito de Google está un poco saturado. Por favor, espera un minuto para que se libere la cuota e intenta de nuevo. Estamos trabajando para mejorar esto.`;
  }

  return {
    message: {
      id: messageId,
      role: 'assistant',
      content: friendlyMsg,
      timestamp: new Date(),
    },
  }
}

/**
 * Flujo fijo de becas — sin IA, basado en el diagrama
 */
async function processBecasFlow(
  message: string,
  session: any,
  messageId: string
): Promise<ChatResponse> {
  const { helpMessages } = await import('@/lib/config')
  const lowerMsg = message.toLowerCase().trim()

  // Paso 2: Viene de inicio y dice sí → explicar proceso
  if (session.lastIntent === 'becas_inicio') {
    if (lowerMsg === 'si' || lowerMsg === 'sí' || lowerMsg.includes('cuéntame') || lowerMsg.includes('cuentame') || lowerMsg.includes('proceso')) {
      session.lastIntent = 'becas_proceso'
      return {
        message: {
          id: messageId,
          role: 'assistant',
          content: helpMessages.becasProceso,
          timestamp: new Date(),
          metadata: { becasStep: 'proceso' }
        },
      }
    }
    // Dijo no → FIN
    session.lastIntent = undefined
    return {
      message: {
        id: messageId,
        role: 'assistant',
        content: '¡Sin problema! Si en otro momento necesitas información sobre becas, aquí estaré. 😊 ¿En qué más puedo ayudarte?',
        timestamp: new Date(),
        metadata: { becasStep: 'fin' }
      },
    }
  }

  // Paso 3: Viene del proceso y dice sí (tiene duda) → mandar correo
  if (session.lastIntent === 'becas_proceso') {
    if (lowerMsg === 'si' || lowerMsg === 'sí' || lowerMsg.includes('duda') || lowerMsg.includes('saber más') || lowerMsg.includes('saber mas')) {
      session.lastIntent = undefined
      return {
        message: {
          id: messageId,
          role: 'assistant',
          content: helpMessages.becasDuda,
          timestamp: new Date(),
          metadata: { becasStep: 'fin' }
        },
      }
    }
    // Dijo no → FIN
    session.lastIntent = undefined
    return {
      message: {
        id: messageId,
        role: 'assistant',
        content: '¡Con gusto! Si en otro momento necesitas información sobre becas, aquí estaré. 😊 ¿En qué más puedo ayudarte?',
        timestamp: new Date(),
        metadata: { becasStep: 'fin' }
      },
    }
  }

  // Fallback
  session.lastIntent = undefined
  return {
    message: {
      id: messageId,
      role: 'assistant',
      content: '¿En qué más puedo ayudarte?',
      timestamp: new Date(),
    },
  }
}
/**
 * Flujo fijo de proveedores — sin IA, basado en el diagrama
 */
async function proveedoresFlow(
  message: string,
  session: any,
  messageId: string
): Promise<ChatResponse> {
  const { helpMessages } = await import('@/lib/config')
  const texto = message.trim()

  // Paso 2: Tenemos empresa, pedimos contacto
  if (session.lastIntent === 'proveedores_empresa') {
    session.collectedData = session.collectedData || {}
    session.collectedData.empresa = texto
    session.lastIntent = 'proveedores_contacto'
    return {
      message: {
        id: messageId,
        role: 'assistant',
        content: helpMessages.proveedoresContacto,
        timestamp: new Date(),
        metadata: { proveedoresStep: 'contacto' }
      },
    }
  }

  // Paso 3: Tenemos contacto → mostrar mensaje final y enviar correo
  if (session.lastIntent === 'proveedores_contacto') {
    session.collectedData = session.collectedData || {}
    session.collectedData.contacto = texto
    const empresa = session.collectedData.empresa || 'No especificada'
    session.lastIntent = undefined
    session.collectedData = {}

    // Log para que el equipo de compras vea los datos en el servidor
    console.log(`[Proveedores] Nueva propuesta recibida:`)
    console.log(`  Empresa/Servicio: ${empresa}`)
    console.log(`  Contacto: ${texto}`)
    console.log(`  Enviar a: comprasccm@cambridgemty.edu.mx`)

    // Guardar en la base de datos para que aparezca en el panel
    try {
      await db.propuestaProveedor.create({
        data: {
          empresa: empresa,
          contacto: texto,
          descripcion: 'Recibido por flujo simplificado',
          sitioWeb: 'No especificado'
        }
      })
      console.log('[Chat API] 💾 Propuesta de proveedor guardada exitosamente en BD.')
    } catch (dbError) {
      console.error('[Chat API] ❌ Error al guardar propuesta en BD:', dbError)
    }

    return {
      message: {
        id: messageId,
        role: 'assistant',
        content: helpMessages.proveedoresFin,
        timestamp: new Date(),
        metadata: { proveedoresStep: 'fin' }
      },
    }
  }

  // Fallback
  session.lastIntent = undefined
  return {
    message: {
      id: messageId,
      role: 'assistant',
      content: '¿En qué más puedo ayudarte?',
      timestamp: new Date(),
    },
  }
}
