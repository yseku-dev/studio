
# CodeAlchemist

CodeAlchemist es una plataforma de desarrollo asistido por inteligencia artificial (IA) diseñada para optimizar y agilizar el ciclo de vida del desarrollo de software. Ofrece herramientas para la generación y análisis de código, refactorización asistida, gestión de versiones, ejecución de grupos de trabajo IA y análisis de proyectos completos, todo ello potenciado por diversos modelos de IA a través de sus respectivas APIs o puntos de conexión locales.

## Características Principales

CodeAlchemist ofrece un conjunto robusto de características diseñadas para asistir en diversas etapas del desarrollo de software:

*   **Generación de Código**: Permite a los usuarios crear fragmentos de código a partir de descripciones en lenguaje natural. Esta funcionalidad utiliza la configuración de IA seleccionada, que puede ser la configuración global de la aplicación, la configuración específica de un agente IA, o la de un grupo de trabajo IA. El proceso implica:
    *   Un selector **"Usar Configuración LLM De"** para elegir la fuente de IA.
    *   Un área de texto **"Describe tu necesidad"** para que el usuario ingrese el prompt.
    *   Un botón **"Generar Código"** para iniciar el proceso.
    *   La sección de **Resultados** muestra una explicación del código que se va a generar, seguida del fragmento de código en sí. Dispone de un botón para copiar el código.
    *   Si se utilizó un grupo de trabajo, se muestra un **Log Detallado del Grupo** con las interacciones entre agentes.

*   **Generación de Proyectos**: Facilita la creación de una estructura base para nuevos proyectos (archivos y carpetas) a partir de especificaciones del usuario. Utiliza la configuración de IA seleccionada (global, agente específico o grupo de trabajo).
    *   Selector **"Usar Configuración LLM De"**.
    *   Área de texto **"Describe tu proyecto"** para el prompt.
    *   Botón **"Generar Proyecto"**. Al pulsarlo, se abre un diálogo de **"Confirmar Generación"** donde el usuario puede revisar y, si es necesario, redefinir o ajustar su prompt antes de continuar.
    *   En los **Resultados**, se muestra un **"Nombre Sugerido"** para el proyecto y **"Notas de la IA"** sobre la estructura o próximos pasos.
    *   Se presenta una lista de **"Archivos Generados"** con sus rutas y contenido. Cada archivo puede expandirse para ver su código.
    *   Un botón **"Descargar Proyecto (ZIP)"** permite obtener todos los archivos generados.
    *   Si se utilizó un grupo de trabajo, se muestra un **Log Detallado del Grupo**.

*   **Refactorizar Proyecto**: Permite analizar un proyecto existente para obtener sugerencias de refactorización generadas por la IA.
    *   Selector **"Usar Configuración LLM De"**:
        *   **Ajustes Globales**: Utiliza la configuración general.
        *   **Agente**: Permite seleccionar un agente específico (se recomienda uno especializado en refactorización, como `RefactorizadorCodigoExperto`).
        *   **Grupo**: Permite seleccionar un grupo de trabajo que incluya agentes relevantes (como `RefactorizadorCodigoExperto` y el `OrquestadorFlujoAgentes`).
    *   **Fuente del Proyecto**:
        *   **Subir Archivo**: Admite archivos `.zip` (código fuente completo), `.json` (representación del proyecto), o archivos de texto individuales (ej. `.py`, `.js`).
        *   **URL de Git**: Permite introducir la URL HTTPS de un repositorio Git público para su análisis (esta función está en desarrollo activo para la clonación directa).
    *   **Parámetros de Refactorización**:
        *   **Metas (opcional)**: Campo para describir objetivos específicos (ej. "Mejorar rendimiento UI").
        *   **Prioridad General (opcional)**: Selector para un enfoque general (ej. "Priorizar Seguridad", "Priorizar Legibilidad").
    *   Botón **"Analizar para Refactorizar"**.
    *   **Resultados y Sugerencias**: Se muestra una lista de sugerencias, cada una con:
        *   **Área**: Archivo o componente afectado.
        *   **Descripción**: Explicación de la mejora.
        *   **Prioridad**: Alta, Media o Baja.
        *   **Snippet Sugerido (opcional)**: Fragmento de código original y modificado.
    *   **Acciones por Sugerencia**:
        *   **Aplicar (Simulado)**: Marca la sugerencia como aplicada (no modifica archivos externos).
        *   **Ver Diff (Simulado)**: Muestra una comparación simulada.
        *   **Descartar**: Omite la sugerencia.
    *   **Acción Masiva**: Botón **"Aplicar Todas las Sugerencias (Simulado)"**.
    *   **Logs de Ejecución**: Muestra un log detallado del proceso, especialmente si se usó un grupo.

