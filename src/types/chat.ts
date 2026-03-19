// ============================================
// Tipos e Interfaces para el Chatbot Innovat
// ============================================

/**
 * Rol del mensaje en la conversación
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Mensaje individual en el chat
 */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  metadata?: MessageMetadata;
}

/**
 * Metadatos opcionales del mensaje
 */
export interface MessageMetadata {
  action?: ChatAction;
  data?: Record<string, unknown>;
  error?: string;
  screenshot?: string;
  id?: string;
}

/**
 * Acciones disponibles en el chat
 */
export type ChatAction = 
  | 'consultar_cuenta'
  | 'generar_ficha'
  | 'ayuda'
  | 'login'
  | 'logout'
  | 'proveedores'
  | 'becas';

/**
 * Estado del chat
 */
export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isTyping: boolean;
  error: string | null;
  sessionId: string;
}

/**
 * Resultado de una operación de automatización
 */
export interface AutomationResult {
  success: boolean;
  data?: AutomationData;
  error?: string;
  screenshot?: string;
}

/**
 * Datos extraídos de la automatización
 */
export interface AutomationData {
  tipo: 'estado_cuenta' | 'ficha_pago' | 'login' | 'error';
  estudiante?: StudentInfo;
  estadoCuenta?: EstadoCuenta;
  fichaPago?: FichaPago;
  mensaje?: string;
}

/**
 * Información del estudiante
 */
export interface StudentInfo {
  curp: string;
  matricula?: string;
  nombre: string;
  campus: string;
  cicloEscolar?: string;
  grado?: string;
  grupo?: string;
  verificado?: boolean; // True si el CURP fue verificado en el sistema
}

/**
 * Estado de cuenta del estudiante
 */
export interface EstadoCuenta {
  conceptos: ConceptoPago[];
  total: number;
  totalPagado: number;
  totalPendiente: number;
  fechaActualizacion: Date;
}

/**
 * Concepto de pago individual
 */
export interface ConceptoPago {
  id: string;
  descripcion: string;
  monto: number;
  fechaLimite?: Date;
  estado: 'pagado' | 'pendiente' | 'vencido';
  fechaPago?: Date;
  referencia?: string;
}

/**
 * Ficha de pago generada
 */
export interface FichaPago {
  referencia: string;
  concepto: string;
  monto: number;
  fechaLimite: Date;
  lineaCaptura?: string;
  qrCode?: string;
  fileUrl?: string;
}

/**
 * Credenciales para Innovat
 */
export interface InnovatCredentials {
  username: string;
  password: string;
}

/**
 * Parámetros para la automatización
 */
export interface AutomationParams {
  action: ChatAction;
  credentials?: InnovatCredentials;
  curp?: string;        // CURP del alumno (verificación de identidad)
  matricula?: string;   // Se obtiene después de verificar CURP
  campus?: string;
  cicloEscolar?: string;
  conceptoId?: string;
  // Campos para Proveedores
  empresa?: string;
  contacto?: string;
  descripcion?: string;   // Descripción del producto/servicio ofrecido
  archivoUrl?: string;    // URL del archivo adjunto (PDF, presentación, etc.)
}

/**
 * Resultado del análisis visual
 */
export interface VisualAnalysisResult {
  elements: DetectedElement[];
  pageDescription: string;
  suggestedActions: string[];
}

/**
 * Elemento detectado en la página
 */
export interface DetectedElement {
  type: ElementType;
  text?: string;
  selector?: string;
  coordinates?: { x: number; y: number; width: number; height: number };
  value?: string;
  placeholder?: string;
  isVisible: boolean;
}

/**
 * Tipos de elementos que se pueden detectar
 */
export type ElementType = 
  | 'input_text'
  | 'input_password'
  | 'button'
  | 'dropdown'
  | 'table'
  | 'link'
  | 'text'
  | 'image'
  | 'checkbox'
  | 'radio';

/**
 * Solicitud al endpoint de chat
 */
export interface ChatRequest {
  message: string;
  sessionId: string;
  history?: Message[];
}

/**
 * Respuesta del endpoint de chat
 */
export interface ChatResponse {
  message: Message;
  requiresAction?: boolean;
  actionData?: AutomationParams;
}

/**
 * Opción rápida del chat
 */
export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  action: ChatAction;
  description: string;
}

/**
 * Configuración del agente
 */
export interface AgentConfig {
  innovatUrl: string;
  credentials: InnovatCredentials;
  headless: boolean;
  timeout: number;
  maxRetries: number;
}

/**
 * Estado de la sesión de automatización
 */
export interface AutomationSession {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  currentStep?: string;
  progress?: number;
  result?: AutomationResult;
  startTime: Date;
  endTime?: Date;
}

/**
 * Pasos del proceso de automatización
 */
export type AutomationStep = 
  | 'init'
  | 'login'
  | 'select_campus'
  | 'select_ciclo'
  | 'search_student'
  | 'extract_data'
  | 'generate_ficha'
  | 'cleanup';
