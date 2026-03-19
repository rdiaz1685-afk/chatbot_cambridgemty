# 📋 SESIÓN DE TRABAJO - Agente IA Innovat
**Fecha:** $(date +%Y-%m-%d)
**Estado:** ✅ Prototipo completo con verificación por CURP
**Colegio:** Colegio Cambridge de Monterrey

---

## 🔐 CREDENCIALES CONFIGURADAS

```env
INNOVAT_URL=https://innovat.mx
INNOVAT_USER=prueba.diaz
INNOVAT_PASSWORD=123456
INNOVAT_SCHOOL=Colegio Cambridge de Monterrey
```

---

## 📸 FLUJO DOCUMENTADO CON CAPTURAS

### Captura 1: LOGIN
- Escuela preseleccionada: "Colegio Cambridge de Monterrey"
- Campo Usuario: "prueba.diaz"
- Campo Contraseña: "••••••"
- Botón: "ENTRAR"

### Captura 2: SELECCIÓN CAMPUS + CICLO
- Dropdown combinado con opciones:
  - MITRAS 2025-2026
  - CUMBRES 2025-2026
  - ANÁHUAC 2025-2026
  - NORTE 2025-2026
  - DOMINIO 2025-2026
- Si dicen "campus mitras" → selecciona "MITRAS 2025-2026"
- Si dicen "campus cumbres" → selecciona "CUMBRES 2025-2026"

### Captura 3: MENÚ PARA CURP
- Menú lateral: Escolar > Información Alumnos > General de alumnos
- Dropdown "Unidad": Seleccionar campus
- Botón radial: "Activos" (verde)
- Checkboxes:
  - ✓ Matrícula
  - ✓ Nombre corto
  - ✓ CURP
- Botón: "GENERAR" (verde)

### Captura 4: BÚSQUEDA Y VERIFICACIÓN CURP
- Campo filtro sobre columna CURP
- Teclear el CURP del alumno
- Si aparece en la tabla → Verificación exitosa ✅
- Si NO aparece → CURP no encontrado ❌

---

## 🤖 FLUJO DEL AGENTE

```
┌─────────────────────────────────────────────────────────┐
│                    FLUJO COMPLETO                       │
├─────────────────────────────────────────────────────────┤
│  1. Usuario: "Quiero consultar mi estado de cuenta"     │
│  2. Chatbot: "¿Cuál es el CURP del alumno?"             │
│  3. Usuario: "ABCD123456HDFLNR01"                       │
│  4. Chatbot: "¿En qué campus estudia? (Mitras/Cumbres)" │
│  5. Usuario: "Campus Mitras"                            │
│                                                         │
│  🤖 AGENTE INNOVAT:                                     │
│  ├─ Login (Escuela preseleccionada + User + Pass)       │
│  ├─ Seleccionar "MITRAS 2025-2026"                      │
│  ├─ Navegar a "General de alumnos"                      │
│  ├─ Configurar filtros (Activos, CURP checkbox)         │
│  ├─ Click "GENERAR"                                     │
│  ├─ Buscar CURP en la tabla                             │
│  │                                                      │
│  │  ┌─────────────────────────────┐                     │
│  │  │ ¿CURP encontrado?           │                     │
│  │  ├─────────────┬───────────────┤                     │
│  │  │     SÍ      │      NO       │                     │
│  │  │      ↓      │       ↓       │                     │
│  │  │ Extraer     │ "CURP no      │                     │
│  │  │ estado de   │  encontrado   │                     │
│  │  │ cuenta      │  en campus"   │                     │
│  │  └─────────────┴───────────────┘                     │
│                                                         │
│  6. Mostrar resultado al usuario                        │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 ARCHIVOS MODIFICADOS/CREADOS

| Archivo | Descripción |
|---------|-------------|
| `.env.local` | Credenciales de Innovat |
| `src/lib/config.ts` | Configuración con campus y ciclo |
| `src/lib/automation/innovat-agent.ts` | Agente con flujo completo |
| `src/lib/automation/browser.ts` | Motor de automatización |
| `src/app/api/chat/route.ts` | API de chat con detección de CURP |
| `src/app/api/automation/route.ts` | API de automatización |
| `src/app/page.tsx` | Interfaz de chat |

---

## ✅ CARACTERÍSTICAS IMPLEMENTADAS

1. **Verificación de Identidad por CURP**
   - Valida formato (18 caracteres)
   - Busca en tabla de Innovat
   - Solo muestra datos si CURP coincide

2. **Detección de Campus**
   - Reconoce: "mitras", "Mitras", "MITRAS"
   - Reconoce: "cumbres", "Cumbres", "CUMBRES"
   - Convierte a formato Innovat: "MITRAS 2025-2026"

3. **Automatización Visual**
   - Usa Playwright para controlar navegador
   - Detecta elementos por texto (no por ID dinámico)
   - Toma screenshots para debug

4. **Flujo Conversacional**
   - Detecta intención del usuario
   - Solicita datos faltantes
   - Confirma antes de procesar
   - Muestra resultados claros

---

## 🚀 PRÓXIMOS PASOS

### Para Probar con el Sistema Real:

1. **Instalar navegadores Playwright**:
   ```bash
   bunx playwright install chromium
   ```

2. **Verificar URL de Innovat**:
   - Confirmar que `https://innovat.mx` es correcta
   - O actualizar en `.env.local`

3. **Probar el flujo completo**:
   - Abrir el chat
   - Solicitar estado de cuenta
   - Proporcionar CURP y campus
   - Verificar que funciona

4. **Ajustar selectores** si es necesario:
   - Los selectores actuales son genéricos
   - Pueden requerir ajuste según la estructura real

---

## 🔧 SELECTORES A VERIFICAR

Con las capturas, estos son los selectores que usará el agente:

```typescript
// Login
input[type="text"]          // Campo usuario
input[type="password"]      // Campo contraseña
button:has-text("ENTRAR")   // Botón entrar

// Selección Campus
select                      // Dropdown campus/ciclo
option:has-text("MITRAS 2025-2026")

// Menú navegación
text="Escolar"
text="Información Alumnos"
text="General de alumnos"

// Filtros
select[name*="unidad"]      // Dropdown unidad
radio[value="activos"]      // Botón radial activos
checkbox[name*="curp"]      // Checkbox CURP
button:has-text("GENERAR")  // Botón generar

// Búsqueda CURP
input[placeholder*="curp"]  // Campo filtro CURP
td:has-text("CURP")         // Celda con CURP
```

---

*Proyecto: Colegio Cambridge de Monterrey*
*Verificación de identidad: CURP*
*Ciclo escolar: 2025-2026*
*Campus: Mitras, Cumbres*