*   **Análisis de Código Inteligente**: Permite obtener análisis detallados y sugerencias de mejora para fragmentos de código individuales o archivos.
    *   Selector **"Usar Configuración LLM De"**.
    *   **Fuente del Código**:
        *   **Subir un archivo de código (opcional)**: Botón para cargar un archivo.
        *   **URL de Archivo Git (opcional)**: Campo para pegar la URL directa a un archivo "raw" en un repositorio Git.
        *   Área de texto principal para pegar el código directamente.
    *   Botón **"Analizar Código"**.
    *   **Resultados**: Muestra una **Explicación** del código original, el **Código Original** y el **Código Sugerido** con mejoras.
    *   Botones **"Guardar Original"** y **"Guardar Sugerido"** para crear snapshots en "Versiones Guardadas".

*   **Análisis de Proyecto Completo**: Permite un análisis holístico de proyectos enteros.
    *   Selector **"Usar Configuración LLM De"**.
    *   **Fuente del Proyecto**:
        *   **Subir Archivo (ZIP/JSON)**: Botón para seleccionar un archivo `.zip` o `.json`.
        *   **URL de Git**: Campo para introducir la URL HTTPS de un repositorio Git público.
    *   Botón **"Analizar Proyecto"**.
    *   Los resultados se presentan con un resumen general y áreas destacadas.
    *   Se muestra un **Log Detallado** del proceso o del grupo (si se usó).

*   **AutoUpdate (Análisis del Propio Código)**: Permite que CodeAlchemist analice su propio código fuente.
    *   Selector **"Usar Configuración LLM De"**.
    *   **Fuente del Código para Auto-Análisis**:
        *   **Local**: Analiza el código fuente actual de la aplicación.
        *   **URL del Repositorio Git (Opcional)**: Campo para introducir la URL de un repositorio Git de CodeAlchemist para analizar esa versión.
    *   **Preferencias de Análisis (Opcional)**: Campo para guiar a la IA con objetivos específicos.
    *   Botón **"Iniciar Auto-Análisis"**.
    *   Muestra una **Barra de Progreso** durante el análisis de fragmentos.
    *   **Resultados**: Muestra un **Título del Análisis**, **Áreas Identificadas**, **Sugerencias Detalladas** (con área, sugerencia, prioridad y, si aplica, el contenido completo del archivo sugerido) y una **Evaluación General**.
    *   **Aplicar Sugerencias**: Para cada sugerencia de cambio de código:
        *   Botón **"Aplicar Sugerencia"**. Abre un diálogo de confirmación con una vista previa del cambio (diff simulado). Al confirmar, el archivo físico **SERÁ MODIFICADO**.
    *   **Descargar Código Fuente Completo**:
        *   Botón **"Descargar Código (ZIP)"**: Descarga un ZIP del estado actual del código fuente.
        *   Botón **"Descargar Código (JSON)"**: Descarga una representación JSON del código fuente.
    *   **Subir a Git**: Botón para hacer commit y push del estado actual del código al repositorio configurado. Solicita un mensaje de commit.
    *   **Manejo de Errores y Auto-Fix**:
        *   Los errores se muestran claramente.
        *   Botón **"Copiar Error"**.
        *   Botón **"Auto-Fix (Experimental)"**: Utiliza la IA para analizar el error y proponer soluciones en un diálogo modal.
    *   **Logs de Ejecución Detallados**: Una ventana en la parte inferior de la sección muestra logs detallados con botones para **Copiar Logs**, **Borrar Logs** y **Expandir/Contraer**.

*   **Versiones Guardadas (Snapshots)**: Gestiona instantáneas de código.
    *   Muestra una lista de versiones guardadas con nombre y fecha.
    *   **Acciones por Versión**:
        *   **Ver**: Abre un diálogo modal con el contenido del código.
        *   **Descargar**: Descarga el código como archivo de texto.
        *   **Eliminar**: Borra la versión (con confirmación).
        *   **Seleccionar para Comparar (A/B)**: Marca la versión para comparación.
    *   **Comparar Versiones**: Si se seleccionan dos versiones (A y B), se habilita la comparación mostrando las diferencias en un diálogo modal.
    *   Botón **"Guardar Código Actual de CodeAlchemist"**: Toma un snapshot del código fuente actual de la aplicación.
    *   Botón **"Eliminar Todas"**: Borra todas las versiones guardadas (con confirmación).

*   **Chat con IA**: Permite interactuar con un asistente IA.
    *   Selector **"Usar Configuración LLM De"**.
    *   Área de texto para escribir el mensaje. Se envía con Enter o botón.
    *   El historial de la conversación se muestra en la ventana principal.
    *   Botón **"Borrar el Chat"** para limpiar el historial.
    *   Manejo de errores con opciones para copiar o intentar "Auto-Fix".

