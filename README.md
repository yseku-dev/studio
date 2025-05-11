# CodeAlchemist

CodeAlchemist es una plataforma de desarrollo asistido por inteligencia artificial (IA) diseñada para optimizar y agilizar el ciclo de vida del desarrollo de software. Ofrece herramientas para la generación y análisis de código, refactorización asistida, gestión de versiones, ejecución de grupos de trabajo IA y análisis de proyectos completos, todo ello potenciado por diversos modelos de IA a través de sus respectivas APIs o endpoints locales.

## Características Principales

*   **Generación de Código**: Crea fragmentos de código a partir de descripciones en lenguaje natural.
*   **Generación de Proyectos**: Define una estructura base para nuevos proyectos según tus especificaciones.
*   **Refactorizar Proyecto**: Sube un proyecto (ZIP, JSON, archivo de texto) o proporciona una URL de Git (simulada) para obtener sugerencias de refactorización generadas por la IA. Utiliza un agente "RefactorizadorCodigoExperto" o un grupo de trabajo que lo incluya. Permite especificar metas y prioridades de refactorización.
*   **Análisis de Código Inteligente**: Pega fragmentos de código o sube archivos para recibir análisis detallados y sugerencias de mejora generadas por IA.
*   **Análisis de Proyecto Completo**: Sube un proyecto en formato ZIP/JSON o proporciona una URL de Git para un análisis holístico (funcionalidad Git actualmente simulada).
*   **AutoUpdate (Análisis del Propio Código)**: Permite que CodeAlchemist analice su propio código fuente (obtenido al momento). Ofrece sugerencias, permite aplicarlas directamente (modificando los archivos), descargar el código fuente completo en ZIP o JSON, o subirlo a un repositorio Git. Las comunicaciones con la IA están optimizadas para manejar grandes cantidades de código mediante fragmentación y timeouts.
*   **Versiones Guardadas (Snapshots)**: Guarda diferentes versiones de tu código (original y sugerido) para una fácil revisión, comparación y seguimiento.
*   **Chat con IA**: Interactúa con un asistente IA para obtener ayuda, resolver dudas o generar ideas.
*   **Gestión de Agentes IA**: Crea y configura agentes IA individuales, cada uno con su propio mensaje de sistema, configuración LLM (global o personalizada) y capacidades (acceso a código propio, ejecución, entorno virtual, lectura/escritura de archivos).
*   **Gestión de Grupos de Trabajo IA**: Define grupos de agentes para colaborar en tareas complejas. Un agente "OrquestadorFlujoAgentes" dirige el flujo de trabajo. Observa la ejecución en un log detallado.
*   **Interfaz de Usuario Intuitiva**: Construida con Next.js y ShadCN UI para una experiencia de usuario moderna, responsiva y agradable. La barra lateral es colapsable para maximizar el espacio de trabajo.
*   **Configuración Personalizada**:
    *   **LLM**: Selecciona el proveedor (Groq, Google Gemini, OpenAI, Anthropic, LM Studio, Ollama), introduce tu clave API (si es necesaria), elige el modelo y, para proveedores locales, especifica la URL de la API. Incluye un test de conexión.
    *   **Git**: Configura la URL del repositorio, nombre de usuario, email y Token de Acceso Personal (PAT) para la funcionalidad de subida a Git en AutoUpdate. Incluye un test de conexión.
*   **Manejo de Errores Mejorado**: Los errores, especialmente durante las interacciones con la IA o Git, se muestran claramente. Se pueden copiar para depuración y, en algunos casos (AutoUpdate, Subida a Git), se ofrece un botón "Auto-Fix" para que la IA intente proponer una solución al error. CodeAlchemist intenta gestionar errores comunes de API LLM (límites de tokens/TPM, timeouts) con reintentos y fragmentación.

## Arquitectura

CodeAlchemist está construido con Next.js (utilizando el App Router) y React para el frontend. El backend se basa en Server Actions de Next.js para manejar la lógica de negocio y las interacciones con servicios externos.

