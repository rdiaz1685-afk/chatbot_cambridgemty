// ============================================
// Detector Visual con VLM (GPT-4 Vision)
// ============================================

import ZAI from 'z-ai-web-dev-sdk';
import type { 
  VisualAnalysisResult, 
  DetectedElement, 
  ElementType 
} from '@/types/chat';

/**
 * Clase para detectar elementos en páginas web usando visión artificial
 */
export class VisualDetector {
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

  /**
   * Inicializa el cliente de IA
   */
  private async initialize(): Promise<void> {
    if (!this.zai) {
      this.zai = await ZAI.create();
    }
  }

  /**
   * Analiza un screenshot para detectar elementos de UI
   */
  async analyzeScreenshot(
    screenshotBase64: string,
    context?: string
  ): Promise<VisualAnalysisResult> {
    await this.initialize();

    const prompt = `Analiza esta captura de pantalla de una página web y detecta todos los elementos interactivos.

${context ? `Contexto: ${context}` : ''}

Identifica y describe:
1. **Inputs de texto**: campos para usuario, contraseña, búsqueda, etc.
2. **Botones**: botones de login, enviar, cancelar, etc.
3. **Dropdowns/Selects**: menús desplegables para campus, ciclos, etc.
4. **Tablas**: tablas de datos, especialmente estados de cuenta
5. **Links**: enlaces importantes
6. **Textos visibles**: mensajes de error, títulos, etiquetas

Para cada elemento encontrado, proporciona:
- type: el tipo de elemento (input_text, input_password, button, dropdown, table, link, text)
- text: el texto visible del elemento
- description: descripción breve de su función
- approximatePosition: posición aproximada (top-left, center, right, etc.)

Responde en formato JSON:
{
  "pageDescription": "Descripción general de la página",
  "elements": [
    {
      "type": "input_text",
      "text": "Usuario",
      "description": "Campo para ingresar nombre de usuario",
      "approximatePosition": "center-left"
    }
  ],
  "suggestedActions": ["Acciones sugeridas basadas en los elementos detectados"]
}`;

    try {
      const completion = await this.zai!.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en análisis visual de interfaces de usuario. Tu trabajo es identificar elementos interactivos en capturas de pantalla de páginas web y proporcionar información precisa para automatización. Responde siempre en JSON válido.'
          },
          {
            role: 'user',
            content: `[Imagen base64 adjunta]\n\n${prompt}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });

      const responseText = completion.choices[0]?.message?.content || '';
      
      // Parsear la respuesta JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          elements: result.elements.map((el: { type: string; text: string; description: string; approximatePosition: string }) => ({
            type: el.type as ElementType,
            text: el.text,
            selector: undefined,
            coordinates: this.estimateCoordinates(el.approximatePosition),
            isVisible: true,
          })),
          pageDescription: result.pageDescription,
          suggestedActions: result.suggestedActions,
        };
      }

      // Si no se pudo parsear, retornar resultado básico
      return {
        elements: [],
        pageDescription: responseText,
        suggestedActions: [],
      };
    } catch (error) {
      console.error('[VisualDetector] Error al analizar screenshot:', error);
      return {
        elements: [],
        pageDescription: 'Error al analizar la página',
        suggestedActions: [],
      };
    }
  }

  /**
   * Detecta elementos específicos para login
   */
  async detectLoginElements(screenshotBase64: string): Promise<{
    userInput?: DetectedElement;
    passwordInput?: DetectedElement;
    loginButton?: DetectedElement;
    errorMessages: string[];
  }> {
    const analysis = await this.analyzeScreenshot(
      screenshotBase64,
      'Esta es una página de login. Busca campos de usuario/contraseña y botón de login.'
    );

    const result = {
      userInput: undefined as DetectedElement | undefined,
      passwordInput: undefined as DetectedElement | undefined,
      loginButton: undefined as DetectedElement | undefined,
      errorMessages: [] as string[],
    };

    for (const element of analysis.elements) {
      const text = (element.text || '').toLowerCase();
      
      // Detectar campo de usuario
      if (element.type === 'input_text') {
        if (text.includes('usuario') || text.includes('user') || text.includes('login') || text.includes('email')) {
          result.userInput = element;
        }
      }

      // Detectar campo de contraseña
      if (element.type === 'input_password' || 
          (element.type === 'input_text' && (text.includes('password') || text.includes('contraseña') || text.includes('clave')))) {
        result.passwordInput = element;
      }

      // Detectar botón de login
      if (element.type === 'button') {
        if (text.includes('login') || text.includes('entrar') || text.includes('iniciar') || text.includes('acceder')) {
          result.loginButton = element;
        }
      }

      // Detectar mensajes de error
      if (element.type === 'text') {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('error') || lowerText.includes('incorrecto') || lowerText.includes('inválido')) {
          result.errorMessages.push(element.text || '');
        }
      }
    }

    return result;
  }

  /**
   * Detecta elementos de selección (campus, ciclo escolar)
   */
  async detectSelectionElements(screenshotBase64: string): Promise<{
    campusDropdown?: DetectedElement;
    cicloDropdown?: DetectedElement;
    availableOptions: string[];
  }> {
    const analysis = await this.analyzeScreenshot(
      screenshotBase64,
      'Busca dropdowns o selectores para campus y ciclo escolar.'
    );

    const result = {
      campusDropdown: undefined as DetectedElement | undefined,
      cicloDropdown: undefined as DetectedElement | undefined,
      availableOptions: [] as string[],
    };

    for (const element of analysis.elements) {
      const text = (element.text || '').toLowerCase();

      if (element.type === 'dropdown') {
        if (text.includes('campus') || text.includes('sede') || text.includes('plantel')) {
          result.campusDropdown = element;
        }
        if (text.includes('ciclo') || text.includes('periodo') || text.includes('escolar')) {
          result.cicloDropdown = element;
        }
      }
    }

    return result;
  }

  /**
   * Detecta información de estado de cuenta en una tabla
   */
  async detectAccountStatus(screenshotBase64: string): Promise<{
    found: boolean;
    studentName?: string;
    concepts: Array<{
      descripcion: string;
      monto: string;
      estado: string;
    }>;
    total?: string;
  }> {
    await this.initialize();

    const prompt = `Analiza esta captura de pantalla que debería contener un estado de cuenta escolar.

Extrae la siguiente información:
1. Nombre del estudiante (si está visible)
2. Lista de conceptos de pago con:
   - Descripción del concepto
   - Monto
   - Estado (pagado, pendiente, vencido)
3. Total (si está visible)

Responde SOLO en formato JSON:
{
  "found": true/false,
  "studentName": "nombre del estudiante o null",
  "concepts": [
    {
      "descripcion": "descripción",
      "monto": "$0.00",
      "estado": "pagado/pendiente/vencido"
    }
  ],
  "total": "$0.00 o null"
}`;

    try {
      const completion = await this.zai!.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en extraer información estructurada de estados de cuenta. Responde siempre en JSON válido y preciso.'
          },
          {
            role: 'user',
            content: `[Imagen base64 adjunta]\n\n${prompt}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      });

