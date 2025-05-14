
# CodeAlchemist

CodeAlchemist es una plataforma de desarrollo asistido por inteligencia artificial (IA) diseñada para optimizar y agilizar el ciclo de vida del desarrollo de software. Ofrece herramientas para la generación y análisis de código, refactorización asistida, gestión de versiones, ejecución de grupos de trabajo IA y análisis de proyectos completos, todo ello potenciado por diversos modelos de IA.

**Idioma del Proyecto:** Todo el proyecto, incluyendo la interfaz de usuario, los mensajes, los comentarios en el código (donde aplique semánticamente) y la documentación (como este README), está desarrollado y presentado en **castellano**.

## Características Principales

CodeAlchemist ofrece un conjunto robusto de características diseñadas para asistir en diversas etapas del desarrollo de software:

*   **Generación de Código**: Permite a los usuarios crear fragmentos de código a partir de descripciones en lenguaje natural. Esta funcionalidad utiliza la configuración de IA seleccionada, que puede ser la configuración global de la aplicación, la configuración específica de un agente IA, o la de un grupo de trabajo IA. El proceso implica:
    *   Un selector **"Usar Configuración LLM De"** para elegir la fuente de IA (Global, Agente específico, o Grupo de Trabajo).
    *   Un área de texto **"Describe tu necesidad"** para que el usuario ingrese el prompt detallado sobre el código que desea generar.
    *   Un botón **"Generar Código"**. Al pulsarlo, y tras una posible confirmación donde se muestra el prompt y la configuración LLM a usar, se inicia el proceso de generación.
    *   La sección de **Resultados** muestra primero una **Explicación** (opcional, generada por la IA) del código que se va a generar, seguida del **Fragmento de Código** en sí. Dispone de un botón para **Copiar Código**.
    *   Si se utilizó un grupo de trabajo, se muestra un **Log Detallado del Grupo** al final de la página, el cual es expandible/contraíble y permite copiar su contenido.

*   **Generación de Proyectos**: Facilita la creación de una estructura base para nuevos proyectos (archivos y carpetas) a partir de especificaciones del usuario. Utiliza la configuración de IA seleccionada (global, agente específico o grupo de trabajo).
    *   Selector **"Usar Configuración LLM De"**.
    *   Área de texto **"Describe tu proyecto"** para el prompt detallado, indicando tipo de proyecto, tecnologías, estructura deseada, etc.
    *   Botón **"Generar Proyecto"**. Al pulsarlo, se abre un diálogo de **"Confirmar Generación"** donde el usuario puede revisar el prompt actual y, si es necesario, **Redefinir Prompt (opcional)** para ajustarlo antes de continuar. También se muestran botones para "Cancelar" o "Sí, Generar Proyecto".
    *   En los **Resultados**, se muestra un **"Nombre Sugerido"** para el proyecto (generado por la IA) y **"Notas de la IA"** con comentarios sobre la estructura generada o posibles próximos pasos.
    *   Se presenta una lista de **"Archivos Generados"** con sus rutas relativas y contenido. Cada archivo puede expandirse para ver su código directamente en la interfaz.
    *   Un botón **"Descargar Proyecto (ZIP)"** permite obtener todos los archivos generados empaquetados en un archivo ZIP.
    *   Si se utilizó un grupo de trabajo, se muestra un **Log Detallado del Grupo** al final de la página.

*   **Refactorizar Proyecto**: Permite analizar un proyecto existente para obtener sugerencias de refactorización generadas por la IA.
    *   Selector **"Usar Configuración LLM De"**:
        *   **Ajustes Globales**: Utiliza la configuración general de la aplicación.
        *   **Agente**: Permite seleccionar un agente específico. Se recomienda uno especializado en refactorización, como `RefactorizadorCodigoExperto` (que se crea por defecto).
        *   **Grupo**: Permite seleccionar un grupo de trabajo que incluya agentes relevantes (como `RefactorizadorCodigoExperto` y el `OrquestadorFlujoAgentes`). Esto permite un análisis más colaborativo y profundo.
    *   **Fuente del Proyecto**:
        *   **Subir Archivo**: Admite archivos `.zip` (código fuente completo del proyecto), `.json` (una representación estructurada del proyecto, si se tiene), o archivos de texto individuales (ej. `.py`, `.js`, `.java`). Se valida el tipo y tamaño del archivo.
        *   **URL de Git**: Permite introducir la URL HTTPS de un repositorio Git público. La IA (o un agente con capacidad de acceso a Git) intentará obtener el contenido del repositorio para su análisis.
    *   **Parámetros de Refactorización**:
        *   **Metas (opcional)**: Campo de texto para describir objetivos específicos de la refactorización (ej. "Mejorar rendimiento de la UI", "Simplificar la lógica de negocio en el módulo X", "Asegurar cumplimiento de estándares de codificación Y").
        *   **Prioridad General (opcional)**: Selector para un enfoque general de la refactorización (ej. "Priorizar Seguridad", "Priorizar Legibilidad", "Priorizar Rendimiento", "Estandarizar Código", "Reducir Complejidad").
    *   Botón **"Analizar para Refactorizar"**.
    *   **Resultados y Sugerencias**: Se muestra una lista de sugerencias, cada una con:
        *   **Área**: Archivo o componente específico afectado por la sugerencia.
        *   **Descripción**: Explicación detallada de la mejora propuesta y por qué es beneficiosa.
        *   **Prioridad**: Clasificación de la sugerencia (Alta, Media o Baja).
        *   **Snippet Sugerido (opcional)**: Si la sugerencia implica un cambio de código concreto y pequeño, se muestra un fragmento del código original y el modificado para ilustrar el cambio.
    *   **Acciones por Sugerencia**:
        *   **Aplicar (Simulado)**: Marca la sugerencia como aplicada en la interfaz (no modifica archivos externos en esta sección, solo simula el estado).
        *   **Ver Diff (Simulado)**: Muestra una comparación visual (simulada) entre el fragmento original y el sugerido.
        *   **Descartar**: Omite la sugerencia y la marca como descartada en la interfaz.
    *   **Acción Masiva**: Botón **"Aplicar Todas las Sugerencias (Simulado)"** para marcar todas las sugerencias pendientes como aplicadas.
    *   **Logs de Ejecución**: Si se utilizó un grupo de trabajo para el análisis, se muestra un log detallado de las interacciones entre agentes y las decisiones del orquestador.

*   **Análisis de Código Inteligente**: Permite obtener análisis detallados y sugerencias de mejora para fragmentos de código individuales o archivos.
    *   Selector **"Usar Configuración LLM De"** (Global, Agente, Grupo).
    *   **Fuente del Código**:
        *   **Subir un archivo de código (opcional)**: Botón para cargar un archivo de código fuente individual.
        *   **URL de Archivo Git (opcional)**: Campo para pegar la URL directa a un archivo "raw" en un repositorio Git (ej: un enlace de GitHub que muestre el contenido crudo del archivo). La aplicación intentará obtener el contenido de esta URL.
        *   Área de texto principal para pegar el código directamente.
    *   Botón **"Analizar Código"**.
    *   **Resultados**:
        *   **Explicación**: Una descripción en lenguaje natural del código original, generada por la IA.
        *   **Código Original**: Muestra el código que se analizó.
        *   **Código Sugerido**: Muestra la versión del código con las mejoras propuestas por la IA.
    *   Botones **"Guardar Original"** y **"Guardar Sugerido"** para crear snapshots del código original y del sugerido, respectivamente, en la sección "Versiones Guardadas".

*   **Análisis de Proyecto Completo**: Permite un análisis holístico de proyectos enteros, similar a "Refactorizar Proyecto" pero con un enfoque más amplio en la evaluación general.
    *   Selector **"Usar Configuración LLM De"** (Global, Agente, Grupo).
    *   **Fuente del Proyecto**:
        *   **Subir Archivo (ZIP/JSON)**: Botón para seleccionar un archivo `.zip` (proyecto completo) o `.json` (representación del proyecto).
        *   **URL de Git**: Campo para introducir la URL HTTPS de un repositorio Git público. La IA o un agente con capacidades Git intentará obtener el contenido.
    *   Botón **"Analizar Proyecto"**.
    *   Los **Resultados** se presentan con un resumen general del proyecto, áreas destacadas (puntos fuertes, débiles, áreas de mejora potencial) y, si aplica, sugerencias específicas (aunque menos detalladas que en "Refactorizar Proyecto").
    *   Se muestra un **Log Detallado** del proceso de análisis, especialmente si se usó un grupo de trabajo.

*   **AutoUpdate (Análisis del Propio Código)**: Permite que CodeAlchemist analice su propio código fuente para identificar áreas de mejora, bugs potenciales o aplicar refactorizaciones.
    *   Selector **"Usar Configuración LLM De"**. Por defecto, se recomienda usar el agente `RefactorizadorCodigoExperto` (creado automáticamente) o un grupo de trabajo configurado para esta tarea (que incluya al `RefactorizadorCodigoExperto` y al `OrquestadorFlujoAgentes`).
    *   **Fuente del Código para Auto-Análisis**:
        *   **Local** (opción por defecto): Analiza el código fuente actual de la aplicación CodeAlchemist que se está ejecutando.
        *   **URL del Repositorio Git (Opcional)**: Campo para introducir la URL de un repositorio Git de CodeAlchemist (puede ser el principal o un fork) para analizar esa versión específica. La aplicación intentará obtener el contenido del repositorio.
    *   **Preferencias de Análisis (Opcional)**: Campo de texto para guiar a la IA con objetivos específicos para el auto-análisis (ej. "Enfocarse en la optimización de las funciones de manejo de estado", "Revisar la seguridad de las interacciones con APIs externas", "Mejorar la modularidad de los componentes de UI"). Todas las sugerencias deben estar en castellano.
    *   Botón **"Iniciar Auto-Análisis"**.
    *   Muestra una **Barra de Progreso** durante el análisis, indicando el número de fragmentos de código procesados y el total, especialmente si el análisis no es gestionado por un grupo de trabajo (que tendría su propio log de turnos).
    *   **Resultados**:
        *   **Título del Análisis**: Un resumen conciso de los hallazgos.
        *   **Áreas Identificadas**: Componentes, módulos o archivos específicos que la IA ha destacado.
        *   **Sugerencias Detalladas**: Lista de sugerencias, cada una con:
            *   Área afectada.
            *   Descripción de la sugerencia.
            *   Prioridad.
            *   Si la sugerencia implica un cambio de código directo en un archivo, se proporciona el **Contenido Completo del Archivo Sugerido**.
        *   **Evaluación General**: Un resumen del estado general del código analizado.
    *   **Aplicar Sugerencias**: Para cada sugerencia que implique un cambio de código en un archivo:
        *   Botón **"Aplicar Sugerencia"**. Abre un diálogo de confirmación que muestra una vista previa del cambio (simulando un "diff" entre el contenido actual y el sugerido). Al confirmar, el archivo físico en el sistema de CodeAlchemist **SERÁ MODIFICADO**. Esta es una operación real y directa sobre el código fuente.
    *   **Descargar Código Fuente Completo**:
        *   Botón **"Descargar Código (ZIP)"**: Descarga un archivo ZIP que contiene el estado actual completo del código fuente de CodeAlchemist (todos los archivos necesarios para ejecutar la aplicación localmente).
        *   Botón **"Descargar Código (JSON)"**: Descarga una representación JSON del código fuente, donde cada entrada es un objeto con la ruta del archivo y su contenido.
    *   **Subir a Git**: Botón para realizar `commit` y `push` del estado actual del código fuente de CodeAlchemist al repositorio Git configurado en la sección "Configuración". Solicita un mensaje de commit antes de proceder. Esta operación es real si la configuración Git es válida.
    *   **Manejo de Errores y Auto-Fix**:
        *   Los errores que ocurran durante el análisis, aplicación de sugerencias o subida a Git se muestran claramente.
        *   Botón **"Copiar Error"** disponible para la mayoría de los mensajes de error.
        *   Botón **"Auto-Fix (Experimental)"**: Utiliza la IA configurada (la misma que para el análisis o una específica para "Auto-Fix") para analizar el mensaje de error y el contexto, proponiendo soluciones en un diálogo modal.
    *   **Logs de Ejecución Detallados**: Una ventana en la parte inferior de la sección muestra logs detallados con botones para **Copiar Logs**, **Borrar Logs** y **Expandir/Contraer** la ventana de logs.

*   **Versiones Guardadas (Snapshots)**: Gestiona instantáneas (snapshots) de código generadas desde "Analizar Código" o del estado completo de la aplicación.
    *   Muestra una lista de versiones guardadas, cada una con su nombre descriptivo y fecha de creación.
    *   **Acciones por Versión**:
        *   **Ver**: Abre un diálogo modal mostrando el contenido completo del código guardado en esa versión.
        *   **Descargar**: Descarga el código de la versión como un archivo de texto.
        *   **Eliminar**: Borra la versión seleccionada del almacenamiento local (con confirmación previa).
        *   **Seleccionar para Comparar (A/B)**: Dos botones ("A" y "B") permiten marcar hasta dos versiones para una comparación lado a lado.
    *   **Comparar Versiones**: Si se seleccionan dos versiones (A y B), se habilita un botón "Comparar A y B". Al pulsarlo, se abre un diálogo modal que muestra las diferencias entre el código de la versión A y la versión B (simulando un "diff").
    *   Botón **"Guardar Código Actual de CodeAlchemist"**: Toma un snapshot del código fuente completo y actual de la aplicación CodeAlchemist y lo guarda en esta sección.
    *   Botón **"Eliminar Todas"**: Borra todas las versiones guardadas del almacenamiento local (con confirmación previa).

*   **Chat con IA**: Permite interactuar con un asistente IA para consultas generales, ayuda con código, generación de ideas, etc.
    *   Selector **"Usar Configuración LLM De"** (Global, Agente, Grupo).
    *   Área de texto para escribir el mensaje. Se envía pulsando Enter (sin Shift) o con el botón de enviar.
    *   El historial de la conversación se muestra en la ventana principal, con mensajes del usuario y de la IA.
    *   Botón **"Borrar el Chat"** para limpiar el historial de la conversación actual.
    *   Manejo de errores con opciones para copiar el mensaje de error o intentar un **"Auto-Fix (Experimental)"** donde la IA analiza el error y propone soluciones.

*   **Gestión de Agentes IA**: Permite crear, configurar, probar y gestionar agentes IA individuales. Estos agentes son entidades especializadas que pueden ser usadas directamente o como parte de Grupos de Trabajo.
    *   Muestra una lista de agentes creados, con su nombre, descripción, configuración LLM y capacidades.
    *   Botones **"Importar Agentes"** (desde un archivo JSON) y **"Exportar Todos los Agentes"** (a un archivo JSON).
    *   **Formulario "Crear/Editar Agente"**:
        *   **Nombre**: Nombre único y descriptivo para el agente (ej. `AnalistaDeRequisitos`, `GeneradorDeTestsUnitarios`).
        *   **Descripción**: Breve explicación del propósito y especialización del agente.
        *   **Mensaje de Sistema (Prompt)**: El prompt base que define el rol, comportamiento, tono, y las instrucciones fundamentales del agente. Es la directriz principal para la IA.
        *   **Capacidades del Agente**: Interruptores para habilitar permisos específicos:
            *   **Acceso a Código Propio**: Permite al agente leer el código fuente de la aplicación CodeAlchemist.
            *   **Capacidad de Ejecución**: Permite al agente ejecutar comandos o scripts (marcado como "Peligroso" por implicaciones de seguridad).
            *   **Capacidad de Entorno Virtual**: Permite al agente interactuar con o gestionar entornos virtuales (ej. para instalar dependencias o ejecutar código aislado).
            *   **Capacidad Lectura/Escritura**: Permite al agente leer y escribir archivos en el sistema de CodeAlchemist (marcado como "Peligroso").
        *   **Configuración LLM del Agente**:
            *   Selector: **"Usar Configuración Global"** (usa los ajustes definidos en la sección "Configuración" de la aplicación) o **"Configuración Personalizada"**.
            *   Si se elige "Personalizada": Permite seleccionar un **Proveedor LLM** específico, un **Modelo** de ese proveedor, y opcionalmente sobrescribir la **Clave API** y la **URL de API** (útil para modelos locales o proxies).
    *   Se destaca la importancia del agente `OrquestadorFlujoAgentes` y su configuración sugerida (ver más abajo).
    *   **Acciones por Agente (en la lista)**:
        *   **Probar**: Abre una ventana de chat modal para interactuar directamente con el agente seleccionado, usando su mensaje de sistema y configuración LLM.
        *   **Exportar**: Descarga la configuración del agente seleccionado en formato JSON.
        *   **Editar**: Abre el formulario "Crear/Editar Agente" pre-rellenado con los datos del agente para su modificación. El nombre del agente `OrquestadorFlujoAgentes` no es editable para preservar su rol.
        *   **Eliminar**: Borra el agente del sistema (con confirmación previa). El agente `OrquestadorFlujoAgentes` no se puede eliminar.

