// ============================================
// API de Automatización para Innovat
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { InnovatAgent } from '@/lib/automation/innovat-agent'
import type { ChatAction, AutomationResult, AutomationParams } from '@/types/chat'

// Caché global para guardar la matrícula entre Fases 1/2 y Fase 3
const globalForCache = globalThis as unknown as {
  matriculaCache: Map<string, string> | undefined
}
const matriculaCache = globalForCache.matriculaCache ?? new Map<string, string>()
if (process.env.NODE_ENV !== 'production') {
  globalForCache.matriculaCache = matriculaCache
}

/**
 * POST /api/automation
 * Ejecuta acciones de automatización en el sistema Innovat
 */
export async function POST(request: NextRequest) {
  try {
    const body: AutomationParams = await request.json()
    const { action, curp, campus, cicloEscolar, conceptoId } = body

    console.log('[Automation API] Received request:', { action, curp, campus })

    // Validate required parameters
    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required' },
        { status: 400 }
      )
    }

    // Validate CURP format
    const curpRegex = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z]{2}$/i
    if (curp && !curpRegex.test(curp)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'El formato del CURP no es válido. Debe tener 18 caracteres.' 
        },
        { status: 400 }
      )
    }

    // Generate session ID for this automation
    const sessionId = `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Create agent instance
    const agent = new InnovatAgent(sessionId)

    let result: AutomationResult

    // Execute action
    switch (action) {
      case 'consultar_cuenta':
        if (!curp || !campus) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'CURP y campus son requeridos para consultar estado de cuenta' 
            },
            { status: 400 }
          )
        }
        result = await agent.consultarEstadoCuenta(curp, campus, cicloEscolar)
        // Guardar matrícula en caché si fue encontrada (Fase 1/2)
        if (result.success && result.data?.estudiante?.matricula) {
          matriculaCache.set(curp, result.data.estudiante.matricula)
        }
        break

      case 'generar_ficha':
        if (!curp || !campus) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'CURP y campus son requeridos para generar ficha de pago' 
            },
            { status: 400 }
          )
        }
        
        // Extraer matrícula de caché de la Fase 1/2 (o del request original via body si quisieran pasarlo front-end)
        // Se asume que el backend preservó el caché. Si body trae matricula, le damos prioridad.
        const cachedMatricula = body.matricula || matriculaCache.get(curp);
        
        result = await agent.generarFichaPago(curp, campus, conceptoId, cachedMatricula)
        break

      default:
        return NextResponse.json(
          { success: false, error: `Acción no soportada: ${action}` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: result.success,
      data: result.data,
      error: result.error,
      screenshot: result.screenshot,
    })
  } catch (error) {
    console.error('[Automation API] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido en la automatización' 
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/automation
 * Obtiene el estado de las sesiones de automatización
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  if (sessionId) {
    // Return specific session status
    return NextResponse.json({
      sessionId,
      status: 'completed',
      timestamp: new Date(),
    })
  }

  // Return general status
  return NextResponse.json({
    status: 'running',
    availableActions: [
      {
        action: 'consultar_cuenta',
        description: 'Consultar estado de cuenta de un estudiante (verificación por CURP)',
        requiredParams: ['curp', 'campus'],
        optionalParams: ['cicloEscolar'],
      },
      {
        action: 'generar_ficha',
        description: 'Generar ficha de pago para un estudiante (verificación por CURP)',
        requiredParams: ['curp', 'campus'],
        optionalParams: ['conceptoId'],
      },
    ],
    timestamp: new Date(),
  })
}