*   **Gestión de Agentes IA**: Permite crear y configurar agentes IA individuales.
    *   Muestra una lista de agentes creados.
    *   Botones **"Importar Agentes"** (JSON) y **"Exportar Todos los Agentes"** (JSON).
    *   **Formulario "Crear/Editar Agente"**:
        *   **Nombre**: Nombre único y descriptivo.
        *   **Descripción**: Breve explicación del propósito.
        *   **Mensaje de Sistema (Prompt)**: Prompt base que define el rol e instrucciones.
        *   **Capacidades del Agente**: Interruptores para:
            *   **Acceso a Código Propio**.
            *   **Capacidad de Ejecución** (con advertencia de peligrosidad).
            *   **Capacidad de Entorno Virtual**.
            *   **Capacidad Lectura/Escritura** (con advertencia de peligrosidad).
        *   **Configuración LLM del Agente**:
            *   **Usar Configuración Global**.
            *   **Configuración Personalizada**: Permite seleccionar Proveedor LLM, Modelo, y opcionalmente sobrescribir Clave API y URL de API.
    *   Se destaca la importancia del agente `OrquestadorFlujoAgentes` y su configuración sugerida.
    *   **Acciones por Agente (en la lista)**:
        *   **Probar**: Abre una ventana de chat modal para interactuar con el agente.
        *   **Exportar**: Descarga la configuración del agente (JSON).
        *   **Editar**: Abre el formulario para modificar. El nombre del `OrquestadorFlujoAgentes` no es editable.
        *   **Eliminar**: Borra el agente (con confirmación). El `OrquestadorFlujoAgentes` no se puede eliminar.

*   **Gestión de Grupos de Trabajo IA**: Define equipos de agentes para colaborar en tareas.
    *   Muestra una lista de grupos creados.
    *   **Formulario "Crear/Editar Grupo"**:
        *   **Nombre**: Nombre único.
        *   **Descripción**: Breve explicación.
        *   **Tarea Principal del Grupo**: Prompt detallado que describe el objetivo general.
        *   **Seleccionar Agentes Participantes**: Elige agentes. El `OrquestadorFlujoAgentes` es implícito o seleccionable. Se requiere al menos un agente además del Orquestador.
    *   **Acciones por Grupo (en la lista)**:
        *   **Ejecutar**: Abre una ventana modal para la **"Ejecución del Grupo de Trabajo"**. Muestra la Tarea Principal y un **Log de Ejecución Detallado** en tiempo real (turnos, decisiones del orquestador, respuestas de agentes, errores). Permite **Copiar los Logs** o **Detener la Ejecución**.
        *   **Editar**: Abre el formulario para modificar.
        *   **Eliminar**: Borra el grupo (con confirmación).

*   **Interfaz de Usuario Intuitiva**:
    *   Construida con tecnologías web modernas.
    *   La **Barra Lateral** es colapsable para maximizar el espacio de trabajo, con un botón **"Ocultar"/"Mostrar"**.
    *   En dispositivos móviles, un menú tipo "hamburguesa" controla la visibilidad de la barra lateral.
    *   Utiliza una paleta de colores diseñada para ser clara, legible y profesional.

*   **Configuración Personalizada**:
    *   **LLM**:
        *   **Proveedor LLM**: Selector para el servicio de IA (Groq, Google Gemini, OpenAI, Anthropic, LM Studio, Ollama).
        *   **URL del Endpoint de API**: Campo para la URL base de la API, especialmente para modelos locales o proxies.
        *   **Clave API**: Campo para la clave API del proveedor seleccionado (se guarda en el almacenamiento local del navegador).
        *   **Nombre del Modelo**: Selector con modelos disponibles para el proveedor, ordenados por capacidad/popularidad.
        *   Botón **"Probar Conexión (Proveedor LLM)"** para verificar la comunicación.
    *   **Git**:
        *   **URL del Repositorio Git**: Campo para la URL HTTPS del repositorio remoto.
        *   **Nombre de Usuario Git**.
        *   **Email de Git**.
        *   **Token de Acceso Personal (PAT)**.
        *   Botón **"Probar Conexión Git"** para verificar la autenticación.
    *   **Modo Depuración**:
        *   Interruptor para activar/desactivar un panel de logs detallados fijo en la parte inferior de la pantalla. Este panel es expandible/contraíble y permite copiar o borrar los logs.
    *   Botón **"Guardar Configuración"** para almacenar todos estos ajustes.