*   **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS, ShadCN UI.
*   **Backend (Server Actions)**: Lógica para interactuar con APIs LLM, gestión de archivos (para AutoUpdate), operaciones Git.
*   **Capa de Servicios LLM**: Un módulo (`src/services/groq.ts`, aunque el nombre es histórico y ahora es genérico) abstrae las llamadas a diferentes proveedores de LLM, manejando la construcción de la solicitud, autenticación y reintentos.
*   **Configuración LLM**: Los usuarios pueden configurar un proveedor LLM global o especificar configuraciones personalizadas para cada Agente IA.
*   **Persistencia**: La configuración de la aplicación, agentes, grupos y snapshots de código se almacenan en el `localStorage` del navegador.

## Tecnologías Utilizadas

*   **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS, ShadCN UI
*   **IA y Modelos de Lenguaje**: APIs de Groq, Google Gemini, OpenAI, Anthropic; soporte para endpoints locales de LM Studio y Ollama.
*   **Empaquetado (Descarga de Fuente)**: JSZip
*   **Operaciones Git (Cliente)**: Simple-git (para subidas desde AutoUpdate)

## Guía de Inicio

### Requisitos Previos

*   Node.js (versión 18.x o superior recomendada)
*   npm (normalmente incluido con Node.js) o Yarn

### Instalación

1.  **Clonar el Repositorio**:
    ```bash
    git clone https://github.com/tu-usuario/codealchemist.git
    cd codealchemist
    ```
    *(Reemplaza `https://github.com/tu-usuario/codealchemist.git` con la URL real del repositorio)*

2.  **Instalar Dependencias**:
    Usando npm:
    ```bash
    npm install
    ```
    O usando Yarn:
    ```bash
    yarn install
    ```

3.  **Configuración del Entorno**:
    *   No se requiere un archivo `.env.local` para la configuración básica de las claves API de LLM, ya que se gestionan desde la interfaz de usuario y se guardan en `localStorage`. Si planeas añadir variables de entorno del lado del servidor para otros propósitos, puedes crear un `.env.local`.

4.  **Ejecutar la Aplicación en Desarrollo**:
    ```bash
    npm run dev
    ```
    O si usas Yarn:
    ```bash
    yarn dev
    ```
    La aplicación debería estar disponible en `http://localhost:9002` (o el puerto que hayas configurado).

## Tutorial de Uso Detallado

### 1. Navegación y Barra Lateral

*   La aplicación cuenta con una barra lateral a la izquierda para acceder a todas las secciones.
*   Puedes **Ocultar/Mostrar** la barra lateral haciendo clic en el icono respectivo en la parte inferior de la misma (en escritorio) para maximizar el espacio de trabajo. En móviles, un menú hamburguesa controla su visibilidad.

### 2. Configuración Inicial (Sección "Configuración")

Es crucial configurar correctamente la aplicación antes de usar las funcionalidades de IA y Git.

*   **Configuración del Proveedor LLM**:
    *   **Proveedor LLM**: Selecciona el servicio que deseas utilizar (Groq, Google Gemini, OpenAI, Anthropic, LM Studio, Ollama).
    *   **URL del Endpoint de API**: Para proveedores como LM Studio u Ollama, o si usas un proxy, introduce la URL base del endpoint (ej. `http://localhost:1234/v1` para LM Studio). Para los demás, este campo se rellena automáticamente, pero puedes sobrescribirlo.
    *   **Clave API**: Si el proveedor seleccionado la requiere, introduce tu clave API.
    *   **Nombre del Modelo**: Selecciona uno de los modelos disponibles para el proveedor elegido. La lista se actualiza según el proveedor y la clave API.
    *   Haz clic en **"Probar Conexión (Proveedor LLM)"** para verificar tu configuración.
