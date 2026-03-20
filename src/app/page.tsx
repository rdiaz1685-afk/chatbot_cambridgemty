'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  FileText, 
  CreditCard, 
  HelpCircle,
  CheckCircle2,
  GraduationCap,
  Handshake,
  Paperclip,
  Share2
} from 'lucide-react'
import type { Message, ChatAction, QuickAction } from '@/types/chat'

const quickActions: QuickAction[] = [
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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  // Guardamos CURP y campus del alumno verificado para generar fichas directamente
  const [alumnoVerificado, setAlumnoVerificado] = useState<{ curp: string; campus: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Welcome message on mount
  useEffect(() => {
    const welcomeMessage: Message = {
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      content: '¡Hola! 👋 Bienvenido al Colegio Cambridge de Monterrey. Soy tu Asistente Virtual.\n\nEstoy aquí para apoyarte con cualquier duda o trámite que necesites. ¿En qué puedo ayudarte hoy?',
      timestamp: new Date(),
    }
    setMessages([welcomeMessage])
  }, [])

  // Auto scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Focus input
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Send message to API
  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText.trim(),
          sessionId,
          history: messages.slice(-10), // Last 10 messages for context
        }),
      })

      if (!response.ok) {
        throw new Error('Error al procesar el mensaje')
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message.content,
        timestamp: new Date(),
        metadata: data.message.metadata,
      }

      setMessages(prev => [...prev, assistantMessage])

      // If automation is required, execute it
      if (data.requiresAction && data.actionData) {
        await executeAutomation(data.actionData)
      }
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu solicitud. Por favor intenta de nuevo.',
        timestamp: new Date(),
        metadata: { error: 'api_error' },
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, messages, sessionId])

  // Execute automation action
  const executeAutomation = useCallback(async (actionData: {
    action: ChatAction
    curp?: string
    campus?: string
    conceptoId?: string
  }) => {
    const loadingMessage: Message = {
      id: `loading-${Date.now()}`,
      role: 'assistant',
      content: actionData.conceptoId ? `⏳ Generando ficha para ${actionData.conceptoId}...` : '⏳ Verificando CURP en el sistema Innovat...',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, loadingMessage])

    try {
      const response = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionData.action,
          curp: actionData.curp,
          campus: actionData.campus,
          conceptoId: actionData.conceptoId,
        }),
      })

      const data = await response.json()

      // Remove loading message
      setMessages(prev => prev.filter(m => m.id !== loadingMessage.id))

      if (data.success) {
        const resultMessage: Message = {
          id: `result-${Date.now()}`,
          role: 'assistant',
          content: formatAutomationResult(data),
          timestamp: new Date(),
          metadata: { 
            data: data.data,
            screenshot: data.screenshot,
          },
        }
        // Si fue un estado de cuenta exitoso, guardar CURP y campus para fichas directas
        if (data.data?.tipo === 'estado_cuenta' && data.data?.estudiante?.curp && actionData.campus) {
          setAlumnoVerificado({ curp: data.data.estudiante.curp, campus: actionData.campus })
        }
        setMessages(prev => [...prev, resultMessage])
      } else {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `❌ ${data.error || 'Error al procesar la automatización'}`,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('Automation error:', error)
      setMessages(prev => prev.filter(m => m.id !== loadingMessage.id))
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '❌ Error al ejecutar la automatización. Por favor intenta de nuevo.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }, [])

  // Format automation result for display
  const formatAutomationResult = (data: {
    data?: {
      tipo?: string
      estudiante?: { nombre?: string; curp?: string; matricula?: string; verificado?: boolean }
      estadoCuenta?: {
        conceptos: Array<{
          descripcion: string
          monto: number
          estado: string
        }>
        total: number
        totalPagado: number
        totalPendiente: number
      }
      mensaje?: string
    }
  }): string => {
    if (!data.data) return 'Operación completada.'

    const { tipo, estudiante, estadoCuenta, mensaje } = data.data

    let result = ''

    if (tipo === 'estado_cuenta' && estadoCuenta) {
      result = `✅ **Identidad Verificada**\n\n`
      if (estudiante?.verificado === false) {
        return `❌ **CURP No Encontrado**\n\nNo se encontró el CURP proporcionado en el campus indicado. Por favor verifica:\n\n• El CURP esté escrito correctamente\n• El campus sea el correcto\n\nSi el problema persiste, contacta a la administración del colegio.`
      }
      if (estudiante?.nombre) {
        result += `👤 **Estudiante:** ${estudiante.nombre}\n`
        if (estudiante.curp) result += `🆔 **CURP:** ${estudiante.curp}\n`
        if (estudiante.matricula) result += `🎓 **Matrícula:** ${estudiante.matricula}\n`
        result += `\n`
      }

      if (estadoCuenta.conceptos?.length > 0) {
        result += `📋 **Conceptos:**\n`
        estadoCuenta.conceptos.forEach((c, i) => {
          const statusIcon = c.estado === 'pagado' ? '✅' : c.estado === 'vencido' ? '⚠️' : '⏳'
          result += `${i + 1}. ${statusIcon} ${c.descripcion} - $${c.monto.toFixed(2)} (${c.estado})\n`
        })
        result += `\n💰 **Total:** $${estadoCuenta.total.toFixed(2)}\n`
        result += `✅ **Pagado:** $${estadoCuenta.totalPagado.toFixed(2)}\n`
        result += `⏳ **Pendiente:** $${estadoCuenta.totalPendiente.toFixed(2)}`
      } else {
        result += `No hay conceptos de pago registrados.`
      }
    } else if (tipo === 'ficha_pago') {
      result = `✅ **Ficha de Pago Generada**\n\n${mensaje || 'Tu ficha está lista.'}`
    } else {
      result = mensaje || 'Operación completada exitosamente.'
    }

    return result
  }

  // Handle quick action click
  const handleQuickAction = (action: QuickAction) => {
    let message = ''
    switch (action.action) {
      case 'consultar_cuenta':
        message = 'Quiero consultar mi estado de cuenta'
        break
      case 'generar_ficha':
        message = 'Necesito generar una ficha de pago'
        break
      case 'proveedores':
        message = 'Soy proveedor y me gustaría dejar mis datos'
        break
      case 'becas':
        message = 'Quiero información sobre becas'
        break
      case 'ayuda':
        message = 'Necesito ayuda'
        break
      default:
        message = action.label
    }
    sendMessage(message)
  }

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  // Get icon for quick action
  const getActionIcon = (action: ChatAction) => {
    switch (action) {
      case 'consultar_cuenta':
        return <FileText className="h-4 w-4" />
      case 'generar_ficha':
        return <CreditCard className="h-4 w-4" />
      case 'proveedores':
        return <Handshake className="h-4 w-4" />
      case 'becas':
        return <GraduationCap className="h-4 w-4" />
      case 'ayuda':
        return <HelpCircle className="h-4 w-4" />
      default:
        return <Bot className="h-4 w-4" />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col overflow-hidden">
      <div className="mx-auto w-full max-w-4xl h-[100dvh] flex flex-col p-2 md:p-4 gap-3">
        {/* Header */}
        <Card className="shrink-0 shadow-lg border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-10 w-10 border-2 border-primary/20">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Bot className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-white dark:border-slate-900" />
              </div>
              <div>
                <CardTitle className="text-lg">Asistente Virtual</CardTitle>
                <p className="text-xs text-muted-foreground">Colegio Cambridge de Monterrey</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Chat Area */}
        <Card className="flex-1 min-h-0 flex flex-col shadow-xl border-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            <div className="flex flex-col gap-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted rounded-bl-md'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content.split('\n').map((line, i) => {
                        // Handle bold text
                        const parts = line.split(/(\*\*[^*]+\*\*)/g)
                        return (
                          <div key={i}>
                            {parts.map((part, j) => {
                              if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={j}>{part.slice(2, -2)}</strong>
                              }
                              return <span key={j}>{part}</span>
                            })}
                          </div>
                        )
                      })}
                    </div>
                    
                    {message.metadata?.error && (
                      <Badge variant="destructive" className="mt-2 text-xs">
                        Error
                      </Badge>
                    )}
                    
                    {message.metadata?.data && (
                      <div className="mt-2 pt-2 border-t border-border/50 space-y-3">
                        {/* Visualización de Conceptos para Estado de Cuenta */}
                        {(message.metadata.data as any).tipo === 'estado_cuenta' && (message.metadata.data as any).estadoCuenta?.conceptos?.length > 0 && (() => {
                          const conceptos = (message.metadata.data as any).estadoCuenta.conceptos;
                          const pendientes = conceptos.filter((c: any) => c.estado !== 'pagado');
                          const pagados = conceptos.filter((c: any) => c.estado === 'pagado');
                          
                          return (
                            <div className="flex flex-col gap-2">
                              <div className="flex justify-between items-center mb-1">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Conceptos Pendientes ({pendientes.length}):</p>
                              </div>
                              
                              <div className="max-h-[250px] overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
                                {pendientes.map((c: any, idx: number) => (
                                  <div key={idx} className="flex flex-col bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-2 border border-amber-200/50 dark:border-amber-800/30">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-[11px] font-medium truncate pr-2">{c.descripcion}</span>
                                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">${c.monto.toFixed(2)}</span>
                                    </div>
                                    <Button 
                                      variant="secondary" 
                                      size="sm" 
                                      className="h-7 text-[10px] w-full mt-1 bg-amber-600 hover:bg-amber-700 text-white border-0"
                                      onClick={() => {
                                        const datos = alumnoVerificado
                                        if (datos) {
                                          executeAutomation({ action: 'generar_ficha', curp: datos.curp, campus: datos.campus, conceptoId: c.descripcion })
                                        } else {
                                          sendMessage(`Generar ficha para ${c.descripcion}`)
                                        }
                                      }}
                                      disabled={isLoading}
                                    >
                                      <CreditCard className="h-3 w-3 mr-1" />
                                      Generar Ficha
                                    </Button>
                                  </div>
                                ))}

                                {pendientes.length === 0 && (
                                  <div className="text-center py-4 bg-green-50/30 rounded-lg border border-green-100 italic text-[11px] text-green-700">
                                    ¡No tienes pagos pendientes! 🎉
                                  </div>
                                )}

                                {pagados.length > 0 && (
                                  <details className="mt-1">
                                    <summary className="text-[9px] text-muted-foreground cursor-pointer hover:text-primary transition-colors text-center list-none font-medium">
                                      Ver {pagados.length} conceptos pagados...
                                    </summary>
                                    <div className="flex flex-col gap-1 mt-2">
                                      {pagados.map((c: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center p-1.5 bg-background/30 rounded border border-border/30 opacity-70">
                                          <span className="text-[10px] truncate pr-2">{c.descripcion}</span>
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-medium">${c.monto.toFixed(2)}</span>
                                            <span className="text-[8px] bg-green-100 text-green-700 px-1 rounded">Ok</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Botones del flujo de Becas */}
                        {(message.metadata as any)?.becasStep === 'inicio' && (
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <Button
                              size="sm"
                              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => sendMessage('Sí, cuéntame')}
                              disabled={isLoading}
                            >
                              ✅ Sí, cuéntame
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => sendMessage('No por ahora')}
                              disabled={isLoading}
                            >
                              ❌ No por ahora
                            </Button>
                          </div>
                        )}

                        {/* Botones paso 2: ¿Tienes alguna duda? */}
                        {(message.metadata as any)?.becasStep === 'proceso' && (
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <Button
                              size="sm"
                              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => sendMessage('Sí, tengo una duda')}
                              disabled={isLoading}
                            >
                              ✅ Sí, tengo una duda
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => sendMessage('No, gracias')}
                              disabled={isLoading}
                            >
                              ❌ No, gracias
                            </Button>
                          </div>
                        )}

                        {/* Visualización de Ficha de Pago */}
                        {(message.metadata.data as any).tipo === 'ficha_pago' && (message.metadata.data as any).fichaPago?.fileUrl && (
                          <div className="flex flex-col gap-3 bg-primary/5 rounded-xl p-4 border border-primary/20">
                            <div className="flex items-center gap-3">
                              <div className="bg-primary/10 p-2 rounded-lg">
                                <FileText className="h-6 w-6 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-primary">Ficha de Pago Lista</p>
                                <p className="text-[10px] text-muted-foreground">{(message.metadata.data as any).fichaPago.concepto}</p>
                              </div>
                            </div>
                            <Button 
                              asChild
                              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                            >
                              <a 
                                href={(message.metadata.data as any).fichaPago.fileUrl} 
                                download="Ficha_de_Pago.pdf" 
                                className="flex items-center justify-center gap-2"
                              >
                                <Send className="h-4 w-4 rotate-90" />
                                Descargar PDF
                              </a>
                            </Button>
                          </div>
                        )}
                        
                        <Badge variant="outline" className="text-[10px] py-0 h-5">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Datos actualizados
                        </Badge>
                      </div>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Pensando...</span>
                    </div>
                  </div>
                </div>
              )}
              {/* Ghost div for auto-scrolling */}
              <div ref={messagesEndRef} className="h-1" />
            </div>
          </div>

          {/* Quick Actions */}
          {messages.length <= 2 && (
            <div className="px-4 pb-3">
              <div className="flex flex-wrap gap-2 justify-center">
                {quickActions.map((action) => (
                  <Button
                    key={action.id}
                    variant="outline"
                    size="sm"
                    className="h-auto py-2 px-3 gap-2 rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => handleQuickAction(action)}
                    disabled={isLoading}
                  >
                    <span>{action.icon}</span>
                    <span className="text-xs">{action.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t bg-background/50 p-4">
            <form onSubmit={handleSubmit} className="flex gap-2 items-center">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu mensaje..."
                className="flex-1 rounded-full"
                disabled={isLoading}
              />
              <Button 
                type="submit" 
                size="icon" 
                className="rounded-full h-10 w-10 shrink-0"
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              🔒 Privacidad Protegida • Colegio Cambridge de Monterrey
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