*   **Gestión de Grupos de Trabajo IA**: Define equipos de agentes IA que pueden colaborar en tareas complejas, coordinados por un `OrquestadorFlujoAgentes`.
    *   Muestra una lista de grupos de trabajo creados.
    *   **Formulario "Crear/Editar Grupo"**:
        *   **Nombre**: Nombre único para el grupo de trabajo.
        *   **Descripción**: Breve explicación del propósito del grupo.
        *   **Tarea Principal del Grupo**: Un prompt detallado que describe el objetivo general que el grupo de trabajo debe alcanzar. Este es el input inicial para el `OrquestadorFlujoAgentes`.
        *   **Seleccionar Agentes Participantes**: Una lista de checkboxes para elegir los agentes que formarán parte del grupo. El agente `OrquestadorFlujoAgentes` es implícitamente añadido a cada grupo y no necesita ser seleccionado aquí (o si se muestra, está marcado como obligatorio/no deseleccionable). Se requiere al menos un agente adicional al Orquestador para que el grupo sea funcional.
    *   **Acciones por Grupo (en la lista)**:
        *   **Ejecutar**: Abre una ventana modal para la **"Ejecución del Grupo de Trabajo"**. Esta ventana muestra:
            *   La Tarea Principal del grupo.
            *   Un **Log de Ejecución Detallado** en tiempo real, que muestra:
                *   Número de turno.
                *   Decisiones del `OrquestadorFlujoAgentes` (a qué agente pasa el control y por qué).
                *   Respuestas o contribuciones de cada agente participante.
                *   Mensajes de sistema o errores que puedan ocurrir.
            *   Permite **Copiar los Logs** o **Detener la Ejecución** del grupo de trabajo.
        *   **Editar**: Abre el formulario "Crear/Editar Grupo" para modificar la configuración del grupo.
        *   **Eliminar**: Borra el grupo de trabajo del sistema (con confirmación previa).

*   **Interfaz de Usuario Intuitiva**:
    *   Construida con tecnologías web modernas para una experiencia fluida y responsiva.
    *   La **Barra Lateral** (ubicada a la izquierda) es colapsable para maximizar el espacio de trabajo. Contiene un botón en su parte inferior con los iconos `ChevronsLeft` (Ocultar) o `ChevronsRight` (Mostrar) para controlar su estado.
    *   En dispositivos móviles, un menú tipo "hamburguesa" (`Menu`) en la esquina superior izquierda controla la visibilidad de la barra lateral, que se despliega como un panel.
    *   Utiliza una paleta de colores diseñada para ser clara, legible y profesional, con buen contraste y jerarquía visual.

*   **Configuración Personalizada**: Permite al usuario ajustar diversos parámetros de la aplicación.
    *   **Configuración del Proveedor LLM**:
        *   **Proveedor LLM**: Selector para el servicio de IA a utilizar globalmente (Groq, Google Gemini, OpenAI, Anthropic, LM Studio, Ollama).
        *   **URL del Endpoint de API**: Campo para la URL base de la API. Es especialmente relevante para modelos locales (LM Studio, Ollama) o si se usa un proxy. Para proveedores en la nube, suele rellenarse automáticamente pero puede sobrescribirse.
        *   **Clave API**: Campo de texto (tipo contraseña) para introducir la clave API del proveedor seleccionado (si la requiere). Esta clave se guarda de forma segura en el almacenamiento local del navegador del usuario.
        *   **Nombre del Modelo**: Un selector que se actualiza dinámicamente según el Proveedor LLM seleccionado. Lista los modelos disponibles para ese proveedor, usualmente ordenados por capacidad o popularidad.
        *   Botón **"Probar Conexión (Proveedor LLM)"**: Verifica la comunicación con el servicio de IA usando la configuración actual, mostrando un mensaje de éxito o error.
    *   **Configuración de Git (Opcional)**: Para funcionalidades como "Subir a Git" en "AutoUpdate".
        *   **URL del Repositorio Git**: Campo para la URL HTTPS del repositorio remoto de CodeAlchemist o donde se deseen subir los cambios.
        *   **Nombre de Usuario Git**: Nombre de usuario para los commits.
        *   **Email de Git**: Email para los commits.
        *   **Token de Acceso Personal (PAT)**: Token de Git para autenticación (tipo contraseña).
        *   Botón **"Probar Conexión Git"**: Verifica la autenticación con el repositorio remoto usando las credenciales proporcionadas.
    *   **Modo Depuración**:
        *   Interruptor (checkbox o switch) para **"Activar modo Debug"**. Al activarlo, aparece un panel de logs detallados fijo en la parte inferior de la pantalla de la aplicación. Este panel es expandible/contraíble mediante botones (`ChevronUp`/`ChevronDown`) y tiene opciones para **Copiar Logs** (`Copy`) y **Borrar Logs** (`Trash2`).
    *   Botón **"Guardar Configuración"**: Guarda todos estos ajustes en el almacenamiento local del navegador para persistencia entre sesiones.

*   **Manejo de Errores Mejorado**:
    *   Los errores (de llamadas a IA, operaciones Git, errores internos de la aplicación, etc.) se muestran de forma clara al usuario, usualmente cerca de donde ocurrió el problema.
    *   Botón **"Copiar Error"** disponible junto a la mayoría de los mensajes de error para facilitar el reporte o la depuración.
    *   Botón **"Auto-Fix (Experimental)"**: Presente en secciones como "AutoUpdate" (para errores de análisis o subida a Git) y "Chat con IA". Al pulsarlo, la IA configurada analiza el mensaje de error y el contexto actual para proponer posibles soluciones o explicaciones en un diálogo modal. El sistema también considera:
        *   **Priorización dinámica de errores (conceptual)**: Análisis de criticidad para enfocar los esfuerzos de auto-corrección.
        *   **Aprendizaje predictivo (conceptual)**: Identificación de patrones de error para sugerencias proactivas.
        *   **Validación robusta (conceptual)**: Pruebas automatizadas antes de aplicar correcciones auto-generadas.
        *   **Sincronización con Orquestador (conceptual)**: Comunicación para asegurar coherencia en correcciones complejas.
    *   Gestión de errores comunes de API LLM, como límites de tokens/TPM (Tokens Per Minute) o timeouts, con estrategias de reintentos con backoff exponencial y fragmentación de datos grandes (ej. en "AutoUpdate").

## Guía de Inicio

### Requisitos Previos

*   Un navegador web moderno y actualizado (ej. Chrome, Firefox, Edge, Safari).
*   Conexión a internet para acceder a los proveedores de IA basados en la nube y, opcionalmente, a repositorios Git remotos.
*   (Opcional) Si se usan modelos LLM locales (LM Studio, Ollama), tenerlos instalados, configurados y en ejecución en la máquina local o en un servidor accesible.

### Instalación y Primer Uso

1.  **Acceder a la Aplicación**: Abre la URL donde CodeAlchemist está desplegado en tu navegador web.
2.  **Configuración Inicial (Muy Recomendado)**:
    *   Navega a la sección **"Configuración"** (icono de engranaje `Settings` en la barra lateral).
    *   **Configura tu Proveedor LLM Global**:
        *   Selecciona el **Proveedor LLM** que deseas usar (Groq, Google Gemini, etc.).
        *   Introduce tu **Clave API** si el proveedor la requiere. Se guarda localmente en tu navegador.
        *   Elige un **Nombre del Modelo** de la lista disponible para ese proveedor.
        *   Si usas un proveedor local como LM Studio u Ollama, asegúrate de que la **URL del Endpoint de API** sea correcta (ej. `http://localhost:1234/v1` para LM Studio, `http://localhost:11434/v1` o `/api/chat` para Ollama, dependiendo de la compatibilidad).
        *   Haz clic en **"Probar Conexión (Proveedor LLM)"** para asegurar que la comunicación con la IA es exitosa.
    *   **(Opcional) Configura Git**: Si planeas usar la funcionalidad de "Subir a Git" en "AutoUpdate", completa los detalles de Git (URL del Repositorio, Nombre de Usuario, Email, Token de Acceso Personal) y prueba la conexión con **"Probar Conexión Git"**.
    *   **(Opcional) Activa el Modo Depuración**: Si deseas ver logs detallados de la aplicación.
    *   Haz clic en **"Guardar Configuración"**.
3.  **Inicialización de Agentes y Grupos por Defecto**:
    *   Al cargar la aplicación por primera vez (o si no existen en el almacenamiento local), CodeAlchemist crea automáticamente un conjunto de agentes y un grupo de trabajo por defecto:
        *   **Agentes Creados por Defecto**:
            *   `OrquestadorFlujoAgentes`: Esencial para la gestión de grupos de trabajo. No se puede eliminar y su nombre no es editable.
            *   `RefactorizadorCodigoExperto`: Especializado en análisis y refactorización de código.
            *   Otros agentes como `JefeDeProducto`, `ArquitectoSoftware`, `DesarrolladorSoftware`, `IngenieroPruebas`, `IngenieroDevOps`, y `RepresentanteUsuario` se crean para ejemplificar un equipo de desarrollo.
        *   **Grupo de Trabajo Creado por Defecto**:
            *   `EquipoDesarrolloSoftware`: Incluye al `OrquestadorFlujoAgentes` y a varios de los otros agentes por defecto. Su tarea principal está predefinida para simular un equipo de producción de software versátil.
    *   Estos elementos por defecto sirven como punto de partida y pueden ser editados (excepto el nombre y la eliminación del `OrquestadorFlujoAgentes`).

## Tutorial de Uso Detallado

A continuación, se describe cómo utilizar cada sección principal de CodeAlchemist.

### 1. Navegación y Barra Lateral

*   La interfaz principal cuenta con una **Barra Lateral** a la izquierda que da acceso a todas las secciones de la aplicación.
    *   **Panel de Control**: Es la página de inicio, ofreciendo una visión general y acceso rápido a las funcionalidades. (Icono: `LayoutDashboard`)
    *   **Generar Código**: Para crear fragmentos de código a partir de descripciones. (Icono: `CodeXml`)
    *   **Generar Proyecto**: Para iniciar nuevas estructuras de proyecto desde cero. (Icono: `FolderPlus`)
    *   **Refactorizar Proyecto**: Para analizar y obtener sugerencias de refactorización de proyectos existentes. (Icono: `GitPullRequestDraft`)
    *   **Analizar Código**: Para análisis detallados de fragmentos de código o archivos individuales. (Icono: `ScanLine`)
    *   **Analizar Proyecto**: Para un análisis completo de un proyecto, ya sea subido o desde Git. (Icono: `FolderSearch`)
    *   **AutoUpdate**: Para que CodeAlchemist analice y sugiera mejoras para su propio código fuente. (Icono: `Sparkles`)
    *   **Versiones Guardadas**: Para gestionar snapshots (instantáneas) de código. (Icono: `GitCompareArrows`)
    *   **Chat con IA**: Para conversar con un asistente IA. (Icono: `MessageCircle`)
    *   **Agentes IA**: Para crear, configurar y gestionar agentes IA individuales. (Icono: `Users2`)
    *   **Grupos de Trabajo IA**: Para definir y ejecutar equipos de agentes IA colaborativos. (Icono: `Workflow`)
    *   **Configuración**: Para ajustar parámetros globales de la aplicación, como proveedor LLM, claves API y configuración Git. (Icono: `Settings`)
*   La barra lateral puede **Ocultarse/Mostrarse** haciendo clic en el botón respectivo en la parte inferior de la misma (en vista de escritorio), que muestra los iconos `ChevronsLeft` (Ocultar) o `ChevronsRight` (Mostrar). Esto es útil para maximizar el espacio de trabajo.
*   En dispositivos móviles (pantallas pequeñas), un icono de menú (`Menu`) en la esquina superior izquierda abrirá la barra lateral como un panel deslizable para ahorrar espacio.

### 2. Configuración (Sección "Configuración")

Es crucial configurar correctamente la aplicación para su óptimo funcionamiento. Accede mediante el icono `Settings` en la barra lateral.

*   **Configuración del Proveedor LLM**:
    *   **Proveedor LLM**: Un selector para elegir el servicio de IA global que usará la aplicación por defecto (Groq, Google Gemini, OpenAI, Anthropic, LM Studio, Ollama).
    *   **URL del Endpoint de API**: Un campo de texto. Para proveedores locales (LM Studio, Ollama) o proxies personalizados, introduce la URL base (ej. `http://localhost:1234/v1`). Para proveedores en la nube, este campo se suele rellenar automáticamente con la URL estándar, pero puede ser sobrescrita si es necesario.
    *   **Clave API**: Un campo de texto (tipo contraseña) para introducir tu clave API si el proveedor seleccionado la requiere. Esta clave se guarda de forma segura en el almacenamiento local de tu navegador y no se envía a ningún servidor externo a CodeAlchemist, excepto al proveedor LLM durante las llamadas directas.
    *   **Nombre del Modelo**: Un selector que se actualiza dinámicamente según el proveedor LLM seleccionado. Lista los modelos disponibles para ese proveedor, usualmente ordenados por popularidad o capacidad.
    *   Botón **"Probar Conexión (Proveedor LLM)"**: Verifica la comunicación con el servicio IA usando la configuración actual. Muestra un mensaje de éxito o error, ayudando a diagnosticar problemas de configuración.
*   **Configuración de Git**:
    *   **URL del Repositorio Git**: Campo para la URL HTTPS de tu repositorio Git (ej. para la funcionalidad de "Subir a Git" en "AutoUpdate").
    *   **Nombre de Usuario Git**: Campo para tu nombre de usuario Git, que se usará en los commits.
    *   **Email de Git**: Campo para el email asociado a tus commits en Git.
    *   **Token de Acceso Personal (PAT)**: Campo de texto (tipo contraseña) para tu Token de Acceso Personal de Git, necesario para autenticar operaciones como `push` a repositorios privados o que requieran autenticación.
    *   Botón **"Probar Conexión Git"**: Verifica la autenticación con el repositorio remoto usando las credenciales proporcionadas. Muestra un mensaje de éxito o error.
*   **Modo Depuración**:
    *   Un interruptor (checkbox o switch) para **"Activar modo Debug"**. Al activarlo, aparece un panel de logs detallados fijo en la parte inferior de la pantalla de la aplicación. Este panel es expandible/contraíble mediante botones (`ChevronUp`/`ChevronDown`) y tiene opciones para **Copiar Logs** (`Copy`) y **Borrar Logs** (`Trash2`) del panel.