*   **Configuración de Git (Opcional, para AutoUpdate)**:
    *   **URL del Repositorio Git**: La URL HTTPS de tu repositorio (ej. `https://github.com/tu-usuario/tu-repo.git`).
    *   **Nombre de Usuario Git**: Tu nombre de usuario de la plataforma Git.
    *   **Email de Git**: El email asociado a tus commits.
    *   **Token de Acceso Personal (PAT)**: Un PAT con permisos para escribir en el repositorio.
    *   Haz clic en **"Probar Conexión Git"** para verificar la autenticación.
*   Haz clic en **"Guardar Configuración"**.

### 3. Generar Código (Sección "Generar Código")

Crea fragmentos de código a partir de descripciones.

*   **Usar Configuración LLM De**: Elige si usar la configuración "Global", de un "Agente IA" específico, o de un "Grupo de Trabajo IA".
*   **Describe tu necesidad**: Escribe un prompt detallado.
*   Haz clic en **"Generar Código"** y confirma.
*   **Resultados**: Verás una explicación y el fragmento de código generado, que puedes copiar.

### 4. Generar Proyecto (Sección "Generar Proyecto")

Crea una estructura base para un nuevo proyecto.

*   **Usar Configuración LLM De**: Selecciona la fuente de configuración LLM.
*   **Describe tu proyecto**: Proporciona un prompt detallado.
*   Haz clic en **"Generar Proyecto"** y confirma.
*   **Resultados**: Nombre sugerido, notas de la IA y una lista de archivos con su contenido. Puedes descargar el proyecto en ZIP.

### 5. Refactorizar Proyecto (Sección "Refactorizar Proyecto")

Obtén sugerencias de refactorización para un proyecto completo.

*   **Usar Configuración LLM De**: Selecciona la fuente de configuración (Global, Agente especializado como "RefactorizadorCodigoExperto", o un Grupo que incluya al Refactorizador y al Orquestador).
*   **Pestañas para Fuente del Proyecto**:
    *   **Subir Archivo**: Sube un archivo `.zip`, `.json` o de texto plano (ej: `.py`, `.js`) que contenga el código del proyecto.
    *   **Desde Repositorio Git**: Ingresa la URL de un repositorio Git (esta función para obtener el código de Git es actualmente simulada; se espera que el usuario suba el código).
*   **Parámetros de Refactorización**:
    *   **Metas (opcional)**: Describe los objetivos específicos de la refactorización (ej. "Mejorar el rendimiento de los componentes de UI", "Simplificar la lógica de negocio en los servicios").
    *   **Prioridad General (opcional)**: Selecciona un enfoque general para las sugerencias (ej. "Priorizar Seguridad", "Priorizar Legibilidad").
*   Haz clic en **"Analizar para Refactorizar"**.
*   **Resultados y Sugerencias**:
    *   Se mostrará una lista de sugerencias, cada una con:
        *   **Área**: El archivo o componente afectado.
        *   **Descripción**: La mejora propuesta.
        *   **Prioridad**: Alta, Media o Baja.
        *   **Snippet Sugerido (opcional)**: Un fragmento del código modificado.
    *   **Acciones por Sugerencia**:
        *   **Aplicar (Simulado)**: Marca la sugerencia como aplicada (la modificación real del archivo no está implementada en esta sección).
        *   **Ver Diff (Simulado)**: Muestra una comparación simulada.
        *   **Descartar**: Omite la sugerencia.
    *   **Acción Masiva**:
        *   **Aplicar Todas las Sugerencias (Simulado)**.
*   **Logs de Ejecución**: Una ventana muestra logs detallados del proceso de análisis del grupo de trabajo si se seleccionó uno.

### 6. Analizar Código (Sección "Analizar Código")

Obtén análisis y sugerencias para fragmentos o archivos individuales.

*   **Usar Configuración LLM De**: Selecciona la fuente de configuración LLM.
*   **Sube un archivo de código (opcional)** o pega tu código directamente.
*   Haz clic en **"Analizar Código"**.
*   **Resultados**: Verás una explicación, tu código original y el código sugerido.
*   **Guardar Versiones**: Guarda el código original y/o sugerido como snapshots.