*   **Manejo de Errores Mejorado**:
    *   Los errores (de IA, Git, etc.) se muestran claramente.
    *   Botón **"Copiar Error"** disponible en la mayoría de los errores.
    *   Botón **"Auto-Fix (Experimental)"**: En secciones como "AutoUpdate" y "Chat con IA", permite que la IA analice el mensaje de error y proponga soluciones.
    *   Gestión de errores comunes de API LLM (límites de tokens/TPM, timeouts) con reintentos y fragmentación de datos.

## Guía de Inicio

### Requisitos Previos

*   Un entorno de ejecución para aplicaciones web modernas (navegador web actualizado).
*   Conexión a internet para acceder a los proveedores de IA basados en la nube y, opcionalmente, a repositorios Git remotos.

### Instalación y Primer Uso

1.  **Acceder a la Aplicación**: Abre la URL de CodeAlchemist en tu navegador web.
2.  **Configuración Inicial (Muy Recomendado)**:
    *   Navega a la sección **"Configuración"** (icono de engranaje en la barra lateral).
    *   **Configura tu Proveedor LLM**: Selecciona el proveedor de IA que deseas usar, introduce tu clave API si es necesaria (se guarda localmente en tu navegador), elige un modelo y, si usas un proveedor local como LM Studio u Ollama, especifica la URL de la API.
    *   Haz clic en **"Probar Conexión (Proveedor LLM)"** para asegurar que todo funciona.
    *   **(Opcional) Configura Git**: Si planeas usar la funcionalidad de "AutoUpdate" para subir cambios a un repositorio, completa los detalles de Git y prueba la conexión.
    *   Haz clic en **"Guardar Configuración"**.

## Tutorial de Uso Detallado

A continuación, se describe cómo utilizar cada sección principal de CodeAlchemist.

### 1. Navegación y Barra Lateral

*   La interfaz principal cuenta con una **Barra Lateral** a la izquierda que da acceso a todas las secciones.
    *   **Panel de Control**: Página de inicio con una visión general. (Icono: `LayoutDashboard`)
    *   **Generar Código**: Para crear fragmentos de código. (Icono: `CodeXml`)
    *   **Generar Proyecto**: Para iniciar nuevas estructuras de proyecto. (Icono: `FolderPlus`)
    *   **Refactorizar Proyecto**: Para analizar y obtener sugerencias de refactorización de proyectos existentes. (Icono: `GitPullRequestDraft`)
    *   **Analizar Código**: Para análisis de fragmentos o archivos individuales. (Icono: `ScanLine`)
    *   **Analizar Proyecto**: Para un análisis completo de un proyecto. (Icono: `FolderSearch`)
    *   **AutoUpdate**: Para que CodeAlchemist se analice a sí mismo. (Icono: `Sparkles`)
    *   **Versiones Guardadas**: Para gestionar snapshots de código. (Icono: `GitCompareArrows`)
    *   **Chat con IA**: Para conversar con un asistente IA. (Icono: `MessageCircle`)
    *   **Agentes IA**: Para crear y gestionar agentes individuales. (Icono: `Users2`)
    *   **Grupos de Trabajo IA**: Para definir y ejecutar equipos de agentes. (Icono: `Workflow`)
    *   **Configuración**: Para ajustar parámetros de la aplicación. (Icono: `Settings`)
*   La barra lateral puede **Ocultarse/Mostrarse** haciendo clic en el botón respectivo en la parte inferior de la misma (en vista de escritorio), que muestra los iconos `ChevronsLeft` (Ocultar) o `ChevronsRight` (Mostrar). Esto es útil para maximizar el espacio de trabajo.
*   En dispositivos móviles, un icono de menú (`Menu`) en la esquina superior izquierda abrirá la barra lateral como un panel deslizable.

### 2. Configuración (Sección "Configuración")

Es crucial configurar correctamente la aplicación. Accede mediante el icono `Settings`.

*   **Configuración del Proveedor LLM**:
    *   **Proveedor LLM**: Un selector para elegir el servicio de IA (Groq, Google Gemini, OpenAI, Anthropic, LM Studio, Ollama).
    *   **URL del Endpoint de API**: Un campo de texto. Para proveedores locales (LM Studio, Ollama) o proxies, introduce la URL base (ej. `http://localhost:1234/v1`). Para proveedores en la nube, se rellena automáticamente pero puede sobrescribirse.
    *   **Clave API**: Un campo de texto (tipo contraseña) para introducir tu clave API si el proveedor la requiere. Se guarda de forma segura en el almacenamiento local de tu navegador.
    *   **Nombre del Modelo**: Un selector que se actualiza según el proveedor. Lista los modelos disponibles.
    *   Botón **"Probar Conexión (Proveedor LLM)"**: Verifica la comunicación con el servicio IA usando la configuración actual. Muestra un mensaje de éxito o error.