*   Botón **"Guardar Configuración"**: Guarda todos los ajustes realizados en esta sección en el almacenamiento local del navegador, para que persistan entre sesiones.

### 3. Generar Código (Sección "Generar Código")

Accede mediante el icono `CodeXml` en la barra lateral.

*   **Usar Configuración LLM De**: Un selector para elegir la fuente de la configuración de IA que se utilizará para esta generación:
    *   **Ajustes Globales**: Utiliza la configuración LLM definida en la sección "Configuración".
    *   **Agente: [Nombre del Agente]**: Utiliza la configuración LLM específica (global o personalizada) del agente seleccionado de la lista de agentes creados.
    *   **Grupo: [Nombre del Grupo]**: La tarea de generación de código se pasa al `OrquestadorFlujoAgentes` del grupo seleccionado, quien coordinará a los agentes del grupo para producir el código.
*   **Describe tu necesidad**: Un área de texto grande para que el usuario escriba un prompt detallado describiendo el fragmento de código que necesita (ej. lenguaje, funcionalidad, entradas, salidas esperadas).
*   Botón **"Generar Código"**: Inicia el proceso de generación. Antes de contactar a la IA, puede mostrar un diálogo de confirmación con el prompt y la configuración LLM a usar.
*   **Resultados**:
    *   Se muestra una **Explicación** (opcional, generada por la IA) del código que se va a generar.
    *   A continuación, se presenta el **Fragmento de Código** generado por la IA.
    *   Un botón **"Copiar Código"** permite copiar fácilmente el fragmento generado al portapapeles.
    *   Si se utilizó un grupo de trabajo, se muestra un **Log Detallado del Grupo** al final de la página, que es expandible/contraíble y permite copiar su contenido. Este log muestra las interacciones entre los agentes del grupo durante el proceso de generación.

### 4. Generar Proyecto (Sección "Generar Proyecto")

Accede mediante el icono `FolderPlus` en la barra lateral.

*   **Usar Configuración LLM De**: Selector similar al de "Generar Código" (Global, Agente, Grupo).
*   **Describe tu proyecto**: Área de texto para el prompt detallado, donde el usuario especifica el tipo de proyecto, tecnologías principales, estructura de carpetas deseada, archivos iniciales, etc.
*   Botón **"Generar Proyecto"**: Al pulsarlo, se abre un diálogo modal de **"Confirmar Generación"**. En este diálogo:
    *   Se muestra el prompt actual introducido por el usuario.
    *   Un área de texto permite **"Redefinir Prompt (opcional)"** para que el usuario pueda ajustar o añadir detalles a su descripción antes de proceder con la generación.
    *   Botones para **"Cancelar"** la operación o **"Sí, Generar Proyecto"** para iniciarla.
*   **Resultados**:
    *   **Nombre Sugerido**: Un nombre para el proyecto, sugerido por la IA basado en la descripción.
    *   **Notas de la IA**: Comentarios o consideraciones adicionales de la IA sobre la estructura generada, posibles dependencias a instalar, o siguientes pasos recomendados.
    *   Lista de **"Archivos Generados"**: Se muestra una estructura de árbol o lista con las rutas relativas de los archivos y carpetas generados. Cada archivo puede expandirse para ver su contenido directamente en la interfaz.
    *   Botón **"Descargar Proyecto (ZIP)"**: Permite descargar todos los archivos y carpetas generados como un único archivo ZIP.
    *   Si se utilizó un grupo de trabajo, se muestra un **Log Detallado del Grupo** al final de la página.

### 5. Refactorizar Proyecto (Sección "Refactorizar Proyecto")

Accede mediante el icono `GitPullRequestDraft` en la barra lateral.

*   **Usar Configuración LLM De**: Selector (Global, Agente, Grupo). Se recomienda seleccionar un agente especializado como `RefactorizadorCodigoExperto` (creado por defecto) o un grupo de trabajo que lo incluya junto con el `OrquestadorFlujoAgentes`.
*   **Fuente del Proyecto**:
    *   **Subir Archivo**: Un botón que permite al usuario seleccionar un archivo de su sistema. Formatos admitidos:
        *   `.zip`: Para proyectos completos.
        *   `.json`: Si el proyecto está representado en un formato JSON estructurado.
        *   Archivos de texto individuales (ej. `.py`, `.js`, `.html`, `.css`, `.java`, etc.): Para analizar archivos específicos.
    *   **URL de Git**: Un campo de texto para introducir la URL HTTPS de un repositorio Git público. La aplicación (a través de un agente con capacidad Git o un servicio interno) intentará clonar u obtener el contenido del repositorio para su análisis.
*   **Parámetros de Refactorización**:
    *   **Metas (opcional)**: Campo de texto para que el usuario describa objetivos específicos de la refactorización (ej. "Mejorar el rendimiento de las consultas a base de datos en el módulo X", "Aplicar el patrón Observer en los componentes de UI Y y Z", "Reducir la complejidad ciclomática de las funciones en `utils.py`").
    *   **Prioridad General (opcional)**: Un selector para indicar un enfoque general que la IA debe considerar (ej. "Priorizar Seguridad", "Priorizar Legibilidad", "Priorizar Rendimiento", "Estandarizar Código" según una guía de estilo implícita, "Reducir Complejidad").
*   Botón **"Analizar para Refactorizar"**: Inicia el proceso de análisis del proyecto proporcionado.
*   **Resultados y Sugerencias**: Se presenta una lista de sugerencias de refactorización. Cada sugerencia incluye:
    *   **Área**: El archivo, clase o función específica afectada por la sugerencia.
    *   **Descripción**: Una explicación clara de la mejora propuesta, el problema que soluciona o el principio de diseño que aplica.
    *   **Prioridad**: Un indicador de la importancia o impacto de la sugerencia (Alta, Media, Baja).
    *   **Snippet Sugerido (opcional)**: Si es aplicable, un fragmento del código original y el código modificado sugerido para ilustrar el cambio.
*   **Acciones por Sugerencia**:
    *   Botón **"Aplicar (Simulado)"**: Marca la sugerencia como "aplicada" en la interfaz de usuario. En esta sección, la aplicación de cambios no modifica los archivos externos, solo actualiza el estado visual de la sugerencia.
    *   Botón **"Ver Diff (Simulado)"**: Muestra una comparación visual (simulada) entre el código original y el sugerido para esa sugerencia específica.
    *   Botón **"Descartar"**: Marca la sugerencia como "descartada" y la oculta o atenúa en la lista.
*   **Acción Masiva**: Un botón **"Aplicar Todas las Sugerencias (Simulado)"** para marcar todas las sugerencias pendientes como aplicadas.
*   **Logs de Ejecución**: Si se utilizó un grupo de trabajo, se muestra un log detallado de las interacciones entre agentes y las decisiones del orquestador durante el análisis.

### 6. Analizar Código (Sección "Analizar Código")

Accede mediante el icono `ScanLine` en la barra lateral.

*   **Usar Configuración LLM De**: Selector (Global, Agente, Grupo).
*   **Fuente del Código**: Proporciona múltiples maneras de introducir el código a analizar:
    *   Botón **"Sube un archivo de código (opcional)"**: Permite al usuario cargar un archivo de código fuente desde su sistema.
    *   Campo **"URL de Archivo Git (opcional)"**: Permite pegar la URL directa a un archivo "raw" (contenido crudo) en un repositorio Git (ej. GitHub, GitLab). La aplicación intentará descargar el contenido de esa URL.
    *   Área de texto principal: El usuario puede pegar directamente el fragmento de código que desea analizar.
*   Botón **"Analizar Código"**: Inicia el análisis del código proporcionado.
*   **Resultados**:
    *   **Explicación**: La IA genera una explicación en lenguaje natural del funcionamiento del código original.
    *   **Código Original**: Muestra el código que se introdujo para el análisis.
    *   **Código Sugerido**: Presenta una versión del código con las mejoras, correcciones u optimizaciones propuestas por la IA.
*   Botones **"Guardar Original"** y **"Guardar Sugerido"**: Permiten crear "snapshots" (instantáneas) del código original y del código sugerido, respectivamente. Estas versiones se almacenan en la sección "Versiones Guardadas" para su posterior revisión o comparación.

### 7. Analizar Proyecto Completo (Sección "Analizar Proyecto")

Accede mediante el icono `FolderSearch` en la barra lateral.

*   **Usar Configuración LLM De**: Selector (Global, Agente, Grupo).
*   **Fuente del Proyecto**:
    *   Botón **"Subir Archivo (ZIP/JSON)"**: Permite subir un proyecto completo empaquetado en un archivo `.zip` o una representación del proyecto en formato `.json`.
    *   Campo **"URL de Git"**: Para introducir la URL HTTPS de un repositorio Git público. La aplicación (o un agente con capacidades Git) intentará obtener el contenido del repositorio.
*   Botón **"Analizar Proyecto"**: Inicia el análisis holístico del proyecto.
*   **Resultados**:
    *   Se muestra un resumen general del análisis, destacando áreas clave, posibles problemas de alto nivel, o la calidad general percibida por la IA.
    *   Puede incluir una lista de áreas identificadas o sugerencias más generales que en "Refactorizar Proyecto".
*   **Log Detallado**: Muestra un log del proceso de análisis, especialmente si se utilizó un grupo de trabajo, detallando las interacciones entre los agentes.

### 8. AutoUpdate (Sección "AutoUpdate")

Accede mediante el icono `Sparkles` en la barra lateral. Esta sección permite que CodeAlchemist se analice a sí mismo.

*   **Usar Configuración LLM De**: Selector (Global, Agente, Grupo). Por defecto, se recomienda usar el agente `RefactorizadorCodigoExperto` (creado automáticamente) o un grupo de trabajo que lo incluya junto con el `OrquestadorFlujoAgentes`.
*   **Fuente del Código para Auto-Análisis**:
    *   **Local** (opción por defecto): Analiza el código fuente actual de la aplicación CodeAlchemist que se está ejecutando en el entorno.
    *   **URL del Repositorio Git (Opcional)**: Un campo para introducir la URL de un repositorio Git de CodeAlchemist (puede ser el repositorio principal o un fork). Esto permite analizar una versión específica del código base. La aplicación intentará obtener el contenido de esta URL.
*   **Preferencias de Análisis (Opcional)**: Un campo de texto para que el usuario guíe a la IA con objetivos específicos para el auto-análisis (ej. "Optimizar el rendimiento de los componentes de UI", "Mejorar la seguridad en las interacciones con APIs de terceros", "Asegurar que los comentarios del código estén en castellano"). Es importante indicar que "Todas las sugerencias deben estar en castellano" si se desea ese idioma.
*   Botón **"Iniciar Auto-Análisis"**: Comienza el proceso de auto-análisis.
*   Muestra una **Barra de Progreso** si el análisis se realiza por fragmentos (no gestionado por un grupo), indicando "Procesando fragmento X de Y".
*   **Resultados**:
    *   **Título del Análisis**: Un resumen conciso de los hallazgos del auto-análisis.
    *   **Áreas Identificadas**: Componentes, módulos o archivos específicos que la IA ha destacado.
    *   **Sugerencias Detalladas**: Una lista de sugerencias, cada una con:
        *   Área afectada (ej. ruta de archivo).
        *   Sugerencia específica de mejora o corrección.
        *   Prioridad (Alta, Media, Baja).
        *   Si la sugerencia implica un cambio de código directo en un archivo, se proporciona el **Contenido Completo del Archivo Sugerido**.
    *   **Evaluación General**: Un resumen de la IA sobre el estado general del código de CodeAlchemist analizado.
*   **Aplicar Sugerencias**: Para cada sugerencia que proponga un cambio de código en un archivo:
    *   Botón **"Aplicar Sugerencia"**. Al pulsarlo, se abre un diálogo de confirmación que muestra una vista previa del cambio (simulando un "diff" entre el contenido actual del archivo y el contenido sugerido).
    *   Al confirmar en el diálogo, el archivo físico correspondiente en el sistema de CodeAlchemist **SERÁ MODIFICADO DIRECTAMENTE**. Esta es una operación real.
*   **Descargar Código Fuente Completo**:
    *   Botón **"Descargar Código (ZIP)"**: Descarga un archivo ZIP que contiene el estado actual completo del código fuente de CodeAlchemist (todos los archivos necesarios para ejecutar la aplicación).
    *   Botón **"Descargar Código (JSON)"**: Descarga una representación JSON del código fuente, donde cada entrada es un objeto con la ruta del archivo y su contenido.
*   **Subir a Git**:
    *   Botón para iniciar el proceso de `commit` y `push` del estado actual del código fuente de CodeAlchemist al repositorio Git configurado en la sección "Configuración".
    *   Solicita al usuario un mensaje de commit antes de proceder.
    *   Esta operación es real si la configuración Git es válida y el repositorio remoto es accesible.
*   **Manejo de Errores y Auto-Fix**:
    *   Los errores que ocurran durante el análisis, aplicación de sugerencias, o subida a Git se muestran claramente.
    *   Botón **"Copiar Error"** disponible para la mayoría de los mensajes de error.
    *   Botón **"Auto-Fix (Experimental)"**: Utiliza la IA configurada para analizar el mensaje de error y el contexto actual, proponiendo soluciones o explicaciones en un diálogo modal.
*   **Logs de Ejecución Detallados**: Un panel en la parte inferior de la sección muestra logs detallados del proceso. Este panel es expandible/contraíble y cuenta con botones para **Copiar Logs** y **Borrar Logs**.

### 9. Versiones Guardadas (Sección "Versiones Guardadas")

Accede mediante el icono `GitCompareArrows` en la barra lateral. Gestiona instantáneas de código.

*   Muestra una lista de las versiones de código que se han guardado, cada una con su nombre descriptivo y la fecha/hora de creación.
*   **Acciones por Versión**: Para cada versión en la lista, se dispone de las siguientes acciones:
    *   **Ver**: Abre un diálogo modal que muestra el contenido completo del código guardado en esa versión.
    *   **Descargar**: Permite descargar el código de la versión como un archivo de texto plano.
    *   **Eliminar**: Borra la versión seleccionada del almacenamiento local (se pide confirmación antes de eliminar).
    *   **Seleccionar para Comparar (A/B)**: Dos botones ("A" y "B") junto a cada versión. Al pulsar "A" en una versión, se marca como la primera para la comparación. Al pulsar "B" en otra versión, se marca como la segunda.
*   **Comparar Versiones**: Si se han seleccionado dos versiones (una como A y otra como B), se habilita un botón (o se muestra automáticamente) para "Comparar A y B". Al activarlo, se abre un diálogo modal que muestra las diferencias entre el código de la versión A y la versión B, resaltando las líneas añadidas, eliminadas o modificadas (simulando un "diff").
*   Botón **"Guardar Código Actual de CodeAlchemist"**: Permite tomar una instantánea del código fuente completo y actual de la aplicación CodeAlchemist y guardarla en esta sección con un nombre y fecha generados automáticamente.
*   Botón **"Eliminar Todas"**: Borra todas las versiones guardadas del almacenamiento local (se pide confirmación antes de proceder).

### 10. Chat con IA (Sección "Chat con IA")

Accede mediante el icono `MessageCircle` en la barra lateral.

*   **Usar Configuración LLM De**: Selector (Global, Agente, Grupo). Permite dirigir la conversación al LLM configurado globalmente, a un agente específico, o a un grupo de trabajo.
*   Área de texto para que el usuario escriba sus mensajes o preguntas a la IA. Se puede enviar pulsando Enter (si no se usa Shift+Enter para nueva línea) o mediante un botón de enviar.
*   El historial de la conversación (mensajes del usuario y respuestas de la IA) se muestra en la ventana principal del chat.
*   Botón **"Borrar el Chat"** para limpiar el historial de la conversación actual.
*   En caso de errores en la respuesta de la IA, se muestra el mensaje de error con opciones para **Copiar Error** o intentar un **"Auto-Fix (Experimental)"**.