      const responseText = completion.choices[0]?.message?.content || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { found: false, concepts: [] };
    } catch (error) {
      console.error('[VisualDetector] Error al detectar estado de cuenta:', error);
      return { found: false, concepts: [] };
    }
  }

  /**
   * Detecta el campo de búsqueda de estudiante
   */
  async detectSearchField(screenshotBase64: string): Promise<{
    searchInput?: DetectedElement;
    searchButton?: DetectedElement;
  }> {
    const analysis = await this.analyzeScreenshot(
      screenshotBase64,
      'Busca campos para buscar estudiante por matrícula o nombre.'
    );

    const result = {
      searchInput: undefined as DetectedElement | undefined,
      searchButton: undefined as DetectedElement | undefined,
    };

    for (const element of analysis.elements) {
      const text = (element.text || '').toLowerCase();

      if (element.type === 'input_text') {
        if (text.includes('matrícula') || text.includes('buscar') || text.includes('search') || text.includes('alumno')) {
          result.searchInput = element;
        }
      }

      if (element.type === 'button') {
        if (text.includes('buscar') || text.includes('search') || text.includes('consultar')) {
          result.searchButton = element;
        }
      }
    }

    return result;
  }

  /**
   * Detecta mensajes de error en la página
   */
  async detectErrors(screenshotBase64: string): Promise<string[]> {
    const analysis = await this.analyzeScreenshot(
      screenshotBase64,
      'Busca mensajes de error, alertas o notificaciones de problema.'
    );

    const errors: string[] = [];

    for (const element of analysis.elements) {
      const text = element.text || '';
      const lowerText = text.toLowerCase();

      if (
        lowerText.includes('error') ||
        lowerText.includes('incorrecto') ||
        lowerText.includes('inválido') ||
        lowerText.includes('no encontrado') ||
        lowerText.includes('falló') ||
        lowerText.includes('problema') ||
        lowerText.includes('advertencia')
      ) {
        errors.push(text);
      }
    }

    // También buscar en las acciones sugeridas
    for (const action of analysis.suggestedActions) {
      if (action.toLowerCase().includes('error')) {
        errors.push(action);
      }
    }

    return errors;
  }

  /**
   * Genera selector CSS basado en descripción del elemento
   */
  generateSelector(element: DetectedElement): string {
    if (element.selector) {
      return element.selector;
    }

    // Generar selectores comunes basados en tipo
    switch (element.type) {
      case 'input_text':
      case 'input_password':
        if (element.placeholder) {
          return `input[placeholder*="${element.placeholder}"]`;
        }
        if (element.text) {
          return `input[name*="${element.text.toLowerCase()}"], input[id*="${element.text.toLowerCase()}"]`;
        }
        return 'input[type="text"], input:not([type])';
      
      case 'button':
        if (element.text) {
          return `button:has-text("${element.text}")`;
        }
        return 'button';
      
      case 'dropdown':
        return 'select';
      
      case 'table':
        return 'table';
      
      default:
        return '*';
    }
  }

  /**
   * Estima coordenadas basado en posición aproximada
   */
  private estimateCoordinates(position: string): { x: number; y: number; width: number; height: number } {
    const baseCoords = {
      'top-left': { x: 100, y: 100, width: 200, height: 40 },
      'top-center': { x: 860, y: 100, width: 200, height: 40 },
      'top-right': { x: 1620, y: 100, width: 200, height: 40 },
      'center-left': { x: 100, y: 500, width: 200, height: 40 },
      'center': { x: 860, y: 500, width: 200, height: 40 },
      'center-right': { x: 1620, y: 500, width: 200, height: 40 },
      'bottom-left': { x: 100, y: 900, width: 200, height: 40 },
      'bottom-center': { x: 860, y: 900, width: 200, height: 40 },
      'bottom-right': { x: 1620, y: 900, width: 200, height: 40 },
    };

    return baseCoords[position as keyof typeof baseCoords] || baseCoords['center'];
  }

  /**
   * Analiza el tipo de página actual
   */
  async identifyPageType(screenshotBase64: string): Promise<{
    type: 'login' | 'dashboard' | 'search' | 'account_status' | 'payment' | 'unknown';
    confidence: number;
    description: string;
  }> {
    await this.initialize();

    const prompt = `Identifica qué tipo de página es esta captura de pantalla.

Opciones:
- login: Página de inicio de sesión
- dashboard: Panel principal después del login
- search: Página de búsqueda de estudiantes
- account_status: Página con estado de cuenta o información de pagos
- payment: Página de pago o ficha de pago
- unknown: No se puede identificar

Responde SOLO en JSON:
{
  "type": "tipo_de_pagina",
  "confidence": 0.0_a_1.0,
  "description": "breve descripción"
}`;

    try {
      const completion = await this.zai!.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en clasificación de páginas web. Responde siempre en JSON válido.'
          },
          {
            role: 'user',
            content: `[Imagen base64 adjunta]\n\n${prompt}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 200,
      });

      const responseText = completion.choices[0]?.message?.content || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { type: 'unknown', confidence: 0, description: 'No se pudo identificar' };
    } catch (error) {
      console.error('[VisualDetector] Error al identificar página:', error);
      return { type: 'unknown', confidence: 0, description: 'Error en el análisis' };
    }
  }
}

export default VisualDetector;