### 7. Analizar Proyecto Completo (Sección "Analizar Proyecto")

Analiza proyectos enteros.

*   **Usar Configuración LLM De**: Selecciona la fuente de configuración LLM.
*   **Pestañas**: "Subir Archivo (ZIP/JSON)" o "Desde Repositorio Git".
*   Haz clic en **"Analizar Proyecto"**.
*   *Nota: El análisis de Git es simulado. El análisis de ZIP/JSON proveerá resultados basados en la capacidad actual del modelo.*

### 8. AutoUpdate (Sección "AutoUpdate")

Permite que CodeAlchemist analice su propio código fuente.

*   **Usar Configuración LLM De**: Selecciona la fuente de configuración LLM (Global, Agente específico o Grupo de Trabajo).
*   **Preferencias de Análisis (Opcional)**: Guía a la IA (ej. "mejorar rendimiento", "revisar manejo de errores"). Si se usa un Grupo, este es el input principal.
*   Haz clic en **"Iniciar Auto-Análisis"**.
    *   Recopila su código fuente (excluyendo `node_modules`, etc.).
    *   Si no se usa un grupo, el código se divide en fragmentos. Se muestra una barra de progreso.
    *   Si se usa un grupo, la tarea se pasa al Orquestador.
*   **Resultados**: Título, áreas identificadas, sugerencias detalladas y evaluación general.
*   **Aplicar Sugerencias**: Para sugerencias con contenido de archivo:
    *   Haz clic en **"Aplicar Sugerencia"**. Confirma en el diálogo. El archivo **será modificado**.
*   **Descargar Código Fuente Completo**: Descarga un ZIP o JSON con el estado actual del código.
*   **Subir a Git**: Si configurado, sube el estado actual al repositorio Git.
*   **Manejo de Errores y Auto-Fix**:
    *   Errores se muestran y pueden copiarse.
    *   Botón **"Auto-Fix (Experimental)"** para que la IA proponga soluciones.
*   **Logs de Ejecución Detallados**: Ventana con logs, opciones para copiar, borrar y expandir/contraer.

### 9. Versiones Guardadas (Sección "Versiones Guardadas")

Gestiona snapshots de tu código.

*   Lista de versiones guardadas.
*   **Acciones**: Ver, Descargar, Eliminar.
*   **Comparar Versiones**: Selecciona A y B para ver diferencias.
*   **Eliminar Todas**.

### 10. Chat con IA (Sección "Chat con IA")

Conversa con un asistente IA.

*   **Usar Configuración LLM De**: Selecciona la fuente de configuración LLM.
*   Escribe tu mensaje y envía. Historial visible. Opción de borrar chat.

### 11. Gestión de Agentes IA (Sección "Agentes IA")

Crea y administra agentes IA personalizados.

*   Lista de agentes. Exportar/Importar todos.
*   **Crear Agente**: Nombre, descripción, mensaje de sistema, capacidades (acceso a código propio, ejecución, entorno virtual, lectura/escritura) y configuración LLM (global o personalizada).
*   **Acciones por Agente**: Probar (chat modal), Exportar (JSON), Editar, Eliminar.

### 12. Gestión de Grupos de Trabajo IA (Sección "Grupos de Trabajo IA")

Define equipos de agentes para tareas colaborativas.

*   Lista de grupos.
*   **Crear Grupo**: Nombre, descripción, tarea principal. Selecciona agentes participantes (el `OrquestadorFlujoAgentes` es automático y obligatorio).
*   **Acciones por Grupo**: Ejecutar (abre modal con log detallado de la ejecución del grupo), Editar, Eliminar.

## Flujo de Trabajo con IA

### Selección de Fuente de Configuración LLM

En la mayoría de las secciones que interactúan con un LLM, encontrarás el selector **"Usar Configuración LLM De:"**. Opciones:

