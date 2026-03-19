import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Obtener todas las propuestas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const soloNoRevisadas = searchParams.get('pendientes') === 'true'

    const propuestas = await db.propuestaProveedor.findMany({
      where: soloNoRevisadas ? { revisada: false } : undefined,
      orderBy: { creadaEn: 'desc' },
    })

    return NextResponse.json({ propuestas })
  } catch (error) {
    console.error('[Admin API] Error al obtener propuestas:', error)
    return NextResponse.json({ error: 'Error al obtener propuestas' }, { status: 500 })
  }
}

// PATCH - Marcar como revisada / agregar notas
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, revisada, notas } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const updated = await db.propuestaProveedor.update({
      where: { id },
      data: {
        ...(typeof revisada === 'boolean' && { revisada }),
        ...(typeof notas === 'string' && { notas }),
      },
    })

    return NextResponse.json({ propuesta: updated })
  } catch (error) {
    console.error('[Admin API] Error al actualizar propuesta:', error)
    return NextResponse.json({ error: 'Error al actualizar propuesta' }, { status: 500 })
  }
}

// DELETE - Eliminar una propuesta
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    await db.propuestaProveedor.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin API] Error al eliminar propuesta:', error)
    return NextResponse.json({ error: 'Error al eliminar propuesta' }, { status: 500 })
  }
}