### 11. Gestión de Agentes IA (Sección "Agentes IA")

Accede mediante el icono `Users2` en la barra lateral.

*   Muestra una lista de todos los agentes IA creados, con su nombre, descripción, configuración LLM y un resumen de sus capacidades.
*   Botones **"Importar Agentes"** (permite subir un archivo JSON que contenga la configuración de uno o más agentes) y **"Exportar Todos los Agentes"** (descarga un archivo JSON con la configuración de todos los agentes actuales).
*   **Formulario "Crear/Editar Agente"** (accesible mediante un botón "Crear Agente Nuevo" o al editar un agente existente):
    *   **Nombre**: Campo de texto para un nombre único y descriptivo del agente (ej. `AnalistaDeRequisitos`, `GeneradorDeTestsUnitarios`, `ExpertoEnPython`).
    *   **Descripción**: Campo de texto para una breve explicación del propósito y la especialización del agente.
    *   **Mensaje de Sistema (Prompt)**: Un área de texto grande para definir el prompt base del agente. Este prompt es crucial, ya que define el rol, el comportamiento, el tono, las instrucciones fundamentales y las restricciones que la IA debe seguir al actuar como este agente.
    *   **Capacidades del Agente**: Un conjunto de interruptores (checkboxes) para habilitar permisos específicos para el agente:
        *   Checkbox **"Acceso a Código Propio"**: Si está marcado, el agente tiene permiso para leer el código fuente de la aplicación CodeAlchemist.
        *   Checkbox **"Capacidad de Ejecución"**: Si está marcado, el agente tiene permiso para ejecutar comandos o scripts en el sistema. Esta opción está marcada con una advertencia de "Peligroso" debido a las implicaciones de seguridad.
        *   Checkbox **"Capacidad de Entorno Virtual"**: Si está marcado, el agente puede tener la capacidad de interactuar con o gestionar entornos virtuales (ej. para instalar dependencias o ejecutar código de forma aislada).
        *   Checkbox **"Capacidad Lectura/Escritura"**: Si está marcado, el agente tiene permiso para leer y escribir archivos en el sistema donde se ejecuta CodeAlchemist. Esta opción también está marcada con una advertencia de "Peligroso".
    *   **Configuración LLM del Agente**: Permite definir qué modelo de lenguaje grande usará este agente:
        *   Selector: **"Usar Configuración Global"** (el agente usará los ajustes de Proveedor LLM, Modelo, API Key, etc., definidos en la sección "Configuración" de la aplicación) o **"Configuración Personalizada"**.
        *   Si se elige "Configuración Personalizada": Se muestran campos adicionales para seleccionar un **Proveedor LLM** (Groq, Google Gemini, etc.), un **Modelo** específico de ese proveedor, y opcionalmente, sobrescribir la **Clave API** (tipo contraseña) y la **URL de API** (si aplica para el proveedor, ej. para modelos locales). Si se dejan vacíos la clave o URL personalizadas, se usarán las globales si existen para ese proveedor.
*   Agente especial **`OrquestadorFlujoAgentes`**:
    *   Este agente se crea automáticamente por defecto y es crucial para el funcionamiento de los Grupos de Trabajo.
    *   Su descripción y Mensaje de Sistema están predefinidos para detallar su rol crítico: recibir y gestionar todas las respuestas generadas dentro de un grupo, decidir qué agente actúa a continuación basado en la tarea principal, el historial y el estado actual, para asegurar un flujo coordinado y la toma de decisiones centralizada.
    *   Se recomienda usar un modelo LLM capaz de seguir instrucciones JSON estrictas para este agente, ya que su respuesta debe ser un JSON que indique el próximo agente y la razón.
    *   El nombre de este agente no es editable y no se puede eliminar.
*   Agente especial **`RefactorizadorCodigoExperto`**:
    *   Este agente también se crea automáticamente por defecto.
    *   Está especializado en analizar código y proponer refactorizaciones, priorizando estándares como SOLID y Clean Code. Su mensaje de sistema está orientado a esta tarea y a devolver sugerencias en formato JSON.
*   **Acciones por Agente (en la lista)**:
    *   Botón **"Probar"**: Abre una ventana de chat modal diseñada para interactuar directamente con el agente seleccionado. Se utiliza el mensaje de sistema y la configuración LLM del agente para esta prueba.
    *   Botón **"Exportar"**: Descarga un archivo JSON con la configuración completa del agente seleccionado.
    *   Botón **"Editar"**: Abre el formulario "Crear/Editar Agente" pre-rellenado con los datos del agente para su modificación. (El nombre del `OrquestadorFlujoAgentes` no es editable).
    *   Botón **"Eliminar"**: Permite borrar el agente del sistema (se pide confirmación). (Deshabilitado para `OrquestadorFlujoAgentes`).

### 12. Gestión de Grupos de Trabajo IA (Sección "Grupos de Trabajo IA")

Accede mediante el icono `Workflow` en la barra lateral.

*   Muestra una lista de los grupos de trabajo creados, con su nombre y descripción.
*   **Formulario "Crear/Editar Grupo"** (accesible mediante un botón "Crear Grupo Nuevo" o al editar un grupo existente):
    *   **Nombre**: Campo de texto para un nombre único para el grupo de trabajo.
    *   **Descripción**: Campo de texto para una breve explicación del propósito o la especialización del grupo.
    *   **Tarea Principal del Grupo**: Un área de texto para definir el prompt detallado que describe el objetivo general que el grupo de trabajo debe alcanzar. Este es el input inicial que recibirá el `OrquestadorFlujoAgentes` del grupo.
    *   **Seleccionar Agentes Participantes**: Una lista de checkboxes que muestra todos los agentes disponibles (excepto el `OrquestadorFlujoAgentes`, que se añade implícitamente). El usuario debe seleccionar al menos un agente para que participe en el grupo además del orquestador.
*   Grupo de trabajo por defecto **`EquipoDesarrolloSoftware`**:
    *   Se crea automáticamente si no existe.
    *   Incluye al `OrquestadorFlujoAgentes` y una selección de otros agentes por defecto como `JefeDeProducto`, `ArquitectoSoftware`, `DesarrolladorSoftware`, `RefactorizadorCodigoExperto`, `IngenieroPruebas`, etc.
    *   Su tarea principal está predefinida para simular un equipo de producción de software completo y versátil, capaz de abordar diversas tareas de desarrollo.
*   **Acciones por Grupo (en la lista)**:
    *   Botón **"Ejecutar"**: Abre un diálogo modal titulado **"Ejecución del Grupo de Trabajo"**. Esta ventana es interactiva y muestra:
        *   La **Tarea Principal** asignada al grupo.
        *   Se inicia la ejecución del grupo, comenzando con el `OrquestadorFlujoAgentes`.
        *   Un **Log de Ejecución Detallado** se actualiza en tiempo real, mostrando:
            *   El número de turno actual.
            *   Las decisiones del `OrquestadorFlujoAgentes` (a qué agente le pasa el control y por qué).
            *   Las respuestas o contribuciones textuales de cada agente participante.
            *   Cualquier mensaje de sistema relevante o error que pueda ocurrir durante la ejecución.
        *   Un botón para **"Copiar los Logs"** al portapapeles.
        *   Un botón para **"Detener la Ejecución"** del grupo de trabajo.
    *   Botón **"Editar"**: Abre el formulario "Crear/Editar Grupo" pre-rellenado con los datos del grupo para su modificación.
    *   Botón **"Eliminar"**: Permite borrar el grupo de trabajo del sistema (se pide confirmación).

## Flujo de Trabajo con IA

### Selección de Fuente de Configuración LLM

En la mayoría de las secciones que utilizan capacidades de IA (como "Generar Código", "Analizar Código", "AutoUpdate", "Chat con IA"), el usuario encontrará un selector desplegable etiquetado como **"Usar Configuración LLM De:"**. Este selector ofrece las siguientes opciones para determinar qué modelo de lenguaje y configuración se utilizará:

1.  **Ajustes Globales**: Si se selecciona esta opción, la operación de IA utilizará la configuración (Proveedor LLM, Modelo, Clave API, URL de API) definida globalmente en la sección **"Configuración"** de la aplicación.
2.  **Agente: [Nombre del Agente]**: Esta opción lista todos los agentes IA que el usuario ha creado en la sección "Agentes IA". Al seleccionar un agente específico, la operación de IA utilizará la configuración LLM definida para ese agente (que puede ser la global o una personalizada para ese agente) y su Mensaje de Sistema como prompt principal.
3.  **Grupo: [Nombre del Grupo]**: Esta opción lista todos los grupos de trabajo que el usuario ha creado en la sección "Grupos de Trabajo IA". Al seleccionar un grupo, la tarea o prompt del usuario se entrega como la "Tarea Principal" al `OrquestadorFlujoAgentes` de ese grupo. El Orquestador entonces utiliza su propia configuración LLM y coordina a los demás agentes del grupo (cada uno usando su respectiva configuración LLM) para completar la tarea. El resultado final es la respuesta consolidada o generada por el grupo.

### Agentes y Grupos de Trabajo

*   **Agentes**: Son entidades de IA individuales, cada una con:
    *   Un **Mensaje de Sistema (Prompt)** que define su rol, personalidad, instrucciones y restricciones.
    *   **Capacidades** específicas (acceso a código, ejecución, etc.) que determinan qué acciones pueden realizar.
    *   Una **Configuración LLM** (global o personalizada) que especifica el modelo de lenguaje que utilizará.
    Los agentes están diseñados para ser especialistas en tareas concretas.

*   **Grupos de Trabajo**: Son equipos de agentes IA diseñados para colaborar en tareas más complejas que podrían requerir múltiples especializaciones o pasos.
    *   El agente **`OrquestadorFlujoAgentes`** es un componente obligatorio y central en cada grupo. No realiza la tarea directamente, sino que:
        *   Recibe la tarea principal del grupo.
        *   Gestiona el flujo de interacción entre los agentes.
        *   Recibe y evalúa todas las respuestas generadas por los agentes participantes.
        *   Decide qué agente (o subgrupo, conceptualmente) debe actuar a continuación para avanzar hacia el objetivo.
        *   Asegura la coordinación y la toma de decisiones centralizada.
    *   Si el usuario (o el prompt inicial) no guía explícitamente el siguiente paso, el `OrquestadorFlujoAgentes` prioriza a los agentes cuyas capacidades son más relevantes para el estado actual de la tarea.
    *   La comunicación entre agentes dentro de un grupo siempre pasa a través del Orquestador.

## Manejo de Errores

CodeAlchemist implementa varios mecanismos para gestionar y comunicar errores:

*   **Visualización Clara**: Los errores generados por la API del LLM, operaciones Git, o fallos internos de la aplicación se muestran al usuario de forma clara, usualmente en la sección donde se originó el error o mediante notificaciones (toasts).
*   **Copia de Errores**: La mayoría de los mensajes de error mostrados en la interfaz de usuario van acompañados de un botón **"Copiar Error"**. Esto facilita al usuario copiar el mensaje exacto para buscar ayuda, reportar un bug o analizarlo.
*   **Auto-Fix (Experimental)**:
    *   En secciones como "AutoUpdate" y "Chat con IA", si ocurre un error, se presenta un botón **"Auto-Fix (Experimental)"**.
    *   Al pulsarlo, la aplicación envía el mensaje de error y el contexto relevante (como el prompt que causó el error o el estado actual) a la IA configurada.
    *   La IA analiza esta información y propone una o más posibles causas y soluciones en un diálogo modal. El usuario puede entonces revisar estas sugerencias para intentar resolver el problema.
    *   **Refuerzo del Sistema Auto-Fix (Conceptual)**:
        *   **Priorización dinámica**: Un módulo de análisis podría clasificar errores por su criticidad (impacto en rendimiento, seguridad, usabilidad) para enfocar los esfuerzos de auto-corrección.
        *   **Aprendizaje automático predictivo**: Un modelo entrenado con datos históricos de errores y sus correcciones podría identificar patrones y sugerir soluciones proactivas.
        *   **Validación robusta**: Antes de aplicar correcciones auto-generadas (especialmente en "AutoUpdate"), se podrían ejecutar pruebas automatizadas (unitarias, integración) para minimizar falsos positivos.
        *   **Sincronización con el Orquestador**: Establecer canales de comunicación entre el sistema Auto-Fix y el `OrquestadorFlujoAgentes` para asegurar que las correcciones automáticas sean coherentes con los flujos de trabajo activos.
*   **Errores de API LLM**:
    *   **Límites de Tokens/TPM (Tokens Per Minute)**: La aplicación intenta gestionar los errores `429 Too Many Requests` (comunes cuando se exceden los límites de tasa de la API) mediante reintentos automáticos con una estrategia de backoff exponencial (aumentando el tiempo de espera entre reintentos). En funciones como "AutoUpdate", si el código fuente es muy grande, se fragmenta en trozos más pequeños antes de enviarlo a la IA para evitar errores de "payload too large" y también para mitigar el impacto en los límites de tokens por minuto.
    *   **Timeouts**: Las llamadas a las APIs LLM tienen configurados tiempos de espera para evitar que la aplicación se bloquee indefinidamente si la API no responde. Si una solicitud excede este tiempo, se cancela y se informa al usuario.

## Notas Importantes y Consideraciones

*   **Sugerencias de IA**: Las sugerencias de código, refactorización o análisis proporcionadas por la IA deben ser consideradas como recomendaciones. Siempre revisa, comprende y prueba exhaustivamente cualquier cambio antes de aplicarlo a un entorno de producción.
*   **Límites de API y Timeouts**: El uso intensivo de las funcionalidades de IA puede llevar a alcanzar los límites de uso impuestos por los proveedores de API LLM (ej. tokens por minuto, peticiones por minuto). La aplicación intenta manejar esto con reintentos y fragmentación de datos, pero pueden ocurrir interrupciones. En "AutoUpdate", la fragmentación del código y los retrasos entre el procesamiento de fragmentos ayudan a mitigar esto.
*   **Seguridad**:
    *   La función "Aplicar Sugerencia" en la sección "AutoUpdate" modifica directamente los archivos del código fuente de CodeAlchemist. Procede con precaución.
    *   Las capacidades de agente como "Capacidad de Ejecución" o "Capacidad Lectura/Escritura" son intrínsecamente peligrosas si no se gestionan en un entorno seguro y controlado. Habilítalas solo si comprendes los riesgos.
    *   Las claves API se guardan en el almacenamiento local de tu navegador. Aunque esto es conveniente, considera las implicaciones de seguridad si compartes tu navegador o si tu sistema está comprometido.
*   **Costes de API**: El uso de proveedores de IA en la nube (Groq, Google Gemini, OpenAI, Anthropic) puede incurrir en costes económicos dependiendo de tu plan y el volumen de uso. Los modelos LLM locales (LM Studio, Ollama) no incurren en estos costes de API, pero requieren recursos computacionales propios.
*   **Privacidad**: Al usar proveedores de IA en la nube, el código fuente, los prompts y otros datos que introduzcas en CodeAlchemist se envían a los servidores de dichos proveedores. Revisa sus políticas de privacidad y uso de datos. Para máxima privacidad, considera utilizar modelos LLM locales.
*   **Estado de Funcionalidades**: Algunas funcionalidades, especialmente aquellas marcadas como "(Experimental)" o "(Simulado)", pueden estar en etapas tempranas de desarrollo y podrían no comportarse como se espera en todos los casos o no realizar la acción real (ej. "Aplicar Sugerencia (Simulado)" en "Refactorizar Proyecto").

## Diseño (Aspectos Visuales)