*   **Configuración de Git**:
    *   **URL del Repositorio Git**: Campo para la URL HTTPS de tu repositorio.
    *   **Nombre de Usuario Git**: Campo para tu nombre de usuario Git.
    *   **Email de Git**: Campo para el email asociado a tus commits.
    *   **Token de Acceso Personal (PAT)**: Campo de texto (tipo contraseña) para tu PAT de Git.
    *   Botón **"Probar Conexión Git"**: Verifica la autenticación con el repositorio remoto. Muestra un mensaje de éxito o error.
*   **Modo Depuración**:
    *   Un interruptor (checkbox o switch) para **"Activar modo Debug"**. Al activarlo, aparece un panel de logs detallados fijo en la parte inferior de la pantalla. Este panel es expandible/contraíble mediante botones (`ChevronUp`/`ChevronDown`) y tiene opciones para **Copiar Logs** (`Copy`) y **Borrar Logs** (`Trash2`).
*   Botón **"Guardar Configuración"**: Guarda todos los ajustes en el almacenamiento local del navegador.

### 3. Generar Código (Sección "Generar Código")

Accede mediante el icono `CodeXml`.

*   **Usar Configuración LLM De**: Un selector para elegir la fuente de IA:
    *   **Ajustes Globales**: Usa la configuración de la sección "Configuración".
    *   **Agente: [Nombre del Agente]**: Usa la configuración específica de un agente creado.
    *   **Grupo: [Nombre del Grupo]**: La tarea se pasa al Orquestador del grupo seleccionado.
*   **Describe tu necesidad**: Área de texto para el prompt detallado.
*   Botón **"Generar Código"**: Inicia la generación. Se puede pedir confirmación.
*   **Resultados**:
    *   Muestra una explicación del código y luego el fragmento de código.
    *   Botón para copiar el código generado.
    *   Si se usó un grupo, se muestra un **Log Detallado del Grupo** al final de la página.

### 4. Generar Proyecto (Sección "Generar Proyecto")

Accede mediante el icono `FolderPlus`.

*   **Usar Configuración LLM De**: Selector (Global, Agente, Grupo).
*   **Describe tu proyecto**: Área de texto para el prompt detallado.
*   Botón **"Generar Proyecto"**: Abre un diálogo de **"Confirmar Generación"**. En este diálogo:
    *   Se muestra el prompt actual.
    *   Un área de texto permite **"Redefinir Prompt (opcional)"** para ajustar la descripción antes de proceder.
    *   Botones para **"Cancelar"** o **"Sí, Generar Proyecto"**.
*   **Resultados**:
    *   **Nombre Sugerido** para el proyecto.
    *   **Notas de la IA** sobre la estructura.
    *   Lista de **Archivos Generados** (ruta y contenido expandible).
    *   Botón **"Descargar Proyecto (ZIP)"**.
    *   Si se usó un grupo, se muestra un **Log Detallado del Grupo**.

### 5. Refactorizar Proyecto (Sección "Refactorizar Proyecto")

Accede mediante el icono `GitPullRequestDraft`.

*   **Usar Configuración LLM De**: Selector (Global, Agente, Grupo). Se recomienda un agente como `RefactorizadorCodigoExperto` o un grupo que lo incluya.
*   **Fuente del Proyecto**:
    *   **Subir Archivo**: Botón para subir `.zip`, `.json`, o archivos de texto.
    *   **URL de Git**: Campo para la URL HTTPS de un repositorio Git público. La IA intentará obtener el contenido.
*   **Parámetros de Refactorización**:
    *   **Metas (opcional)**: Campo para describir objetivos (ej. "Mejorar rendimiento UI").
    *   **Prioridad General (opcional)**: Selector (Seguridad, Legibilidad, Rendimiento, Estandarizar, Reducir Complejidad).
*   Botón **"Analizar para Refactorizar"**.
*   **Resultados y Sugerencias**: Lista de sugerencias con:
    *   **Área**: Archivo/componente afectado.
    *   **Descripción**: Explicación.
    *   **Prioridad**: Alta, Media, Baja.
    *   **Snippet Sugerido (opcional)**.
    *   **Acciones por Sugerencia**:
        *   Botón **Aplicar (Simulado)**.
        *   Botón **Ver Diff (Simulado)**.
        *   Botón **Descartar**.
*   **Acción Masiva**: Botón **"Aplicar Todas las Sugerencias (Simulado)"**.
*   **Logs de Ejecución**: Muestra un log detallado, especialmente si se usó un grupo.

### 6. Analizar Código (Sección "Analizar Código")