1.  **Ajustes Globales**: Usa la configuración de la sección "Configuración".
2.  **Agente: [Nombre del Agente]**: Usa la configuración LLM del agente.
3.  **Grupo: [Nombre del Grupo]**: La tarea/prompt principal se pasa al Orquestador del Grupo. Este usa su configuración LLM y coordina a los demás agentes, cada uno con su propia configuración.

### Agentes y Grupos de Trabajo

*   **Agentes**: Entidades IA con rol, capacidades y configuración LLM.
*   **Grupos de Trabajo**: Equipos de agentes.
    *   El **OrquestadorFlujoAgentes** (Orquestador del Grupo) es obligatorio y central. Recibe y gestiona todas las respuestas. Decide el siguiente paso para un flujo coordinado.

## Estructura de Carpetas y Archivos Clave

*   `README.md`: Este archivo.
*   `package.json`: Define las dependencias del proyecto y los scripts (ej. `npm run dev`).
*   `next.config.ts`: Configuración específica de Next.js (ej. rutas de imágenes, manejo de errores de build).
*   `tsconfig.json`: Configuración del compilador de TypeScript.
*   `tailwind.config.ts`: Configuración de Tailwind CSS para los estilos.
*   `src/app/globals.css`: Estilos globales y variables de tema para ShadCN UI (colores, fuentes).
*   `src/app/layout.tsx`: El layout raíz de la aplicación, donde se define la estructura HTML base.
*   `src/app/(app)/layout.tsx`: Layout para las páginas autenticadas o principales de la aplicación, incluye la `AppSidebar`.
*   `src/app/(app)/[nombre_seccion]/page.tsx`: Componentes React que definen la interfaz de usuario para cada sección principal (ej. `dashboard`, `analyze`, `autoupdate`).
*   `src/app/(app)/[nombre_seccion]/actions.ts`: Server Actions de Next.js que contienen la lógica del lado del servidor para las funcionalidades de cada sección (ej. llamadas a APIs LLM, manejo de archivos).
*   `src/components/ui/`: Componentes de UI reutilizables de ShadCN (Button, Card, Input, etc.).
*   `src/components/layout/`: Componentes estructurales de la UI (ej. `app-sidebar.tsx`).
*   `src/components/[nombre_componente_especifico].tsx`: Componentes React personalizados y reutilizables para funcionalidades específicas (ej. `settings-form.tsx`, `version-snapshots.tsx`).
*   `src/services/groq.ts`: Módulo central para interactuar con las APIs de los LLM. Aunque el nombre es "groq", ahora es genérico y maneja diferentes proveedores. Contiene funciones para `analyzeCode`, `generateCodeFromPrompt`, `analyzeProjectSourceChunk`, etc.
*   `src/config/llm-config.ts`: Define los proveedores LLM soportados (Groq, OpenAI, Anthropic, LM Studio, Ollama, Google Gemini), sus URLs base, si requieren API Key, y los modelos disponibles para cada uno con sus características (TPM, tokens). También define claves para `localStorage`.
*   `src/config/agent-config.ts`: Define constantes relacionadas con agentes y grupos, como las claves de `localStorage` y nombres de agentes especiales como `ORCHESTRATOR_AGENT_NAME`.
*   `src/types/`: Contiene definiciones de tipos TypeScript (ej. `agent.ts` para `AgentConfig` y `WorkgroupConfig`, `snapshot.ts` para `CodeSnapshot`).
*   `src/lib/llm-utils.ts`: Funciones de utilidad relacionadas con la configuración LLM, como `resolveLlmOptionsForSource` que determina qué configuración LLM usar basado en la selección del usuario (global, agente, o grupo).
*   `src/hooks/`: Hooks personalizados de React (ej. `use-toast.ts` para notificaciones, `use-mobile.ts` para detectar dispositivos móviles).

## Manejo de Errores