CodeAlchemist utiliza una interfaz de usuario moderna y profesional, diseñada para ser intuitiva, funcional y agradable a la vista.

*   **Paleta de Colores Principal**: La aplicación emplea una paleta de colores cuidadosamente seleccionada para asegurar claridad, legibilidad y una estética profesional.
    *   Fondo principal (Background): Un gris claro (`#ECEFF1`, HSL: `210 17% 94%`), que proporciona un lienzo limpio y neutro, minimizando la fatiga visual.
    *   Texto principal (Foreground): Un gris muy oscuro (`HSL: 233 30% 15%`) para ofrecer el máximo contraste y legibilidad sobre el fondo claro.
    *   Color primario (Primary): Un azul oscuro intenso (`#1A237E`, HSL: `233 63% 30%`), utilizado para acciones principales, botones destacados, elementos activos y la marca de la aplicación.
    *   Texto sobre color primario (Primary Foreground): Un gris claro (`HSL: 210 17% 85%`) para asegurar un buen contraste sobre el azul primario.
    *   Color secundario (Secondary): Un gris ligeramente más oscuro que el fondo principal (`HSL: 210 17% 88%`), usado para bordes sutiles, fondos de elementos de entrada (inputs) y elementos menos prominentes.
    *   Texto sobre color secundario (Secondary Foreground): Un gris oscuro (`HSL: 233 30% 20%`).
    *   Color de acento (Accent): Un verde azulado o teal (`#26A69A`, HSL: `174 60% 40%`), utilizado para elementos de énfasis, enlaces, iconos informativos y para destacar ciertas interacciones.
    *   Texto sobre color de acento (Accent Foreground): Un gris oscuro (`HSL: 210 17% 15%`).
    *   Color destructivo (Destructive): Un rojo vibrante (`HSL: 0 84.2% 60.2%`), reservado para acciones de eliminación, mensajes de error críticos y advertencias importantes.
    *   Texto sobre color destructivo (Destructive Foreground): Un gris muy oscuro, casi negro (`HSL: 0 0% 10%`), para garantizar la legibilidad sobre el rojo.
    *   Fondo de tarjetas y popovers (Card/Popover Background): Blanco (`#FFFFFF`, HSL: `0 0% 100%`) para que el contenido de estos elementos resalte claramente.
    *   Texto sobre tarjetas y popovers (Card/Popover Foreground): El mismo gris muy oscuro del texto principal (`HSL: 233 30% 15%`).
    *   Colores Muted (para texto secundario, descripciones menos importantes, fondos de elementos desactivados): Gris claro para fondos (`HSL: 210 17% 90%`) y un gris medio para texto (`HSL: 233 20% 40%`).
    *   Color de bordes generales (Border): Un gris claro (`HSL: 210 17% 85%`), usado para delinear componentes y contenedores.
    *   Color de fondo de campos de entrada (Input Background): El mismo gris claro de los bordes (`HSL: 210 17% 85%`) para una apariencia integrada.
    *   Color de "anillo" de enfoque (Focus Ring): El color de acento teal (`HSL: 174 60% 40%`) se usa para resaltar los elementos que tienen el foco, mejorando la accesibilidad y la navegación por teclado.
*   **Iconografía**:
    *   Se utiliza un conjunto de iconos vectoriales consistentes y limpios (Lucide Icons) para representar las diferentes secciones, acciones y conceptos dentro de la aplicación. Esto asegura claridad visual, una estética cohesiva y escalabilidad sin pérdida de calidad.
    *   El icono principal o logo de la aplicación es una representación estilizada de un matraz de alquimista (`FlaskConical`), simbolizando la transformación, la experimentación y la "alquimia" de convertir ideas y código en soluciones mejoradas y eficientes.
*   **Tipografía**:
    *   Se emplea una fuente sans-serif moderna y altamente legible (Geist Sans) para todo el texto de la interfaz, optimizando la experiencia de lectura y la claridad de la información en diferentes tamaños y densidades de pantalla.
    *   Para la visualización de código y en áreas donde se requiere monoespaciado (como logs o snippets de código), se utiliza una fuente monoespaciada (Geist Mono).
*   **Diseño General y Estructura de Páginas**:
    *   La aplicación presenta un diseño moderno, con una clara jerarquía visual que guía al usuario a través de las diferentes funcionalidades.
    *   Es responsiva, adaptándose a diferentes tamaños de pantalla para una experiencia óptima tanto en escritorio como en dispositivos móviles.
    *   Se utilizan esquinas redondeadas (`rounded-md`, `rounded-lg`) para botones, tarjetas, campos de entrada y otros elementos de la interfaz, aportando una sensación de suavidad y modernidad.
    *   Se aplican sombras sutiles (`shadow-sm`, `shadow-lg`) a elementos como tarjetas y diálogos modales para darles profundidad y destacarlos del fondo, creando una apariencia profesional y pulida.
    *   La disposición de los elementos en cada página está pensada para ser intuitiva. Generalmente, las páginas presentan una `Card` principal que contiene los controles y resultados de la sección. Las entradas de texto (como prompts o código) suelen ser `Textarea` amplias, y los resultados se muestran en áreas de solo lectura o `ScrollArea` para manejar contenido extenso. Los botones de acción principal están claramente visibles.
    *   La barra lateral izquierda proporciona la navegación principal y es colapsable. La ventana de depuración (si está activa) se fija en la parte inferior.

---

¡Gracias por usar CodeAlchemist! Esperamos que esta plataforma te sea de gran utilidad en tus proyectos de desarrollo.