Accede mediante el icono `ScanLine`.

*   **Usar Configuración LLM De**: Selector (Global, Agente, Grupo).
*   **Fuente del Código**:
    *   Botón **"Sube un archivo de código (opcional)"**.
    *   Campo **"URL de Archivo Git (opcional)"** para URL "raw".
    *   Área de texto principal para pegar código.
*   Botón **"Analizar Código"**.
*   **Resultados**:
    *   **Explicación** del código.
    *   **Código Original**.
    *   **Código Sugerido**.
*   Botones **"Guardar Original"** y **"Guardar Sugerido"** para crear snapshots.

### 7. Analizar Proyecto Completo (Sección "Analizar Proyecto")

Accede mediante el icono `FolderSearch`.

*   **Usar Configuración LLM De**: Selector (Global, Agente, Grupo).
*   **Fuente del Proyecto**:
    *   Botón **"Subir Archivo (ZIP/JSON)"**.
    *   Campo **"URL de Git"** para URL HTTPS de repositorio público. La IA intentará obtener el contenido.
*   Botón **"Analizar Proyecto"**.
*   Resultados y log similar a "Refactorizar Proyecto".

### 8. AutoUpdate (Sección "AutoUpdate")

Accede mediante el icono `Sparkles`.

*   **Usar Configuración LLM De**: Selector. Por defecto, podría usar el agente `RefactorizadorCodigoExperto` o un grupo configurado para ello.
*   **Fuente del Código para Auto-Análisis**:
    *   **Local** (por defecto): Analiza el código fuente actual de CodeAlchemist.
    *   **URL del Repositorio Git (Opcional)**: Campo para analizar una versión específica de CodeAlchemist desde Git. La IA intentará obtener el contenido.
*   **Preferencias de Análisis (Opcional)**: Campo para guiar a la IA.
*   Botón **"Iniciar Auto-Análisis"**.
*   Muestra una **Barra de Progreso** (ej. "Procesando fragmento X de Y") si el análisis no es por grupo.
*   **Resultados**: Título, Áreas Identificadas, Sugerencias Detalladas (con contenido completo si aplica), Evaluación General.
*   **Aplicar Sugerencias**: Botón **"Aplicar Sugerencia"** por cada sugerencia con cambio de código. Abre diálogo de confirmación con diff simulado. **MODIFICA ARCHIVOS FÍSICOS**.
*   **Descargar Código Fuente Completo**:
    *   Botón **"Descargar Código (ZIP)"**.
    *   Botón **"Descargar Código (JSON)"**.
*   **Subir a Git**: Botón para commit y push si Git está configurado. Pide mensaje de commit.
*   **Manejo de Errores y Auto-Fix**:
    *   Muestra errores. Botón **"Copiar Error"**.
    *   Botón **"Auto-Fix (Experimental)"** para que la IA analice el error y proponga soluciones.
*   **Logs de Ejecución Detallados**: Panel en la parte inferior con botones **Copiar Logs**, **Borrar Logs**, **Expandir/Contraer**.

### 9. Versiones Guardadas (Sección "Versiones Guardadas")

Accede mediante el icono `GitCompareArrows`.

*   Lista de versiones con nombre y fecha.
*   **Acciones por Versión**:
    *   **Ver**: Modal con el código.
    *   **Descargar**: Archivo de texto.
    *   **Eliminar**: Con confirmación.
    *   **Seleccionar para Comparar (A/B)**: Botones "A" y "B" para marcar versiones.
*   **Comparar Versiones**: Si se seleccionan A y B, se muestra un diálogo con las diferencias.
*   Botón **"Guardar Código Actual de CodeAlchemist"**: Crea un snapshot del código actual de la aplicación.
*   Botón **"Eliminar Todas"**: Con confirmación.

### 10. Chat con IA (Sección "Chat con IA")

Accede mediante el icono `MessageCircle`.

*   **Usar Configuración LLM De**: Selector (Global, Agente, Grupo).
*   Área de texto para mensajes.
*   Historial de conversación.
*   Botón **"Borrar el Chat"**.
*   Manejo de errores con Auto-Fix.

### 11. Gestión de Agentes IA (Sección "Agentes IA")

Accede mediante el icono `Users2`.