*   **Errores de API LLM**:
    *   Límites de Tokens/TPM (ej. 429, 413): Reintentos con backoff exponencial para 429. Fragmentación de código en AutoUpdate para 413.
    *   Timeouts: Configurados para evitar bloqueos.
*   **Copia de Errores**: Botón para copiar mensajes de error.
*   **Auto-Fix (Experimental)**:
    *   En AutoUpdate y Subida a Git, si ocurre un error, el botón "Auto-Fix" permite a la IA analizar el error y proponer una solución.

## Notas Importantes y Consideraciones

*   **Sugerencias de IA**: Siempre revisa, comprende y prueba exhaustivamente los cambios propuestos por la IA.
*   **API Limits & Timeouts**: El uso intensivo puede llevar a errores temporales.
    *   **Fragmentación en AutoUpdate**: Para análisis del propio código, se divide en fragmentos (`MAX_CHARS_PER_CHUNK` ~3500 chars) con retraso entre ellos (`INTER_CHUNK_PROCESSING_DELAY_MS` ~5 segs).
*   **Seguridad**:
    *   "Aplicar Sugerencia" en AutoUpdate modifica archivos directamente. Usa con precaución.
    *   Capacidades de Agente (ejecución, lectura/escritura) son peligrosas. Habilita solo en entornos seguros.
*   **Costes de API**: El uso de APIs LLM puede incurrir en costes.
*   **Privacidad**: El código se procesa en servidores del proveedor LLM (o localmente). Revisa sus políticas.
*   **Estado de Funcionalidades**: Algunas funciones (análisis detallado de Git, aplicación automática de sugerencias de grupo) pueden ser simuladas o estar en desarrollo.

## Pruebas Unitarias (Conceptual)

Aunque no se incluye código de pruebas en este entregable, un proyecto robusto como CodeAlchemist requeriría pruebas unitarias y de integración. Algunas áreas clave para probar serían:

*   **Validación de Carga de Proyectos (Refactorizar Proyecto)**:
    *   Asegurar que se aceptan ZIP, JSON y archivos de texto válidos.
    *   Rechazar tipos de archivo no soportados.
    *   Manejar límites de tamaño de archivo.
*   **Flujo de Refactorización (Autogen/Agentes)**:
    *   Verificar que el Orquestador recibe la tarea y la delega correctamente al agente "Refactorizador".
    *   Asegurar que el "Refactorizador" procesa el código y genera sugerencias en el formato esperado.
    *   Probar el flujo cuando un grupo de trabajo es seleccionado (Orquestador -> Refactorizador -> Validador -> Orquestador).
    *   Verificar el manejo de errores si un agente falla.
*   **Resolución de Configuración LLM (`llm-utils.ts`)**:
    *   Probar `resolveLlmOptionsForSource` con diferentes escenarios (global, agente específico, agente con config "default", grupo de trabajo).
    *   Asegurar que se seleccionan las claves API y modelos correctos.
*   **Manejo de Errores Críticos**:
    *   Simular respuestas de error de APIs LLM (ej. clave inválida, modelo no encontrado, rate limits) y verificar que la UI los muestra correctamente y que la funcionalidad de "Auto-Fix" se activa.
    *   Probar errores de conexión Git.
*   **Fragmentación de Código (AutoUpdate)**:
    *   Verificar que `getApplicationSourceBundle` y `handleAutoAnalyzeAppSource` dividen correctamente el código en fragmentos según `MAX_CHARS_PER_CHUNK`.
*   **Aplicación de Sugerencias (AutoUpdate)**:
    *   Probar que `applySuggestedChange` modifica correctamente los archivos en el sistema de archivos (en un entorno de prueba controlado).

## Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un *issue* para discutir cambios importantes o envía un *Pull Request*.

## Licencia

(Opcional: Especifica una licencia, por ejemplo, MIT License)

---

¡Gracias por usar CodeAlchemist! Esperamos que te ayude a mejorar tu código y tu flujo de trabajo de desarrollo.