```endregion_README.md
  </content>
  </change>
  <change>
    <file>src/app/(app)/autoupdate/page.tsx</file>
    <content><![CDATA[
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertTriangle, DownloadCloud, FileCode, Wand2, CheckCircle, XCircle, Info, Edit3, Copy, Settings2, ListOrdered, ShieldAlert, GitFork, Trash2, Expand, Minimize, Workflow, Bug, Github } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { handleAutoAnalyzeAppSource, getApplicationSourceBundle, applySuggestedChange, handleGetErrorFixSuggestion, handleUploadToGit, initiateAutoUpdateWorkgroupAnalysis } from './actions';
import type { AppSourceFile } from '@/types/project';
import type { ProjectAnalysisResponse, SuggestionItem } from '@/services/groq';
import type { SuggestErrorFixOutput } from '@/ai/flows/suggest-error-fix-flow';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import JSZip from 'jszip';
import { Label } from '@/components/ui/label';
import { Progress } from "@/components/ui/progress";
import { cn } from '@/lib/utils';
import type { AgentConfig, WorkgroupConfig } from '@/types/agent';
import { resolveLlmOptionsForSource, type LocalStorageSnapshot } from '@/lib/llm-utils';
import { LOCALSTORAGE_AGENTS_KEY, LOCALSTORAGE_WORKGROUPS_KEY, REFACTOR_AGENT_NAME, MAX_WORKGROUP_TURNS, ORCHESTRATOR_AGENT_NAME } from '@/config/agent-config';
import {
    LLM_PROVIDERS,
    LOCALSTORAGE_GIT_REPO_URL_KEY,
    LOCALSTORAGE_GIT_USERNAME_KEY,
    LOCALSTORAGE_GIT_EMAIL_KEY,
    LOCALSTORAGE_GIT_PAT_KEY,
    LOCALSTORAGE_PROVIDER_ID_KEY,
    getLocalStorageApiKeyName,
    getLocalStorageModelName,
    type LLMProviderId
} from '@/config/llm-config';
import { useDebug, type DebugLogEntry } from '@/contexts/DebugContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LLMOptions } from '@/services/groq';


type AutoUpdateStatus = "idle" | "loading_source" | "chunking_source" | "analyzing" | "success" | "error" | "fixing_error" | "uploading_git" | "fixing_git_error";

type SuggestionStatus = "pending" | "applying" | "applied" | "error_applying" | "not_applicable";


// Define the type for a single suggestion item from the response
// Correctly extend the type of an element in the 'suggestions' array
interface SingleSuggestion extends SuggestionItem {
  id?: string; // id might not exist initially, make it optional
  // Add other fields from the base type if needed, e.g.:
  area: string;
  // suggestion: string; // Already in SuggestionItem
  // priority?: 'high' | 'medium' | 'low'; // Already in SuggestionItem
  // suggestedFullFileContent?: string; // Already in SuggestionItem
}


interface SuggestionWithStatus extends SingleSuggestion {
  id: string;
  status: SuggestionStatus;
  errorMessage?: string;
  originalContent?: string; // To store the original content for diff or re-application
}

interface AnalysisProgress {
  processed: number;
  total: number;
}

interface GitConfig {
  repoUrl: string | null;
  username: string | null;
  email: string | null;
  pat: string | null;
}


export default function AutoUpdatePage() {
  const [status, setStatus] = useState<AutoUpdateStatus>("idle");
  const [analysisResult, setAnalysisResult] = useState<ProjectAnalysisResponse | null>(null);
  const [currentAnalysisError, setCurrentAnalysisError] = useState<string | null>(null);
  const [suggestionsWithStatus, setSuggestionsWithStatus] = useState<SuggestionWithStatus[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [projectFiles, setProjectFiles] = useState<AppSourceFile[]>([]);
  const [analysisPreferences, setAnalysisPreferences] = useState<string>("");
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress>({ processed: 0, total: 0 });
  const [autoFixSuggestion, setAutoFixSuggestion] = useState<SuggestErrorFixOutput | null>(null);
  const [isAutoFixModalOpen, setIsAutoFixModalOpen] = useState(false);
  const [detailedLogs, setDetailedLogs] = useState<string[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(false);

  const { addDebugLog } = useDebug();

  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [workgroups, setWorkgroups] = useState<WorkgroupConfig[]>([]);
  const [gitSourceUrl, setGitSourceUrl] = useState<string>("");
  const [selectedConfigSource, setSelectedConfigSource] = useState<string>('');
  const [currentLlmOptions, setCurrentLlmOptions] = useState<LLMOptions | null>(null);

  const [gitConfig, setGitConfig] = useState<GitConfig>({ repoUrl: null, username: null, email: null, pat: null });
  const [gitUploadRetryCount, setGitUploadRetryCount] = useState(0);
  const MAX_GIT_UPLOAD_RETRIES = 5;
  const [currentGitError, setCurrentGitError] = useState<string | null>(null);

  const isMountedRef = useRef(false);


  const { toast } = useToast();

  useEffect(() => {
    isMountedRef.current = true;
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: 'Componente AutoUpdatePage montado.' });

    let loadedAgents: AgentConfig[] = [];
    const storedAgents = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
    if (storedAgents) {
      try {
        loadedAgents = JSON.parse(storedAgents);
        setAgents(loadedAgents);
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'DEBUG', message: 'Agentes cargados desde localStorage.', data: { count: loadedAgents.length } });
      } catch (e) {
        console.error("Error parsing stored agents:", e);
        setAgents([]);
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: 'Error al parsear agentes de localStorage.', data: e });
      }
    } else {
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'WARN', message: 'No se encontraron agentes en localStorage.' });
    }

    const storedWorkgroups = localStorage.getItem(LOCALSTORAGE_WORKGROUPS_KEY);
    if (storedWorkgroups) {
        try { setWorkgroups(JSON.parse(storedWorkgroups)); } catch (e) { console.error("Error parsing stored workgroups:", e); setWorkgroups([]); addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: 'Error al parsear grupos de localStorage.', data: e});}
    }

    const refactorAgent = loadedAgents.find(a => a.name === REFACTOR_AGENT_NAME);
    if (refactorAgent) {
      setSelectedConfigSource(`agent:${refactorAgent.id}`);
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Fuente de configuración por defecto establecida a: Agente ${REFACTOR_AGENT_NAME}` });
    } else {
      // Attempt to find a group that contains the RefactorAgent (if it were to exist) and an Orchestrator
      const suitableGroup = workgroups.find(wg =>
        wg.agentIds.some(id => loadedAgents.find(a => a.id === id)?.name === REFACTOR_AGENT_NAME) &&
        wg.agentIds.some(id => loadedAgents.find(a => a.id === id)?.name === ORCHESTRATOR_AGENT_NAME)
      );
      if (suitableGroup) {
        setSelectedConfigSource(`workgroup:${suitableGroup.id}`);
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Fuente de configuración por defecto establecida a: Grupo ${suitableGroup.name}` });
      } else {
        setSelectedConfigSource('global'); // Fallback to global if no specific agent or suitable group is found
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'WARN', message: `Agente ${REFACTOR_AGENT_NAME} no encontrado ni un grupo adecuado. Se usará la configuración global por defecto.` });
      }
    }


    setGitConfig({
      repoUrl: localStorage.getItem(LOCALSTORAGE_GIT_REPO_URL_KEY),
      username: localStorage.getItem(LOCALSTORAGE_GIT_USERNAME_KEY),
      email: localStorage.getItem(LOCALSTORAGE_GIT_EMAIL_KEY),
      pat: localStorage.getItem(LOCALSTORAGE_GIT_PAT_KEY),
    });

    return () => {
      isMountedRef.current = false;
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: 'Componente AutoUpdatePage desmontado.' });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addDebugLog]); // Removed workgroups from dependency array, as it's loaded inside and might cause loop if setSelectedConfigSource triggers re-render

  useEffect(() => {
    if (!selectedConfigSource) return;

    const localStorageSnapshot: LocalStorageSnapshot = {
      [LOCALSTORAGE_PROVIDER_ID_KEY]: typeof window !== 'undefined' ? localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null : null,
      apiKeys: LLM_PROVIDERS.reduce((acc, p) => { acc[p.id] = typeof window !== 'undefined' ? localStorage.getItem(getLocalStorageApiKeyName(p.id)) : null; return acc; }, {} as LocalStorageSnapshot['apiKeys']),
      modelNames: LLM_PROVIDERS.reduce((acc, p) => { acc[p.id] = typeof window !== 'undefined' ? localStorage.getItem(getLocalStorageModelName(p.id)) : null; return acc; }, {} as LocalStorageSnapshot['modelNames']),
      apiUrls: LLM_PROVIDERS.reduce((acc, p) => { acc[p.id] = typeof window !== 'undefined' ? localStorage.getItem(`codealchemist_apiurl_${p.id}`) : null; return acc; }, {} as LocalStorageSnapshot['apiUrls']),
    };
    const options = resolveLlmOptionsForSource(selectedConfigSource, agents, workgroups, localStorageSnapshot);
    setCurrentLlmOptions(options);
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'DEBUG', message: `Opciones LLM resueltas para ${getSourceName(selectedConfigSource)}`, data: options });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConfigSource, agents, workgroups]);

  const addServerLogsToDebugAndPage = useCallback((serverLogs: string[] | undefined, sourcePrefix: string = 'SERVER_AUTOUDDATE') => {
    if (serverLogs) {
      setDetailedLogs(prev => [...prev, ...serverLogs]);
      if (isMountedRef.current) {
          serverLogs.forEach(logMsg => {
              const match = logMsg.match(/^\[(.*?)\]\s\[(.*?)\]\s(.*?)(?:\s\|\sData:\s(.*))?$/) ||
                            logMsg.match(/^\[(.*?)\s(.*?)]\s\[(.*?)\]\s(.*?)(?:\s\|\sData:\s(.*))?$/) ||
                            logMsg.match(/^\[(.*?)\]\s\[(.*?)\]\s(.*?)(?:\s\|\sData:\s(.*))?$/);

              let parsedLog: Omit<DebugLogEntry, 'timestamp'>;

              if (match && match.length >= 5) {
                  let source = sourcePrefix;
                  let type: DebugLogEntry['type'] = 'INFO';
                  let message = '';
                  let dataStr: string | undefined = undefined;

                  if (match[0].startsWith(`[${sourcePrefix}`)) {
                      source = match[1];
                      type = match[3].toUpperCase() as DebugLogEntry['type'];
                      message = match[4];
                      dataStr = match[5];
                  } else {
                      type = match[2].toUpperCase() as DebugLogEntry['type'];
                      message = match[3];
                      dataStr = match[4];
                  }

                  let data: any = undefined;
                  if (dataStr) {
                      try {
                          data = JSON.parse(dataStr);
                      } catch {
                          data = dataStr;
                      }
                  }
                  parsedLog = { source, type, message, data };
              } else {

                  parsedLog = { source: sourcePrefix, type: 'INFO', message: logMsg };
              }
              addDebugLog(parsedLog);
          });
      }
    }
  }, [addDebugLog]);


  const processAnalysisResult = useCallback((data: ProjectAnalysisResponse) => {
    setAnalysisResult(data);
    const initialSuggestions = (data.suggestions || []).map((s, index) => {
      const relatedFile = projectFiles?.find(f => {
        if (!s.area) return false;
        const normalizePath = (p: string) => p.replace(/^\.\//, '').replace(/^src\//, '');
        const areaLower = normalizePath(s.area.toLowerCase());
        const fileNameLower = normalizePath(f.fileName.toLowerCase());
        const baseAreaLower = areaLower.split(' (parte ')[0];
        return fileNameLower === baseAreaLower;
      });
      let currentStatus: SuggestionStatus = "pending";
      if (!s.area || !s.suggestedFullFileContent || !relatedFile?.content) {
        currentStatus = "not_applicable";
      }
      return { ...s, id: `suggestion-${index}-${Date.now()}`, status: currentStatus, originalContent: relatedFile?.content };
    });
    setSuggestionsWithStatus(initialSuggestions as SuggestionWithStatus[]);
    setStatus("success");
    toast({ title: "Análisis Completado", description: `Se han generado sugerencias.` });
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: 'Análisis completado y resultados procesados en UI.', data });
  }, [projectFiles, toast, addDebugLog]);

  const handleStartAutoAnalysis = async (isRetry: boolean = false) => {
    setDetailedLogs([]);
    const isWorkgroupMode = selectedConfigSource.startsWith('workgroup:');

    if (!selectedConfigSource) {
        const errorMsg = `Por favor, selecciona una fuente de configuración LLM (Agente o Grupo).`;
        toast({ title: "Error de Configuración LLM", description: errorMsg, variant: "destructive", duration: 7000 });
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Auto-Análisis fallido: ${errorMsg}` });
        return;
    }


    if (!isWorkgroupMode && !currentLlmOptions) {
        const errorMsg = `La configuración LLM para '${getSourceName(selectedConfigSource)}' está incompleta o no es válida.`;
        toast({ title: "Error de Configuración LLM", description: errorMsg, variant: "destructive", duration: 7000 });
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Auto-Análisis fallido: ${errorMsg}` });
        return;
    }
    if (isWorkgroupMode) {
        const workgroupId = selectedConfigSource.split(':')[1];
        const workgroup = workgroups.find(wg => wg.id === workgroupId);
        if (!workgroup) {
            const errorMsg = `Grupo de trabajo '${getSourceName(selectedConfigSource)}' no encontrado.`;
            toast({ title: "Error de Configuración de Grupo", description: errorMsg, variant: "destructive", duration: 7000 });
            addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Auto-Análisis fallido: ${errorMsg}` });
            return;
        }
        const orchestratorInGroup = agents.find(a => a.name === ORCHESTRATOR_AGENT_NAME && workgroup.agentIds.includes(a.id));
        if (!orchestratorInGroup) {
            const errorMsg = `Grupo de trabajo '${workgroup.name}' no tiene un Orquestador (${ORCHESTRATOR_AGENT_NAME}) asignado o el orquestador no existe.`;
            toast({ title: "Error de Configuración de Grupo", description: errorMsg, variant: "destructive", duration: 7000 });
            addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Auto-Análisis fallido: ${errorMsg}` });
            return;
        }
    }


    if (!isRetry) {
       addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Iniciando nuevo Auto-Análisis con ${getSourceName(selectedConfigSource)}. Limpiando logs previos.` });
    } else {
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Reintentando análisis con ${getSourceName(selectedConfigSource)}...` });
    }

    setStatus("loading_source");
    setAnalysisResult(null);
    setCurrentAnalysisError(null);
    setCurrentGitError(null);
    setSuggestionsWithStatus([]);
    setAnalysisProgress({ processed: 0, total: 0 });
    setAutoFixSuggestion(null);
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: "Paso 1: Obteniendo código fuente de la aplicación..."});

    toast({
      title: isRetry ? "Reintentando Auto-Análisis" : "Auto-Análisis Iniciado",
      description: `Paso 1: Cargando y preparando el código fuente... ${gitSourceUrl ? `desde ${gitSourceUrl}` : '(local)'}`
    });

    const bundleResult = await getApplicationSourceBundle(true, undefined, gitSourceUrl || undefined);
    addServerLogsToDebugAndPage(bundleResult.logsBuilt, 'SERVER_SOURCE_BUNDLE');

    if (!bundleResult.success || !bundleResult.files || !bundleResult.concatenatedSource) {
      const errorMsg = bundleResult.error || "No se pudo obtener el código fuente para analizar.";
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Error en Paso 1: ${errorMsg}`});
      handleAnalysisError(errorMsg);
      return;
    }
    setProjectFiles(bundleResult.files);
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Paso 1 completado. ${bundleResult.files?.length || 'Varios'} archivos obtenidos. Contenido concatenado: ${bundleResult.concatenatedSource.length} caracteres.`});


    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Paso 2: Iniciando análisis del código concatenado.`});
    setStatus("analyzing");

    let analysisActionResult;
    let finalAnalysisPreferences = analysisPreferences || "Priorizar la calidad del código, mantenibilidad y buenas prácticas. Todas las sugerencias deben estar en castellano.";
    if (!finalAnalysisPreferences.toLowerCase().includes("castellano") && !finalAnalysisPreferences.toLowerCase().includes("español")) {
        finalAnalysisPreferences += " Todas las sugerencias deben estar en castellano.";
    }


    if (isWorkgroupMode) {
      const workgroupId = selectedConfigSource.split(':')[1];
      const localStorageSnapshot: LocalStorageSnapshot = {
        [LOCALSTORAGE_PROVIDER_ID_KEY]: typeof window !== 'undefined' ? localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null : null,
        apiKeys: LLM_PROVIDERS.reduce((acc, p) => { acc[p.id] = typeof window !== 'undefined' ? localStorage.getItem(getLocalStorageApiKeyName(p.id)) : null; return acc; }, {} as LocalStorageSnapshot['apiKeys']),
        modelNames: LLM_PROVIDERS.reduce((acc, p) => { acc[p.id] = typeof window !== 'undefined' ? localStorage.getItem(getLocalStorageModelName(p.id)) : null; return acc; }, {} as LocalStorageSnapshot['modelNames']),
        apiUrls: LLM_PROVIDERS.reduce((acc, p) => { acc[p.id] = typeof window !== 'undefined' ? localStorage.getItem(`codealchemist_apiurl_${p.id}`) : null; return acc; }, {} as LocalStorageSnapshot['apiUrls']),
      };
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Iniciando análisis con grupo de trabajo ${workgroupId}. Preferencias: "${finalAnalysisPreferences}"`});
      analysisActionResult = await initiateAutoUpdateWorkgroupAnalysis({
        sourceFiles: bundleResult.files,
        concatenatedSource: bundleResult.concatenatedSource,
        gitRepoUrl: gitSourceUrl || undefined,
        workgroupId,
        analysisPreferences: finalAnalysisPreferences,
        agents,
        workgroups,
        localStorageSnapshot
      });
      addServerLogsToDebugAndPage(analysisActionResult.workgroupLogs, 'SERVER_WG_AUTO_ANALYZE');
    } else if (currentLlmOptions) {
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Iniciando análisis directo con ${currentLlmOptions.providerId} - ${currentLlmOptions.modelName}. Preferencias: "${finalAnalysisPreferences}"`});
      analysisActionResult = await handleAutoAnalyzeAppSource(
          bundleResult.files,
          currentLlmOptions.providerId,
          currentLlmOptions.apiKey,
          currentLlmOptions.modelName,
          currentLlmOptions.apiUrl,
          finalAnalysisPreferences,
          gitSourceUrl || undefined
      );
      addServerLogsToDebugAndPage(analysisActionResult.detailedExecutionLogs, 'SERVER_AUTO_ANALYZE');
      setAnalysisProgress({ processed: analysisActionResult.chunksProcessed || 0, total: analysisActionResult.totalChunks || 0 });
    } else {
       handleAnalysisError("Error interno: Configuración LLM no disponible para análisis directo.");
       return;
    }


    if (analysisActionResult.success && analysisActionResult.data) {
        processAnalysisResult(analysisActionResult.data);
    } else {
        handleAnalysisError(analysisActionResult.error);
    }
  };

  const handleAnalysisError = (errorMsg: string | undefined) => {
    setStatus("error");
    const finalErrorMsg = errorMsg || "Ocurrió un error desconocido durante el auto-análisis.";
    setCurrentAnalysisError(finalErrorMsg);
    setCurrentGitError(null);
    toast({ title: "Error en Auto-Análisis", description: finalErrorMsg, variant: "destructive", duration: 10000 });
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Error en auto-análisis: ${finalErrorMsg}` });
  };


  const handleAttemptAutoFix = async (errorToFix?: string | null, errorContext?: string) => {
    const targetError = errorToFix || currentAnalysisError || currentGitError;
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: 'Intentando auto-corrección.', data: { error: targetError, context: errorContext }});

    let llmOptionsForFix = currentLlmOptions;

    if (selectedConfigSource.startsWith('workgroup:')) {
        const workgroupId = selectedConfigSource.split(':')[1];
        const workgroup = workgroups.find(wg => wg.id === workgroupId);
        const orchestrator = workgroup ? agents.find(a => a.name === ORCHESTRATOR_AGENT_NAME && workgroup.agentIds.includes(a.id)) : undefined;

        if (orchestrator) {
            const snapshot: LocalStorageSnapshot = {
                [LOCALSTORAGE_PROVIDER_ID_KEY]: localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null,
                apiKeys: {}, modelNames: {}, apiUrls: {}
            };
            LLM_PROVIDERS.forEach(p => {
                snapshot.apiKeys[p.id] = localStorage.getItem(getLocalStorageApiKeyName(p.id));
                snapshot.modelNames[p.id] = localStorage.getItem(getLocalStorageModelName(p.id));
                snapshot.apiUrls[p.id] = localStorage.getItem(`codealchemist_apiurl_${p.id}`);
            });
            llmOptionsForFix = resolveLlmOptionsForSource(`agent:${orchestrator.id}`, agents, workgroups, snapshot);
        } else {
            // Fallback to global if orchestrator specific options can't be resolved
             const snapshot: LocalStorageSnapshot = {
                [LOCALSTORAGE_PROVIDER_ID_KEY]: localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null,
                apiKeys: {}, modelNames: {}, apiUrls: {}
             };
             LLM_PROVIDERS.forEach(p => {
                snapshot.apiKeys[p.id] = localStorage.getItem(getLocalStorageApiKeyName(p.id));
                snapshot.modelNames[p.id] = localStorage.getItem(getLocalStorageModelName(p.id));
                snapshot.apiUrls[p.id] = localStorage.getItem(`codealchemist_apiurl_${p.id}`);
             });
            llmOptionsForFix = resolveLlmOptionsForSource('global', agents, workgroups, snapshot);
            addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'WARN', message: `No se pudo resolver LLM para orquestador del grupo ${getSourceName(selectedConfigSource)}, usando config global para Auto-Fix.`});
        }
    } else if (!llmOptionsForFix) { // If not workgroup and still no options (e.g. global incomplete)
         const snapshot: LocalStorageSnapshot = {
            [LOCALSTORAGE_PROVIDER_ID_KEY]: localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null,
            apiKeys: {}, modelNames: {}, apiUrls: {}
         };
         LLM_PROVIDERS.forEach(p => {
            snapshot.apiKeys[p.id] = localStorage.getItem(getLocalStorageApiKeyName(p.id));
            snapshot.modelNames[p.id] = localStorage.getItem(getLocalStorageModelName(p.id));
            snapshot.apiUrls[p.id] = localStorage.getItem(`codealchemist_apiurl_${p.id}`);
         });
        llmOptionsForFix = resolveLlmOptionsForSource('global', agents, workgroups, snapshot);
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'WARN', message: `LLM para ${getSourceName(selectedConfigSource)} no resuelto, usando config global para Auto-Fix.`});
    }


    if (!llmOptionsForFix) {
      const errorMsg = `Configuración LLM para '${getSourceName(selectedConfigSource)}' (o global como fallback) no resuelta o inválida para Auto-Fix.`;
      toast({ title: "Error de Configuración LLM", description: errorMsg, variant: "destructive" });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Auto-corrección fallida: ${errorMsg}`});
      return;
    }

    if (!targetError) {
      toast({ title: "Información Faltante", description: "No hay error actual para corregir.", variant: "destructive" });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'WARN', message: 'Auto-corrección solicitada sin error activo.'});
      return;
    }

    const prevStatus = status;
    let fixingStatus: AutoUpdateStatus = currentGitError ? "fixing_git_error" : "fixing_error";
    setStatus(fixingStatus);
    setAutoFixSuggestion(null);


    toast({ title: "Intentando Auto-Corrección", description: `Consultando a ${llmOptionsForFix.providerId} para una posible solución...` });
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Consultando a ${llmOptionsForFix.providerId} para auto-corrección.`});

    const tempLogsForAction: string[] = [];
    const fixResult = await handleGetErrorFixSuggestion(
      targetError,
      llmOptionsForFix.providerId,
      llmOptionsForFix.apiKey,
      llmOptionsForFix.modelName,
      llmOptionsForFix.apiUrl,
      tempLogsForAction,
      errorContext
    );
    addServerLogsToDebugAndPage(tempLogsForAction, 'SERVER_ERROR_FIX');


    if (fixResult.success && fixResult.data) {
      setAutoFixSuggestion(fixResult.data);
      setIsAutoFixModalOpen(true);
      toast({ title: "Sugerencia de Corrección Recibida", description: `La IA (${llmOptionsForFix.providerId}) ha proporcionado una sugerencia.` });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Sugerencia de corrección recibida de la IA.`, data: fixResult.data });
    } else {
      toast({ title: "Error en Auto-Corrección", description: fixResult.error || `No se pudo obtener sugerencia.`, variant: "destructive" });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Error al obtener sugerencia de corrección: ${fixResult.error || "Desconocido"}`, data: fixResult });
    }
    setStatus(prevStatus === "fixing_error" || prevStatus === "fixing_git_error"
        ? (currentAnalysisError || currentGitError ? "error" : (analysisResult ? "success" : "idle"))
        : prevStatus);
  };

  const handleApplySuggestion = async (suggestionId: string) => {
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Intentando aplicar sugerencia ID: ${suggestionId}`});
    const suggestionIndex = suggestionsWithStatus.findIndex(s => s.id === suggestionId);
    if (suggestionIndex === -1) {
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `No se encontró la sugerencia con ID: ${suggestionId}`});
      return;
    }
    const suggestionToApply = suggestionsWithStatus[suggestionIndex];

    if (!suggestionToApply.area || !suggestionToApply.originalContent || !suggestionToApply.suggestedFullFileContent) {
      const missingField = !suggestionToApply.area ? "nombre de archivo" : !suggestionToApply.originalContent ? "contenido original" : "contenido sugerido";
      toast({ title: "Error de Aplicación", description: `Falta ${missingField} para ${suggestionToApply.area || 'esta sugerencia'}.`, variant: "destructive" });
      setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? { ...s, status: "error_applying", errorMessage: `Falta ${missingField}.` } : s));
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Falta ${missingField} para sugerencia ID: ${suggestionId}`});
      return;
    }

    setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? { ...s, status: "applying" } : s));
    toast({ title: "Aplicando Sugerencia...", description: `Aplicando cambio a ${suggestionToApply.area}` });
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Estado: 'applying'. Llamando a applySuggestedChange para ${suggestionToApply.area}.`});

    const baseFilePath = suggestionToApply.area.includes(" (parte ") ? suggestionToApply.area.split(" (parte ")[0] : suggestionToApply.area;
    const tempLogsForAction: string[] = [];
    const result = await applySuggestedChange(baseFilePath, suggestionToApply.originalContent, suggestionToApply.suggestedFullFileContent, tempLogsForAction);
    addServerLogsToDebugAndPage(tempLogsForAction, 'SERVER_APPLY_SUGGESTION');

    if (result.success && result.newContent !== undefined) {
      setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? { ...s, status: "applied", originalContent: result.newContent! } : s));
      toast({ title: "Sugerencia Aplicada", description: `El cambio para ${baseFilePath} se ha aplicado.` });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Sugerencia aplicada a ${baseFilePath}.`, data: { newContentLength: result.newContent.length } });
      setProjectFiles(prevFiles => (prevFiles || []).map(pf => {
        const normalizePath = (p: string) => p.replace(/^\.\//, '').replace(/^src\//, '');
        if (normalizePath(pf.fileName.toLowerCase()) === normalizePath(baseFilePath.toLowerCase())) {
          addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'DEBUG', message: `Actualizando contenido en projectFiles para ${pf.fileName}.`});
          return { ...pf, content: result.newContent! };
        }
        return pf;
      }));
    } else {
      setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? { ...s, status: "error_applying", errorMessage: result.error } : s));
      toast({ title: "Error al Aplicar", description: result.error || `No se pudo aplicar el cambio a ${baseFilePath}.`, variant: "destructive" });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Error al aplicar sugerencia a ${baseFilePath}: ${result.error}`});
    }
  };

 const handleDownloadSource = async (format: 'zip' | 'json' = 'zip') => {
    setIsDownloading(true);
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Iniciando preparación para descarga de código fuente en formato ${format.toUpperCase()}.`});
    toast({ title: "Preparando Descarga", description: `Recopilando archivos fuente para formato ${format.toUpperCase()}...` });

    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Obteniendo el paquete de código fuente más reciente para la descarga...`});
    const tempLogsForBundle: string[] = [];
    const bundleResult = await getApplicationSourceBundle(false, tempLogsForBundle, gitSourceUrl || undefined);
    addServerLogsToDebugAndPage(tempLogsForBundle, 'SERVER_DOWNLOAD_BUNDLE');

    let filesToProcess: AppSourceFile[] = [];
    if (bundleResult.success && bundleResult.files) {
      filesToProcess = bundleResult.files;
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Paquete de código fuente más reciente obtenido con ${filesToProcess.length} archivos.`});
    } else {
      toast({ title: "Error al Obtener Código", description: bundleResult.error || "No se pudo obtener el código fuente actualizado.", variant: "destructive" });
      setIsDownloading(false);
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Error al obtener código para ${format.toUpperCase()}: ${bundleResult.error}`});
      return;
    }

    if (filesToProcess && filesToProcess.length > 0) {
      try {
        let blob: Blob;
        let downloadFileName: string;

        if (format === 'zip') {
          const zip = new JSZip();
          filesToProcess.forEach(file => {
            if (file.fileName && file.fileName.trim() !== "" && !file.content.startsWith("// Archivo binario") && !file.content.startsWith("// Error:")) {
              zip.file(file.fileName, file.content);
            } else {
              addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'WARN', message: `Omitido en ZIP (nombre vacío, binario o error): ${file.fileName}`});
            }
          });
          blob = await zip.generateAsync({ type: "blob" });
          downloadFileName = 'CodeAlchemist-source.zip';
        } else {
          const jsonData = JSON.stringify(filesToProcess, null, 2);
          blob = new Blob([jsonData], { type: 'application/json;charset=utf-8' });
          downloadFileName = 'CodeAlchemist-source.json';
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Descarga Iniciada", description: `El paquete de código fuente (${format.toUpperCase()}) se está descargando.` });
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Descarga ${format.toUpperCase()} iniciada.`});
      } catch (e) {
        const error = e instanceof Error ? e.message : "Error desconocido";
        toast({ title: `Error al Crear Descarga ${format.toUpperCase()}`, description: `No se pudo crear el archivo ${format.toUpperCase()}: ${error}`, variant: "destructive" });
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Error al crear ${format.toUpperCase()}: ${error}`});
      }
    } else {
      toast({ title: "Error al Obtener Código", description: "No se encontraron archivos para empaquetar.", variant: "destructive" });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Error: No se encontraron archivos para ${format.toUpperCase()}.`});
    }
    setIsDownloading(false);
  };

  const performGitUpload = async (isRetry: boolean = false) => {
    const { repoUrl, username, email, pat } = gitConfig;
    if (!repoUrl || !username || !email || !pat) {
      toast({ title: "Configuración Git Incompleta", description: "Completa la configuración en Ajustes.", variant: "destructive" });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: 'Subida a Git fallida: Configuración incompleta.'});
      setStatus(analysisResult ? "success" : "idle");
      return;
    }
    setCurrentGitError(null);
    setCurrentAnalysisError(null);
    setStatus("uploading_git");
    setDetailedLogs(prev => [...prev, `[${new Date().toISOString()}] [INFO] Iniciando subida a Git...`]);

    const attemptNumber = isRetry ? gitUploadRetryCount + 1 : 1;
    if (isRetry) setGitUploadRetryCount(attemptNumber);

    const commitMsg = `CodeAlchemist: AutoUpdate Sync (Attempt ${attemptNumber} - ${new Date().toISOString()})`;
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `${isRetry ? `Reintentando (${attemptNumber}/${MAX_GIT_UPLOAD_RETRIES})` : 'Iniciando'} subida a Git...`, data: { repoUrl, commitMsg }});
    toast({ title: `${isRetry ? `Reintentando Subida Git (${attemptNumber})` : "Subiendo a Git..."}`, description: `Intentando subir a ${repoUrl.split('/').pop()?.replace('.git', ' ')}` });

    const tempLogsForAction: string[] = [];
    const result = await handleUploadToGit({ repoUrl, username, email, pat }, commitMsg, tempLogsForAction);
    addServerLogsToDebugAndPage(tempLogsForAction, 'SERVER_GIT_UPLOAD');

    if (result.success) {
      toast({ title: "Subida a Git Exitosa", description: result.message, duration: 7000 });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: 'Subida a Git exitosa.', data: result });
      setGitUploadRetryCount(0);
      setStatus(analysisResult ? "success" : "idle");
    } else {
      setCurrentGitError(result.message);
      toast({
        title: `Error en Subida a Git${isRetry ? ` (Intento ${attemptNumber})` : ''}`,
        description: result.message, variant: "destructive", duration: 10000,
        action: (attemptNumber < MAX_GIT_UPLOAD_RETRIES) ? (
          <Button variant="outline" size="sm" className="ml-auto border-destructive/50 text-destructive hover:bg-destructive/20 hover:text-destructive-foreground"
            onClick={() => handleAttemptAutoFix(result.message, "Error durante subida a Git.")}>
            <Settings2 className="mr-2 h-4 w-4" /> Auto-Fix
          </Button>
        ) : undefined
      });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Error en subida a Git: ${result.message}`, data: result });
      setStatus("error");
    }
  };
  const handleInitialGitUpload = () => { setGitUploadRetryCount(0); performGitUpload(false); };
  const handleRetryGitUploadFromModal = () => { setIsAutoFixModalOpen(false); performGitUpload(true); };

  const isProcessing = ["analyzing", "loading_source", "chunking_source", "fixing_error", "uploading_git", "fixing_git_error"].includes(status);
  const isGitConfigured = gitConfig.repoUrl && gitConfig.username && gitConfig.email && gitConfig.pat;

  const sourceDescription = gitSourceUrl ? `Git: ${gitSourceUrl.split('/').pop() || gitSourceUrl}` : 'Local';

  const getSourceName = (sourceId: string): string => {
    if (!sourceId) return 'Seleccionar fuente';

    if (sourceId === 'global') return 'Global (Ajustes Generales)';

    const refactorAgent = agents.find(a => a.name === REFACTOR_AGENT_NAME);
    if (sourceId === `agent:${refactorAgent?.id}`) return `Agente: ${REFACTOR_AGENT_NAME} (Por defecto)`;

    if (sourceId.startsWith('agent:')) {
      const agentId = sourceId.split(':')[1];
      return agents.find(a => a.id === agentId)?.name || `Agente ${agentId.substring(0,6)}...`;
    }
    if (sourceId.startsWith('workgroup:')) {
      const workgroupId = sourceId.split(':')[1];
      return workgroups.find(wg => wg.id === workgroupId)?.name || `Grupo ${workgroupId.substring(0,6)}...`;
    }
    return `Desconocido (${sourceId})`;
  };

  let llmConfigDisplayStatus = "";
  const isWorkgroupSelected = selectedConfigSource.startsWith('workgroup:');

  if (!selectedConfigSource) {
    llmConfigDisplayStatus = "Error: Por favor, selecciona un Agente o Grupo para el análisis.";
  } else if (!isWorkgroupSelected && !currentLlmOptions) {
    llmConfigDisplayStatus = `Error: Configuración LLM para '${getSourceName(selectedConfigSource)}' incompleta.`;
  } else if (!isWorkgroupSelected && currentLlmOptions) {
    llmConfigDisplayStatus = `Análisis con: ${getSourceName(selectedConfigSource)} (${currentLlmOptions.providerId} - ${currentLlmOptions.modelName})`;
  } else if (isWorkgroupSelected) {
      const workgroupId = selectedConfigSource.split(':')[1];
      const workgroup = workgroups.find(wg => wg.id === workgroupId);
      if (workgroup) {
        const orchestrator = agents.find(a => a.name === ORCHESTRATOR_AGENT_NAME && workgroup.agentIds.includes(a.id));
        if (orchestrator) {
             const localStorageSnapshot: LocalStorageSnapshot = {
                [LOCALSTORAGE_PROVIDER_ID_KEY]: localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null,
                apiKeys: {}, modelNames: {}, apiUrls: {}
             };
             LLM_PROVIDERS.forEach(p => {
                localStorageSnapshot.apiKeys[p.id] = localStorage.getItem(getLocalStorageApiKeyName(p.id));
                localStorageSnapshot.modelNames[p.id] = localStorage.getItem(getLocalStorageModelName(p.id));
                localStorageSnapshot.apiUrls[p.id] = localStorage.getItem(`codealchemist_apiurl_${p.id}`);
             });
             const orchestratorOptions = resolveLlmOptionsForSource(`agent:${orchestrator.id}`, agents, workgroups, localStorageSnapshot);
             if (orchestratorOptions) {
                llmConfigDisplayStatus = `Análisis con Grupo: ${workgroup.name} (Orquestador usa: ${orchestratorOptions.providerId} - ${orchestratorOptions.modelName})`;
             } else {
                llmConfigDisplayStatus = `Error: Configuración LLM para Orquestador del grupo '${workgroup.name}' incompleta.`;
             }
        } else {
            llmConfigDisplayStatus = `Error: Grupo '${workgroup.name}' no tiene Orquestador (${ORCHESTRATOR_AGENT_NAME}) asignado.`;
        }
      } else {
        llmConfigDisplayStatus = `Error: Grupo '${getSourceName(selectedConfigSource)}' no encontrado.`;
      }
  }

  const refactorAgentInstance = agents.find(a => a.name === REFACTOR_AGENT_NAME);
  const filteredWorkgroups = workgroups.filter(wg =>
    wg.agentIds.some(id => agents.find(a => a.id === id)?.name === REFACTOR_AGENT_NAME) &&
    wg.agentIds.some(agentId => agents.find(a => a.id === agentId)?.name === ORCHESTRATOR_AGENT_NAME)
  );


  return (
    <> {/* Added Fragment */}
      <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center gap-2">
            <Sparkles className="h-8 w-8" />
            AutoUpdate: Análisis de CodeAlchemist
          </CardTitle>
          <CardDescription className="text-lg text-foreground">
            Analiza el código fuente de CodeAlchemist (local o desde Git) usando un agente o grupo de trabajo especializado.
            <span className={cn("block mt-1", (llmConfigDisplayStatus.startsWith("Error:")) ? "text-destructive" : "text-foreground")}>
                {llmConfigDisplayStatus}
            </span>
             <span className="text-foreground block mt-1">(Fuente actual: {sourceDescription})</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
             <div className="space-y-2">
                <Label htmlFor="configSourceAutoUpdate" className="text-base flex items-center gap-1"><Settings2 className="h-4 w-4"/> Usar para Análisis:</Label>
                <Select onValueChange={setSelectedConfigSource} value={selectedConfigSource}>
                    <SelectTrigger id="configSourceAutoUpdate" className="w-full">
                        <SelectValue placeholder="Seleccionar Agente o Grupo" />
                    </SelectTrigger>
                    <SelectContent>
                        <ScrollArea className="h-[--radix-select-content-available-height] max-h-60">
                            <SelectItem value="global">Global (Ajustes Generales)</SelectItem>
                            {refactorAgentInstance && (
                                <SelectItem value={`agent:${refactorAgentInstance.id}`}>
                                    Agente: {REFACTOR_AGENT_NAME} (Recomendado)
                                </SelectItem>
                            )}
                            {filteredWorkgroups.map(wg => (
                                <SelectItem key={`workgroup:${wg.id}`} value={`workgroup:${wg.id}`}>
                                    Grupo: {wg.name} (Contiene {REFACTOR_AGENT_NAME})
                                </SelectItem>
                            ))}
                            {agents.filter(a => a.name !== REFACTOR_AGENT_NAME).map(agent => (
                                <SelectItem key={`agent:${agent.id}`} value={`agent:${agent.id}`}>
                                    Agente: {agent.name}
                                </SelectItem>
                            ))}
                             {workgroups.filter(wg => !filteredWorkgroups.find(fwg => fwg.id === wg.id)).map(wg => (
                                <SelectItem key={`workgroup:${wg.id}`} value={`workgroup:${wg.id}`}>
                                    Grupo: {wg.name}
                                </SelectItem>
                            ))}
                        </ScrollArea>
                    </SelectContent>
                </Select>
                {(!selectedConfigSource && !refactorAgentInstance) &&
                    <p className="text-xs text-destructive mt-1">Por favor, crea el agente '{REFACTOR_AGENT_NAME}' o selecciona una fuente de configuración.</p>
                }
             </div>
             <div className="space-y-2">
              <Label htmlFor="gitSourceUrl" className="text-base flex items-center gap-1"><Github className="h-4 w-4" /> URL del Repositorio Git (Opcional)</Label>
              <Input
                id="gitSourceUrl"
                type="url"
                value={gitSourceUrl}
                onChange={(e) => setGitSourceUrl(e.target.value)}
                placeholder="Ej: https://github.com/usuario/repo.git (deja vacío para local)"
                className="bg-card text-foreground"
              />
              <p className="text-xs text-muted-foreground">Si se proporciona, se analizará este repositorio en lugar del código local.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="analysis-preferences" className="text-base flex items-center gap-2 text-foreground"><Edit3 className="h-5 w-5" /> Preferencias de Análisis (Opcional)</Label>
            <Textarea id="analysis-preferences" value={analysisPreferences} onChange={(e) => setAnalysisPreferences(e.target.value)}
              placeholder="Ej: 'Enfócate en optimizar el rendimiento de la UI...', 'Revisa la seguridad en las llamadas API...', 'Todas las sugerencias deben estar en castellano.'" rows={3} className="bg-card text-foreground" />
            <p className="text-xs text-muted-foreground">Describe qué tipo de actualizaciones o áreas te gustaría que la IA priorizara. Especifica el idioma si es necesario.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Button onClick={() => handleStartAutoAnalysis(false)}
              disabled={isProcessing || !selectedConfigSource || (!isWorkgroupSelected && !currentLlmOptions) || (isWorkgroupSelected && (!workgroups.find(wg => wg.id === selectedConfigSource.split(':')[1]) || !agents.find(a => a.name === ORCHESTRATOR_AGENT_NAME))) }
              className="text-base py-3 px-6"
            >
              {isProcessing && (status === "analyzing" || status === "loading_source" || status === "chunking_source") ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
              Iniciar Auto-Análisis
            </Button>
            <Button onClick={() => handleDownloadSource('zip')} disabled={isDownloading} variant="outline" className="text-base py-3 px-6 text-foreground">
              {isDownloading && format === 'zip' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <DownloadCloud className="mr-2 h-5 w-5" />} Descargar Código (ZIP)
            </Button>
             <Button onClick={() => handleDownloadSource('json')} disabled={isDownloading} variant="outline" className="text-base py-3 px-6 text-foreground">
              {isDownloading && format === 'json' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <DownloadCloud className="mr-2 h-5 w-5" />} Descargar Código (JSON)
            </Button>
            <Button onClick={handleInitialGitUpload} disabled={!isGitConfigured || isProcessing} variant="outline" className="text-base py-3 px-6 text-foreground"
              title={!isGitConfigured ? "Configura Git en Ajustes." : "Subir código a Git"}>
              {status === "uploading_git" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <GitFork className="mr-2 h-5 w-5" />} Subir a Git
            </Button>
          </div>

          {(isProcessing || status === "success" || status === "error") && (
            <div className="mt-4 space-y-2">
              <Label className="text-sm text-foreground">
                {status === "loading_source" ? "Paso 1: Cargando código fuente..." :
                 status === "chunking_source" ? "Paso 1.5: Dividiendo código en fragmentos..." :
                 status === "analyzing" && analysisProgress.total > 0 ? `Paso 2: Procesando fragmentos LLM... (${analysisProgress.processed}/${analysisProgress.total})` : status === "analyzing" ? "Paso 2: Calculando fragmentos para LLM..." :
                 status === "success" ? `Operación completada ${analysisProgress.total > 0 ? `(${analysisProgress.processed}/${analysisProgress.total} fragmentos).` : '' }` :
                 status === "error" && (currentAnalysisError || currentGitError) ? `Operación interrumpida.` :
                 status === "uploading_git" ? `Subiendo a Git (Intento ${gitUploadRetryCount + 1}/${MAX_GIT_UPLOAD_RETRIES})...` :
                 status === "fixing_error" ? "Intentando auto-corrección de error de análisis..." :
                 status === "fixing_git_error" ? "Intentando auto-corrección de error Git..." : "Estado desconocido"}
              </Label>
              {(status !== "success" && status !== "error" && status !== "idle") && (
                <Progress value={
                  status === "loading_source" ? 5 :
                  status === "chunking_source" ? 10 :
                  status === "analyzing" && analysisProgress.total === 0 ? 15 :
                  status === "analyzing" && analysisProgress.total > 0 ? 15 + (analysisProgress.processed / analysisProgress.total) * 80 :
                  (status === "uploading_git" || status === "fixing_error" || status === "fixing_git_error" ? 95 : 0) // Keep a high value for these
                } className="w-full h-3" />
              )}
            </div>
          )}

          {analysisResult && status === "success" && (
            <Card className="mt-6 border-accent bg-accent/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center gap-2 text-accent"><FileCode className="h-6 w-6" /> {analysisResult.analysisTitle}</CardTitle>
                <CardDescription>Analizado usando '{getSourceName(selectedConfigSource)}'. Fuente: {sourceDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Evaluación General:</h4>
                  <ScrollArea className="h-[100px] p-2 border rounded bg-background/50"><pre className="text-xs text-foreground/80 whitespace-pre-wrap">{analysisResult.overallAssessment}</pre></ScrollArea>
                </div>
                <Separator />
                {analysisResult.identifiedAreas.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Áreas Identificadas:</h4>
                    <div className="flex flex-wrap gap-2">{analysisResult.identifiedAreas.map((area, index) => <Badge key={index} variant="secondary" className="text-foreground">{area}</Badge>)}</div>
                  </div>
                )}
                {suggestionsWithStatus.length > 0 && <Separator />}
                {suggestionsWithStatus.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Sugerencias Detalladas ({suggestionsWithStatus.length}):</h4>
                    <div className="p-3 my-2 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600 rounded-md flex items-start gap-2">
                      <ShieldAlert className="h-5 w-5 text-yellow-700 dark:text-yellow-300 shrink-0 mt-0.5" />
                      <p className="text-xs text-yellow-800 dark:text-yellow-200"><strong>¡Atención!</strong> Aplicar estas sugerencias modificará directamente los archivos del código fuente. Asegúrate de entender los cambios.</p>
                    </div>
                    <ScrollArea className="h-[400px] pr-3">
                      <ul className="space-y-3">
                        {suggestionsWithStatus.map((s) => (
                          <li key={s.id} className="p-3 rounded-md border bg-background/80 shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-sm text-foreground break-all">{s.area || "Sugerencia General"}</span>
                              {s.priority && <Badge variant={s.priority === 'high' ? 'destructive' : s.priority === 'medium' ? 'default' : 'outline'} className="capitalize text-xs shrink-0 ml-2">{s.priority}</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{s.suggestion}</p>
                            {s.status === "error_applying" && s.errorMessage && (
                              <div className="p-2 my-1 bg-destructive/10 border border-destructive/30 rounded-md">
                                <p className="text-xs text-destructive ">Error al aplicar: {s.errorMessage}</p>
                                <Button variant="ghost" size="sm" onClick={() => addDebugLog({ source: 'AUTOUPDATE_UI', type: 'ERROR', message: `Error copiado de sugerencia ${s.id}`, data: s.errorMessage})} className="mt-1 h-6 px-1.5 text-xs text-destructive hover:bg-destructive/20"><Copy className="mr-1 h-3 w-3" /> Copiar Error</Button>
                              </div>
                            )}
                            {s.status === "not_applicable" && <p className="text-xs text-muted-foreground mt-1 mb-1">No aplicable directamente. {s.suggestedFullFileContent === undefined ? 'No se proporcionó contenido modificado.' : !s.originalContent ? 'Falta contenido original.' : ''}</p>}
                            <div className="flex items-center gap-2 mt-2">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" disabled={s.status === "applying" || s.status === "applied" || s.status === "not_applicable"}
                                    className={cn(s.status === "applied" && "border-green-500 text-green-700 dark:text-green-400", s.status === "error_applying" && "border-destructive text-destructive", "text-foreground")}>
                                    {s.status === "applying" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {s.status === "applied" && <CheckCircle className="mr-2 h-4 w-4 text-green-600 dark:text-green-500" />}
                                    {s.status === "error_applying" && <XCircle className="mr-2 h-4 w-4 text-destructive" />}
                                    {s.status === "pending" && <Wand2 className="mr-2 h-4 w-4" />}
                                    {s.status === "not_applicable" && <Info className="mr-2 h-4 w-4 text-muted-foreground" />}
                                    {s.status === "applied" ? "Aplicada" : s.status === "applying" ? "Aplicando..." : s.status === "error_applying" ? "Reintentar" : s.status === "not_applicable" ? "No Aplicable" : "Aplicar Sugerencia"}
                                  </Button>
                                </AlertDialogTrigger>
                                {s.status !== "not_applicable" && s.status !== "applied" && (
                                  <AlertDialogContent className="max-w-3xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-foreground flex items-center gap-2"><ShieldAlert className="text-destructive h-6 w-6" />¿Aplicar esta sugerencia?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Se intentará aplicar la sugerencia al archivo <strong className="text-foreground">{s.area}</strong>.
                                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] text-xs">
                                          <div><p className="font-semibold mb-1 text-foreground">Original (Fragmento):</p><ScrollArea className="h-60 border rounded p-2 bg-muted/30"><pre className="text-xs font-mono whitespace-pre-wrap text-foreground">{s.originalContent?.substring(0, 1500) || "No disponible"}</pre></ScrollArea></div>
                                          <div><p className="font-semibold mb-1 text-foreground">Sugerido (Fragmento):</p><ScrollArea className="h-60 border rounded p-2 bg-muted/30"><pre className="text-xs font-mono whitespace-pre-wrap text-foreground">{s.suggestedFullFileContent?.substring(0, 1500) || "No disponible"}</pre></ScrollArea></div>
                                        </div>
                                        <strong className="block mt-3 text-destructive">¡Importante!</strong> Esta acción modificará el archivo.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleApplySuggestion(s.id)} className="bg-destructive hover:bg-destructive/90">Sí, aplicar</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                                )}
                              </AlertDialog>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {(status === "loading_source" || status === "chunking_source" || (status === "analyzing" && (!analysisProgress || analysisProgress.total === 0))) && (
            <div data-ai-hint="code processing animation" className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-8 min-h-[200px] mt-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg text-foreground">
                {status === "loading_source" ? "Cargando código..." :
                 status === "chunking_source" ? "Dividiendo código en fragmentos..." :
                 "Preparando análisis..."}
              </p>
              <p className="text-sm text-muted-foreground">Esto podría tomar unos momentos.</p>
            </div>
          )}
          {status === "error" && (currentAnalysisError || currentGitError) && (
            <Card className="mt-6 border-destructive bg-destructive/10">
              <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2 text-destructive"><AlertTriangle className="h-6 w-6" />Error en Operación</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-destructive font-medium">Ocurrió un error:</p>
                <ScrollArea className="h-[100px] p-2 border border-destructive/30 rounded bg-background/50"><pre className="text-xs text-foreground whitespace-pre-wrap">{currentAnalysisError || currentGitError}</pre></ScrollArea>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={() => addDebugLog({ source: 'AUTOUPDATE_UI', type: 'ERROR', message: `Error copiado de UI: ${currentAnalysisError || currentGitError}`})} className="text-destructive border-destructive/50 hover:bg-destructive/20 hover:text-destructive-foreground"><Copy className="mr-2 h-4 w-4" /> Copiar Error</Button>
                  <Button variant="outline" size="sm" onClick={() => handleAttemptAutoFix(currentAnalysisError || currentGitError, currentGitError ? "Error en subida Git." : "Error en auto-análisis.")}
                    disabled={status === "fixing_error" || status === "fixing_git_error" || !selectedConfigSource || (!isWorkgroupSelected && !currentLlmOptions) || (isWorkgroupSelected && (!workgroups.find(wg => wg.id === selectedConfigSource.split(':')[1]) || !agents.find(a => a.name === ORCHESTRATOR_AGENT_NAME))) }
                    className="text-accent border-accent/50 hover:bg-accent/20 hover:text-accent-foreground">
                    {(status === "fixing_error" || status === "fixing_git_error") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings2 className="mr-2 h-4 w-4" />} Auto-Fix
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {(status === "fixing_error" || status === "fixing_git_error") && (
            <div className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-8 min-h-[150px] mt-6">
              <Loader2 className="h-10 w-10 animate-spin text-accent mb-4" /><p className="text-lg text-foreground">Intentando obtener sugerencia de Auto-Corrección...</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-2">
            <p className="text-xs text-muted-foreground"><strong>Nota:</strong> El análisis se realiza sobre el código completo (local o de Git). La descarga proporciona un ZIP. La subida a Git usa el estado actual del código (local o de Git si fue la fuente). Revisa cuidadosamente las sugerencias de IA.</p>
            {detailedLogs.length > 0 && (
              <Card className="mt-6 border-primary/30 w-full">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2 text-primary"><ListOrdered className="h-5 w-5"/> Logs Detallados</CardTitle>
                      <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setLogsExpanded(!logsExpanded)} title={logsExpanded ? "Contraer Logs" : "Expandir Logs"}>
                              {logsExpanded ? <Minimize className="h-4 w-4"/> : <Expand className="h-4 w-4"/>}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDetailedLogs([])} title="Limpiar Logs">
                              <Trash2 className="h-4 w-4 text-destructive"/>
                          </Button>
                      </div>
                  </CardHeader>
                  <CardContent>
                      <ScrollArea className={cn("p-2 border rounded bg-muted/30 transition-all duration-300 ease-in-out", logsExpanded ? "h-[300px]" : "h-[100px]")}>
                          <pre className="text-xs text-foreground whitespace-pre-wrap">
                              {detailedLogs.map((log, index) => {
                                const isError = log.includes("[ERROR") || log.includes("Error:");
                                const isWarn = log.includes("[WARN");
                                const isDetail = log.includes("[DETAIL");
                                const isChunkAnalysis = log.includes("[CHUNK_ANALYSIS");

                                return (
                                  <span key={`log-${index}`} className={cn(
                                      isError ? "text-destructive"
                                      : isWarn ? "text-yellow-500 dark:text-yellow-400"
                                      : isChunkAnalysis ? "text-sky-600 dark:text-sky-400"
                                      : isDetail ? "text-gray-500 dark:text-gray-400"
                                      : ""
                                  )}>
                                      {log}\n
                                  </span>
                                );
                              })}
                          </pre>
                      </ScrollArea>
                  </CardContent>
              </Card>
            )}
        </CardFooter>
      </Card>
      <AlertDialog open={isAutoFixModalOpen} onOpenChange={setIsAutoFixModalOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-accent"><Settings2 className="h-6 w-6 text-accent" />Sugerencia de Auto-Corrección</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">La IA ha analizado el error. Revisa antes de actuar.</AlertDialogDescription>
          </AlertDialogHeader>
          {autoFixSuggestion && (
            <ScrollArea className="max-h-[60vh] p-1 -mx-1">
              <div className="space-y-3 p-3 border rounded-md bg-card">
                <div><h4 className="font-semibold text-sm mb-1 text-foreground">Posible Causa Raíz:</h4><p className="text-xs text-foreground whitespace-pre-wrap">{autoFixSuggestion.root_cause_analysis}</p></div>
                <Separator />
                <div><h4 className="font-semibold text-sm mb-1 text-foreground">Sugerencias de Solución:</h4><p className="text-xs text-foreground whitespace-pre-wrap">{autoFixSuggestion.solution_suggestions}</p></div>
              </div>
            </ScrollArea>
          )}
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel onClick={() => setIsAutoFixModalOpen(false)}>Cerrar</AlertDialogCancel>
            {(status === "error" && currentGitError && gitUploadRetryCount < MAX_GIT_UPLOAD_RETRIES) && (
              <AlertDialogAction onClick={handleRetryGitUploadFromModal} className="bg-primary hover:bg-primary/90" disabled={isProcessing}>
                {isProcessing && status === "uploading_git" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitFork className="mr-2 h-4 w-4" />} Reintentar Subida Git ({gitUploadRetryCount + 1}/{MAX_GIT_UPLOAD_RETRIES})
              </AlertDialogAction>
            )}
            {(status === "error" && currentAnalysisError) && (
              <AlertDialogAction onClick={() => { setIsAutoFixModalOpen(false); handleStartAutoAnalysis(true); }} className="bg-primary hover:bg-primary/90" disabled={isProcessing}>
                {isProcessing && (status === "loading_source" || status === "analyzing" || status === "chunking_source") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Reintentar Análisis
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </>
  );
}