*   Lista de agentes.
*   Botones **"Importar Agentes"** (JSON) y **"Exportar Todos los Agentes"** (JSON).
*   **Formulario "Crear/Editar Agente"** (accesible mediante botón "Crear Agente" o "Editar" en un agente existente):
    *   **Nombre**: Campo de texto.
    *   **Descripción**: Campo de texto.
    *   **Mensaje de Sistema (Prompt)**: Área de texto.
    *   **Capacidades del Agente**:
        *   Checkbox **"Acceso a Código Propio"**.
        *   Checkbox **"Capacidad de Ejecución"** (con etiqueta de advertencia "Peligroso").
        *   Checkbox **"Capacidad de Entorno Virtual"**.
        *   Checkbox **"Capacidad Lectura/Escritura"** (con etiqueta de advertencia "Peligroso").
    *   **Configuración LLM del Agente**:
        *   Selector: **"Usar Configuración Global"** o **"Configuración Personalizada"**.
        *   Si "Personalizada": Selectores para **Proveedor LLM** y **Modelo**, campos opcionales para **Clave API** (tipo contraseña) y **URL de API**.
*   Agente especial **`OrquestadorFlujoAgentes`**:
    *   Descripción y Mensaje de Sistema sugeridos detallando su rol crítico.
    *   Se recomienda un modelo capaz de seguir instrucciones JSON estrictas.
*   **Acciones por Agente (en la lista)**:
    *   Botón **"Probar"**: Abre un chat modal.
    *   Botón **"Exportar"**: Descarga JSON del agente.
    *   Botón **"Editar"**.
    *   Botón **"Eliminar"** (deshabilitado para `OrquestadorFlujoAgentes`).

### 12. Gestión de Grupos de Trabajo IA (Sección "Grupos de Trabajo IA")

Accede mediante el icono `Workflow`.

*   Lista de grupos.
*   **Formulario "Crear/Editar Grupo"** (accesible mediante botón "Crear Grupo" o "Editar" en un grupo existente):
    *   **Nombre**: Campo de texto.
    *   **Descripción**: Campo de texto.
    *   **Tarea Principal del Grupo**: Área de texto para el prompt del objetivo del grupo.
    *   **Seleccionar Agentes Participantes**: Lista de checkboxes para elegir agentes. El `OrquestadorFlujoAgentes` se añade automáticamente y está marcado como obligatorio/implícito. Se requiere al menos un agente más.
*   **Acciones por Grupo (en la lista)**:
    *   Botón **"Ejecutar"**: Abre un diálogo modal **"Ejecución del Grupo de Trabajo"**.
        *   Muestra la Tarea Principal.
        *   Inicia la ejecución.
        *   Muestra un **Log de Ejecución Detallado** en tiempo real: turnos, decisiones del Orquestador, respuestas de agentes, mensajes de sistema, errores.
        *   Botón **"Copiar los Logs"**.
        *   Botón **"Detener la Ejecución"**.
    *   Botón **"Editar"**.
    *   Botón **"Eliminar"**.

## Flujo de Trabajo con IA

### Selección de Fuente de Configuración LLM

En la mayoría de las secciones que usan IA, el selector **"Usar Configuración LLM De:"** ofrece:

1.  **Ajustes Globales**: Usa la configuración de la sección "Configuración".
2.  **Agente: [Nombre del Agente]**: Usa la configuración LLM (global o personalizada) del agente.
3.  **Grupo: [Nombre del Grupo]**: La tarea se entrega al `OrquestadorFlujoAgentes` del grupo, que usa su propia configuración y coordina a los demás agentes (cada uno con su configuración).

### Agentes y Grupos de Trabajo

*   **Agentes**: Entidades IA individuales con rol (Mensaje de Sistema), capacidades y configuración LLM. Son especialistas.
*   **Grupos de Trabajo**: Equipos de agentes para tareas complejas.
    *   El **`OrquestadorFlujoAgentes`** es obligatorio. Gestiona el flujo, recibe todas las respuestas y decide el siguiente paso para asegurar coordinación y decisión centralizada. No realiza la tarea directamente; facilita que otros la completen. Si el usuario no guía, prioriza agentes relevantes.

## Manejo de Errores

*   **Errores de API LLM**:
    *   **Límites de Tokens/TPM**: Reintentos con backoff exponencial para errores 429. En "AutoUpdate", el código se fragmenta para evitar errores de payload grande.
    *   **Timeouts**: Tiempos de espera configurados para evitar bloqueos.
*   **Copia de Errores**: Botón para copiar mensajes de error.
*   **Auto-Fix (Experimental)**:
    *   Botón en "AutoUpdate" y "Chat con IA".
    *   Envía el error y contexto a la IA para análisis y sugerencias de solución.
    *   **Refuerzo Propuesto para el Sistema Auto-Fix (Concepto)**:
        *   **Priorización dinámica**: Módulo de análisis para clasificar errores por criticidad.
        *   **Aprendizaje automático predictivo**: Modelo entrenado para identificar patrones y sugerir soluciones proactivas.
        *   **Validación robusta**: Pruebas automatizadas antes de aplicar correcciones.
        *   **Sincronización con el Orquestador**: Canales de comunicación para asegurar coherencia.

## Notas Importantes y Consideraciones

*   **Sugerencias de IA**: Siempre revisa, comprende y prueba exhaustivamente cualquier cambio.
*   **Límites de API y Timeouts**: El uso intensivo puede alcanzar límites. En "AutoUpdate", la fragmentación y retrasos mitigan esto.
*   **Seguridad**: La función "Aplicar Sugerencia" en "AutoUpdate" modifica archivos. Las capacidades de agente como ejecución o lectura/escritura son peligrosas; úsalas con precaución.
*   **Costes de API**: Proveedores de IA en la nube pueden incurrir en costes. Modelos locales no.
*   **Privacidad**: El código y prompts se envían a proveedores en la nube. Revisa sus políticas. Considera modelos locales para privacidad.
*   **Estado de Funcionalidades**: Algunas pueden ser simuladas o estar en desarrollo temprano.

## Diseño (Aspectos Visuales)

CodeAlchemist utiliza una interfaz de usuario moderna y profesional, diseñada para ser intuitiva y agradable.

*   **Paleta de Colores Principal**:
    *   Fondo principal: Un gris claro (`#ECEFF1`, HSL: `210 17% 94%`), proporcionando un lienzo limpio y neutro.
    *   Texto principal: Un gris muy oscuro (`HSL: 233 30% 15%`) para máxima legibilidad sobre el fondo claro.
    *   Color primario (para acciones principales, botones destacados, elementos activos): Un azul oscuro intenso (`#1A237E`, HSL: `233 63% 30%`).
    *   Texto sobre color primario: Un gris claro (`HSL: 210 17% 85%`) para contraste.
    *   Color secundario (para bordes sutiles, fondos de input, elementos menos prominentes): Un gris ligeramente más oscuro que el fondo principal (`HSL: 210 17% 88%`).
    *   Texto sobre color secundario: Un gris oscuro (`HSL: 233 30% 20%`).
    *   Color de acento (para elementos de énfasis, enlaces, iconos informativos): Un verde azulado o teal (`#26A69A`, HSL: `174 60% 40%`).
    *   Texto sobre color de acento: Un gris oscuro (`HSL: 210 17% 15%`).
    *   Color destructivo (para errores, botones de eliminar, advertencias críticas): Un rojo vibrante (`HSL: 0 84.2% 60.2%`).
    *   Texto sobre color destructivo: Un gris muy oscuro, casi negro (`HSL: 0 0% 10%`).
    *   Fondo de tarjetas y popovers: Blanco (`#FFFFFF`, HSL: `0 0% 100%`) para destacar el contenido.
    *   Texto sobre tarjetas y popovers: El mismo gris muy oscuro del texto principal (`HSL: 233 30% 15%`).
    *   Colores Muted (para texto secundario, descripciones, fondos de elementos desactivados): Gris claro para fondos (`HSL: 210 17% 90%`) y un gris medio para texto (`HSL: 233 20% 40%`).
    *   Color de bordes generales: Un gris claro (`HSL: 210 17% 85%`).
    *   Color de fondo de campos de entrada: El mismo gris claro de los bordes (`HSL: 210 17% 85%`).
    *   Color de "anillo" de enfoque (focus ring): El color de acento teal (`HSL: 174 60% 40%`).
*   **Iconografía**:
    *   Se utiliza un conjunto de iconos vectoriales consistentes y limpios para representar las diferentes secciones y acciones, asegurando claridad y escalabilidad visual.
    *   El icono principal o logo de la aplicación es una representación estilizada de un matraz de alquimista (`FlaskConical`), simbolizando la transformación y experimentación con el código.
*   **Tipografía**:
    *   Se emplea una fuente sans-serif moderna y altamente legible para todo el texto de la interfaz, optimizando la experiencia de lectura y la claridad de la información.
*   **Diseño General**:
    *   La aplicación presenta un diseño moderno, con una clara jerarquía visual.
    *   Es responsiva, adaptándose a diferentes tamaños de pantalla para una experiencia óptima tanto en escritorio como en dispositivos móviles.
    *   Se utilizan esquinas redondeadas para botones, tarjetas y otros elementos, aportando una sensación de suavidad y modernidad.
    *   Se aplican sombras sutiles a elementos como tarjetas y diálogos modales para darles profundidad y destacarlos del fondo, creando una apariencia profesional y pulida.
    *   La disposición de los elementos está pensada para ser intuitiva, facilitando al usuario la navegación y el acceso a las funcionalidades.

---

¡Gracias por usar CodeAlchemist! Esperamos que esta plataforma te sea de gran utilidad.
