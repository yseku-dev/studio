
# CodeAlchemist

CodeAlchemist es una plataforma de desarrollo asistido por inteligencia artificial (IA) diseñada para optimizar y agilizar el ciclo de vida del desarrollo de software. Ofrece herramientas para la generación y análisis de código, refactorización asistida, gestión de versiones, ejecución de grupos de trabajo IA y análisis de proyectos completos, todo ello potenciado por diversos modelos de IA a través de sus respectivas APIs o puntos de conexión locales.

## Características Principales

*   **Generación de Código**: Crea fragmentos de código a partir de descripciones en lenguaje natural, utilizando la configuración de IA seleccionada (global, agente específico o grupo de trabajo).
*   **Generación de Proyectos**: Define una estructura base para nuevos proyectos según tus especificaciones, utilizando la configuración de IA seleccionada. Permite descargar el proyecto generado como un archivo ZIP.
*   **Refactorizar Proyecto**: Sube un proyecto (ZIP, JSON, archivo de texto) o proporciona una URL de repositorio Git para obtener sugerencias de refactorización generadas por la IA. Utiliza un agente "RefactorizadorCodigoExperto" o un grupo de trabajo que lo incluya. Permite especificar metas (ej. "Mejorar rendimiento UI") y prioridades de refactorización (ej. "Priorizar Seguridad"). Muestra sugerencias detalladas con área, descripción, prioridad y fragmento sugerido, permitiendo aplicar (simulado), ver diferencias (simulado) o descartar cada una. Incluye logs de ejecución.
*   **Análisis de Código Inteligente**: Pega fragmentos de código, sube archivos individuales o proporciona una URL a un archivo en un repositorio Git para recibir análisis detallados y sugerencias de mejora generadas por IA, utilizando la configuración de IA seleccionada. Permite guardar versiones del código original y sugerido.
*   **Análisis de Proyecto Completo**: Sube un proyecto en formato ZIP o JSON, o proporciona una URL de repositorio Git, para un análisis holístico. La funcionalidad detallada del análisis está en desarrollo, actualmente realiza una simulación.
*   **AutoUpdate (Análisis del Propio Código)**: Permite que CodeAlchemist analice su propio código fuente (obtenido al momento de la ejecución o desde una URL de Git especificada). Ofrece sugerencias, permite aplicarlas directamente (modificando los archivos físicos), descargar el código fuente completo en ZIP o JSON, o subirlo a un repositorio Git configurado. Las comunicaciones con la IA están optimizadas para manejar grandes cantidades de código mediante fragmentación y reintentos en caso de errores de API (límites de tokens/TPM, timeouts). Incluye un botón "Auto-Fix" para que la IA intente proponer soluciones a errores ocurridos durante el análisis o la subida a Git. Muestra un log detallado de la ejecución.
*   **Versiones Guardadas (Snapshots)**: Guarda diferentes versiones de tu código (original y sugerido desde "Analizar Código", o el estado completo de CodeAlchemist desde "AutoUpdate" o directamente en esta sección). Permite ver, descargar y eliminar versiones. Ofrece una funcionalidad para comparar dos versiones seleccionadas y ver sus diferencias.
*   **Chat con IA**: Interactúa con un asistente IA para obtener ayuda, resolver dudas o generar ideas, utilizando la configuración de IA seleccionada. Muestra el historial de la conversación.
*   **Gestión de Agentes IA**: Crea y configura agentes IA individuales. Cada agente tiene un nombre, descripción, mensaje de sistema (prompt base), y puede usar la configuración LLM global o una personalizada (proveedor, modelo, clave API opcional, URL de API opcional). Se pueden definir capacidades específicas para cada agente:
    *   Acceso a código propio (para leer el código fuente de CodeAlchemist).
    *   Capacidad de ejecución (para ejecutar comandos o scripts; usar con precaución).
    *   Capacidad de entorno virtual (para gestionar entornos aislados).
    *   Capacidad de lectura/escritura de archivos (para modificar el sistema de archivos; usar con precaución).
    Permite probar cada agente en una ventana de chat modal, importar y exportar agentes individualmente (JSON) o todos los agentes.
*   **Gestión de Grupos de Trabajo IA**: Define grupos de agentes para colaborar en tareas complejas. Cada grupo tiene un nombre, descripción y una tarea principal. Se seleccionan los agentes participantes; el agente `OrquestadorFlujoAgentes` es obligatorio y se añade automáticamente si no está. Este orquestador dirige el flujo de trabajo, recibiendo todas las respuestas de los agentes y decidiendo el siguiente paso para asegurar un proceso coordinado y una toma de decisiones centralizada. Permite ejecutar el grupo, lo que abre una ventana modal con un log detallado de la ejecución del grupo, mostrando cada turno, las decisiones del orquestador y las respuestas de los agentes.
*   **Interfaz de Usuario Intuitiva**: Construida con tecnologías web modernas para una experiencia de usuario moderna, responsiva y agradable. La barra lateral es colapsable para maximizar el espacio de trabajo. Los colores y temas están diseñados para ser claros y legibles.
*   **Configuración Personalizada**:
    *   **LLM**: Selecciona el proveedor de IA (Groq, Google Gemini, OpenAI, Anthropic, LM Studio, Ollama), introduce tu clave API (si es necesaria para el proveedor seleccionado), elige el modelo de la lista disponible para ese proveedor y, para proveedores que lo requieran (como LM Studio u Ollama), especifica la URL de la API. Incluye un botón para probar la conexión con la configuración LLM actual.
    *   **Git**: Configura la URL del repositorio, nombre de usuario, email y Token de Acceso Personal (PAT) para la funcionalidad de subida a Git en la sección "AutoUpdate". Incluye un botón para probar la conexión Git.
*   **Manejo de Errores Mejorado**: Los errores, especialmente durante las interacciones con la IA o Git, se muestran claramente. Se pueden copiar para depuración y, en algunos casos (AutoUpdate, Subida a Git), se ofrece un botón "Auto-Fix (Experimental)" para que la IA analice el error y proponga una solución. CodeAlchemist intenta gestionar errores comunes de API LLM (límites de tokens/TPM, timeouts) con reintentos y fragmentación de datos.
*   **Modo Depuración**: Una opción en la sección de "Configuración" permite activar un panel de logs detallados fijo en la parte inferior de la pantalla. Este panel es útil para el desarrollo y seguimiento avanzado de todos los procesos de la aplicación, mostrando información en tiempo real sobre el estado interno, llamadas a servicios, y decisiones de los agentes. Es expandible/contraíble y permite copiar o borrar los logs.

## Guía de Inicio

Esta guía te ayudará a instalar y comenzar a usar CodeAlchemist.

### Requisitos Previos

*   Un entorno de ejecución para aplicaciones web modernas.
*   Un gestor de paquetes para instalar las dependencias del proyecto.

### Instalación

1.  **Obtener el Código Fuente**: Descarga o clona el código fuente del proyecto desde su repositorio oficial.
    *(Reemplaza con la URL real del repositorio cuando esté disponible)*

2.  **Instalar Dependencias**: Navega al directorio raíz del proyecto en tu terminal y ejecuta el comando de instalación de dependencias de tu gestor de paquetes (ej. `npm install` o `yarn install`).

3.  **Configuración del Entorno (Opcional)**:
    *   CodeAlchemist gestiona la mayoría de las configuraciones, como las claves API para los modelos de IA, directamente desde la interfaz de usuario (sección "Configuración"). Estos datos se guardan de forma segura en el almacenamiento local de tu navegador.
    *   Si necesitas variables de entorno específicas para el servidor (para funcionalidades no cubiertas por la UI), puedes crear un archivo `.env.local` en la raíz del proyecto.

4.  **Ejecutar la Aplicación en Modo Desarrollo**:
    *   Utiliza el comando proporcionado por tu gestor de paquetes para iniciar la aplicación en modo desarrollo (ej. `npm run dev` o `yarn dev`).
    *   Una vez iniciada, la aplicación debería estar disponible en tu navegador, generalmente en una dirección como `http://localhost:PUERTO` (el puerto puede variar, consulta la salida de la consola).

## Tutorial de Uso Detallado

A continuación, se detalla cómo utilizar cada sección de CodeAlchemist.

### 1. Navegación y Barra Lateral

*   La aplicación cuenta con una **barra lateral** a la izquierda que proporciona acceso a todas las secciones principales.
*   Puedes **Ocultar/Mostrar** la barra lateral haciendo clic en el icono respectivo en la parte inferior de la misma (en vista de escritorio) para maximizar tu espacio de trabajo. En dispositivos móviles, un menú tipo "hamburguesa" controlará la visibilidad de la barra lateral.

### 2. Configuración Inicial (Sección "Configuración")

Es crucial configurar correctamente la aplicación antes de usar las funcionalidades de IA y Git.

*   **Configuración del Proveedor LLM (Inteligencia Artificial)**:
    *   **Proveedor LLM**: Selecciona el servicio de IA que deseas utilizar (Groq, Google Gemini, OpenAI, Anthropic, LM Studio, Ollama).
    *   **URL del Endpoint de API**: Para proveedores que se ejecutan localmente (como LM Studio u Ollama) o si usas un proxy personalizado, introduce la URL base del punto de conexión de la API (ej. `http://localhost:1234/v1` para LM Studio). Para los proveedores basados en la nube, este campo se rellena automáticamente con su URL estándar, pero puedes sobrescribirlo si es necesario.
    *   **Clave API**: Si el proveedor de IA seleccionado requiere una clave para su uso, introdúcela aquí. Esta clave se almacena de forma segura en el almacenamiento local de tu navegador.
    *   **Nombre del Modelo**: Selecciona uno de los modelos de IA disponibles para el proveedor que has elegido. La lista de modelos se actualiza dinámicamente según el proveedor y, en algunos casos, la validez de la clave API. Los modelos suelen estar ordenados por su capacidad o popularidad.
    *   Haz clic en **"Probar Conexión (Proveedor LLM)"** para verificar que CodeAlchemist puede comunicarse correctamente con el servicio de IA utilizando la configuración proporcionada.
*   **Configuración de Git (Opcional, para "AutoUpdate" y otras funciones de Git)**:
    *   **URL del Repositorio Git**: La URL HTTPS de tu repositorio remoto (ej. `https://github.com/tu-usuario/tu-repo.git`).
    *   **Nombre de Usuario Git**: Tu nombre de usuario en la plataforma Git (ej. GitHub, GitLab).
    *   **Email de Git**: El email asociado a tus confirmaciones (commits) de Git.
    *   **Token de Acceso Personal (PAT)**: Un Token de Acceso Personal generado desde tu plataforma Git, con los permisos necesarios para escribir en el repositorio (generalmente `repo` o `public_repo`).
    *   Haz clic en **"Probar Conexión Git"** para verificar que la autenticación con tu repositorio remoto es exitosa.
*   **Modo Depuración**:
    *   Activa esta opción para mostrar una ventana de logs detallados en la parte inferior de la pantalla. Este panel es muy útil para el desarrollo de la propia aplicación CodeAlchemist o para entender en profundidad el flujo de ejecución de las tareas de IA.
*   Finalmente, haz clic en **"Guardar Configuración"** para almacenar todos estos ajustes.

### 3. Generar Código (Sección "Generar Código")

Esta sección te permite crear fragmentos de código a partir de descripciones en lenguaje natural.

*   **Usar Configuración LLM De**: Aquí eliges qué configuración de IA se utilizará para esta tarea:
    *   **Ajustes Globales**: Usa la configuración definida en la sección "Configuración".
    *   **Agente: [Nombre del Agente]**: Utiliza la configuración LLM específica de un agente IA que hayas creado.
    *   **Grupo: [Nombre del Grupo]**: La tarea de generación de código se pasará al agente Orquestador del grupo seleccionado. El Orquestador gestionará el flujo dentro del grupo para producir el código.
*   **Describe tu necesidad**: Escribe un prompt detallado y claro sobre el código que necesitas. Cuanto más específico seas, mejores serán los resultados. (Ej: "Una función en Python que tome una lista de URLs, descargue su contenido HTML de forma asíncrona, y devuelva una lista con los títulos de cada página.")
*   Haz clic en **"Generar Código"**. Es posible que se te pida confirmar la acción.
*   **Resultados**:
    *   La IA generará una explicación del código que va a crear y luego el fragmento de código en sí.
    *   Podrás copiar el código generado fácilmente.
    *   Si se utilizó un grupo de trabajo, un **Log Detallado del Grupo** estará disponible al final de la página, mostrando las interacciones entre los agentes.

### 4. Generar Proyecto (Sección "Generar Proyecto")

Crea una estructura base para un nuevo proyecto, incluyendo archivos y carpetas.

*   **Usar Configuración LLM De**: Similar a "Generar Código", selecciona la fuente de configuración LLM (Global, Agente o Grupo).
*   **Describe tu proyecto**: Proporciona un prompt detallado sobre el proyecto que quieres generar. (Ej: "Un proyecto API REST simple con Express.js y TypeScript. Debe incluir una ruta GET /status, configuración básica de ESLint, Prettier y un Dockerfile.")
*   Haz clic en **"Generar Proyecto"**. Se te pedirá **Confirmar Generación**, donde podrás incluso redefinir o ajustar tu prompt antes de proceder.
*   **Resultados**:
    *   Se mostrará un **Nombre Sugerido** para el proyecto y **Notas de la IA** sobre la estructura o próximos pasos.
    *   Una lista de **Archivos Generados** con sus rutas y contenido. Puedes expandir cada archivo para ver su código.
    *   Un botón para **Descargar Proyecto (ZIP)** te permitirá obtener todos los archivos generados en un solo paquete.
    *   Si se utilizó un grupo de trabajo, un **Log Detallado del Grupo** estará disponible.

### 5. Refactorizar Proyecto (Sección "Refactorizar Proyecto")

Analiza un proyecto existente y obtén sugerencias de refactorización generadas por la IA.

*   **Usar Configuración LLM De**:
    *   Selecciona **Ajustes Globales** para usar la configuración general.
    *   Elige un **Agente** específico, idealmente uno configurado para refactorización (como `RefactorizadorCodigoExperto`).
    *   Opta por un **Grupo** de trabajo que incluya agentes relevantes (como `RefactorizadorCodigoExperto` y `OrquestadorFlujoAgentes`). El Orquestador recibirá la tarea de refactorización.
*   **Fuente del Proyecto**:
    *   **Subir Archivo**: Sube un archivo `.zip` (que contenga el código fuente de tu proyecto), `.json` (si el proyecto está representado en este formato, por ejemplo, una exportación), o un archivo de texto plano individual (ej: `.py`, `.js`, `.java`).
    *   **URL de Git**: Introduce la URL HTTPS de un repositorio Git público. CodeAlchemist clonará el repositorio para su análisis. (Esta función está en desarrollo activo).
*   **Parámetros de Refactorización**:
    *   **Metas (opcional)**: Describe los objetivos específicos de la refactorización (ej. "Mejorar el rendimiento de los componentes de UI", "Simplificar la lógica de negocio en los servicios", "Aumentar la cobertura de pruebas").
    *   **Prioridad General (opcional)**: Selecciona un enfoque general para las sugerencias (ej. "Priorizar Seguridad", "Priorizar Legibilidad", "Priorizar Rendimiento", "Estandarizar Código", "Reducir Complejidad").
*   Haz clic en **"Analizar para Refactorizar"**.
*   **Resultados y Sugerencias**:
    *   Se mostrará una lista de sugerencias de refactorización. Cada sugerencia incluirá:
        *   **Área**: El archivo, clase o función afectada.
        *   **Descripción**: La explicación de la mejora propuesta.
        *   **Prioridad**: Alta, Media o Baja, según la evaluación de la IA.
        *   **Snippet Sugerido (opcional)**: Un fragmento del código original y el código modificado para ilustrar el cambio.
    *   **Acciones por Sugerencia**:
        *   **Aplicar (Simulado)**: Marca la sugerencia como si se hubiera aplicado. (La modificación real del archivo subido no se realiza directamente en esta sección para proyectos externos).
        *   **Ver Diff (Simulado)**: Muestra una comparación simulada entre el código original y el sugerido.
        *   **Descartar**: Omite la sugerencia.
    *   **Acción Masiva**:
        *   **Aplicar Todas las Sugerencias (Simulado)**: Marca todas las sugerencias aplicables como aplicadas.
*   **Logs de Ejecución**: Una ventana muestra logs detallados del proceso de análisis, especialmente útil si se seleccionó un grupo de trabajo.

### 6. Analizar Código (Sección "Analizar Código")

Obtén análisis, explicaciones y sugerencias de mejora para fragmentos de código individuales o archivos.

*   **Usar Configuración LLM De**: Selecciona la fuente de configuración LLM (Global, Agente o Grupo).
*   **Fuente del Código**:
    *   **Sube un archivo de código (opcional)**: Carga un archivo de código fuente desde tu dispositivo.
    *   **URL de Archivo Git (opcional)**: Pega la URL directa a un archivo "raw" en un repositorio Git (ej. GitHub, GitLab). CodeAlchemist intentará obtener su contenido.
    *   Pega tu código directamente en el área de texto principal.
*   Haz clic en **"Analizar Código"**.
*   **Resultados**:
    *   Se mostrará una **Explicación** del código original.
    *   Tu **Código Original**.
    *   El **Código Sugerido** con las mejoras.
*   **Guardar Versiones**: Tienes botones para **Guardar Original** y **Guardar Sugerido**, que crearán snapshots en la sección "Versiones Guardadas".

### 7. Analizar Proyecto Completo (Sección "Analizar Proyecto")

Analiza proyectos enteros para obtener una visión general y posibles puntos de mejora.

*   **Usar Configuración LLM De**: Selecciona la fuente de configuración LLM (Global, Agente o Grupo).
*   **Fuente del Proyecto**:
    *   **Subir Archivo (ZIP/JSON)**: Selecciona un archivo `.zip` con el código fuente de tu proyecto o un archivo `.json` que represente la estructura del proyecto.
    *   **URL de Git**: Introduce la URL HTTPS de un repositorio Git público.
*   Haz clic en **"Analizar Proyecto"**.
*   *Nota: El análisis proveerá resultados basados en la capacidad actual del modelo de IA y el contenido del proyecto. Esta sección está diseñada para un análisis más holístico que el análisis de fragmentos individuales.*
*   Los resultados se presentarán de manera similar a "Refactorizar Proyecto", con un resumen general y áreas destacadas.
*   Un **Log Detallado del Grupo** (si se usó uno) o del proceso estará disponible.

### 8. AutoUpdate (Sección "AutoUpdate")

Esta potente sección permite que CodeAlchemist analice su propio código fuente.

*   **Usar Configuración LLM De**: Selecciona la fuente de configuración LLM (Global, Agente específico o Grupo de Trabajo).
*   **Fuente del Código para Auto-Análisis**:
    *   **Local**: Por defecto, analiza el código fuente actual de la aplicación CodeAlchemist tal como se está ejecutando.
    *   **URL del Repositorio Git (Opcional)**: Puedes introducir la URL de un repositorio Git (presumiblemente una versión de CodeAlchemist) para analizar esa versión específica en lugar del código local.
*   **Preferencias de Análisis (Opcional)**: Guía a la IA con tus objetivos (ej. "mejorar el rendimiento de la gestión de agentes", "revisar el manejo de errores en las llamadas a API LLM", "optimizar la fragmentación de código para análisis"). Si se utiliza un Grupo de Trabajo, este prompt se convierte en la tarea principal para el Orquestador.
*   Haz clic en **"Iniciar Auto-Análisis"**.
    *   CodeAlchemist recopilará su propio código fuente (excluyendo directorios como `node_modules`, `.git`, etc., si es local) o clonará el repositorio si se proporcionó una URL.
    *   Si no se utiliza un grupo, el código se divide en fragmentos para no exceder los límites de los modelos de IA. Se muestra una **Barra de Progreso** con el número de fragmentos procesados sobre el total.
    *   Si se utiliza un grupo de trabajo, la tarea de análisis se pasa al Orquestador del grupo.
*   **Resultados**:
    *   Se muestra un **Título del Análisis**, **Áreas Identificadas** para revisión, **Sugerencias Detalladas** (cada una con área, sugerencia, prioridad y, si es aplicable, el contenido completo del archivo sugerido) y una **Evaluación General**.
*   **Aplicar Sugerencias**: Para cada sugerencia que implique un cambio de código en un archivo específico:
    *   Haz clic en **"Aplicar Sugerencia"**. Se mostrará un diálogo de confirmación con una vista previa del cambio (diff simulado).
    *   Al confirmar, el archivo correspondiente en el sistema de archivos de CodeAlchemist **SERÁ MODIFICADO**. ¡Usa esta función con precaución!
*   **Descargar Código Fuente Completo**:
    *   **Descargar Código (ZIP)**: Descarga un archivo ZIP con el estado actual completo del código fuente de CodeAlchemist (incluyendo cualquier sugerencia aplicada).
    *   **Descargar Código (JSON)**: Descarga una representación JSON del código fuente (lista de archivos con su contenido).
*   **Subir a Git**:
    *   Si has configurado los detalles de Git en la sección "Configuración", este botón intentará hacer commit y push del estado actual del código fuente al repositorio remoto.
    *   Se te pedirá un mensaje de commit.
*   **Manejo de Errores y Auto-Fix**:
    *   Cualquier error ocurrido durante el análisis, la aplicación de sugerencias o la subida a Git se mostrará claramente.
    *   Un botón **"Copiar Error"** permite copiar el mensaje para depuración.
    *   Un botón **"Auto-Fix (Experimental)"** estará disponible. Al hacer clic, CodeAlchemist utilizará la IA para analizar el mensaje de error y proponer una o más soluciones. Las sugerencias de "Auto-Fix" se mostrarán en un diálogo modal.
*   **Logs de Ejecución Detallados**: Una ventana en la parte inferior de esta sección muestra logs detallados de todo el proceso de AutoUpdate. Dispone de botones para **Copiar Logs**, **Borrar Logs** y **Expandir/Contraer** la ventana de logs.

### 9. Versiones Guardadas (Sección "Versiones Guardadas")

Gestiona snapshots (instantáneas) de tu código guardadas desde "Analizar Código" o "AutoUpdate".

*   Se muestra una lista de todas las versiones guardadas, con su nombre y fecha/hora.
*   **Acciones por Versión**:
    *   **Ver**: Abre un diálogo modal que muestra el contenido completo del código de esa versión.
    *   **Descargar**: Descarga el código de esa versión como un archivo de texto.
    *   **Eliminar**: Borra la versión de forma permanente (con confirmación).
    *   **Seleccionar para Comparar (A/B)**: Marca la versión para compararla. Puedes seleccionar una versión "A" y una "B". Una vez ambas seleccionadas, se habilita la comparación.
*   **Comparar Versiones**:
    *   Si has seleccionado dos versiones (A y B), aparecerá un botón o se abrirá automáticamente un diálogo modal mostrando las diferencias (diff) entre ambas.
*   **Guardar Código Actual de CodeAlchemist**: Un botón dedicado en esta sección te permite tomar un snapshot completo del código fuente de CodeAlchemist en su estado actual y guardarlo aquí.
*   **Eliminar Todas**: Un botón para borrar todas las versiones guardadas (con confirmación).

### 10. Chat con IA (Sección "Chat con IA")

Conversa directamente con un asistente de IA.

*   **Usar Configuración LLM De**: Selecciona la fuente de configuración LLM (Global, Agente o Grupo).
*   Escribe tu mensaje en el área de texto y presiona Enviar o Enter.
*   El historial de la conversación se muestra en la ventana principal.
*   Puedes **Borrar el Chat** para limpiar el historial de la sesión actual.
*   Si ocurre un error durante la respuesta de la IA, se mostrará un mensaje de error con opciones para copiarlo o intentar un "Auto-Fix" (si la IA puede analizar el error de la propia IA).

### 11. Gestión de Agentes IA (Sección "Agentes IA")

Crea, configura y administra agentes de IA individuales y especializados.

*   Se muestra una lista de todos los agentes creados.
*   Botones para **Importar Agentes** (desde un archivo JSON) y **Exportar Todos los Agentes** (a un archivo JSON).
*   **Crear Agente**:
    *   **Nombre**: Un nombre único y descriptivo para el agente (ej. "AnalistaDeSeguridad").
    *   **Descripción**: Una breve explicación del propósito del agente.
    *   **Mensaje de Sistema (Prompt)**: El prompt base que define el rol, el contexto y las instrucciones principales para el agente. Este es el mensaje que la IA usará como guía fundamental para su comportamiento.
    *   **Capacidades del Agente**: Activa interruptores para otorgar permisos específicos:
        *   **Acceso a Código Propio**: Permite al agente leer el código fuente de CodeAlchemist.
        *   **Capacidad de Ejecución**: Permite al agente ejecutar comandos o scripts. (¡Peligroso! Habilitar solo si confías plenamente en el agente y el entorno).
        *   **Capacidad de Entorno Virtual**: Permite al agente crear o usar entornos virtuales.
        *   **Capacidad Lectura/Escritura**: Permite al agente leer y escribir archivos en el sistema. (¡Peligroso! Habilitar con extrema precaución).
    *   **Configuración LLM del Agente**:
        *   **Usar Configuración Global**: El agente usará los ajustes definidos en la sección "Configuración".
        *   **Configuración Personalizada**: Permite seleccionar un Proveedor LLM, Modelo, y opcionalmente sobrescribir la Clave API y la URL de API específicamente para este agente.
*   **Agente Orquestador (OrquestadorFlujoAgentes)**:
    *   Un agente con el nombre exacto `OrquestadorFlujoAgentes` es crucial para la funcionalidad de los Grupos de Trabajo. Si no existe, DEBES crearlo.
    *   **Configuración Sugerida para `OrquestadorFlujoAgentes`**:
        *   **Nombre**: `OrquestadorFlujoAgentes`
        *   **Descripción**: "Agente central obligatorio en cada Grupo de Trabajo. Gestiona el flujo de interacciones, recibe todas las respuestas y decide qué agente actúa a continuación para garantizar un proceso coordinado y la toma de decisiones centralizada."
        *   **Mensaje de Sistema**: "Eres el Orquestador del Grupo de Trabajo. Tu rol es crítico: debes recibir y gestionar todas las respuestas generadas dentro del grupo. Basado en la tarea principal, el historial de conversación y el estado actual del proceso, decides a qué agente o subgrupo derivar la interacción. Todas las respuestas de los agentes deben pasar obligatoriamente por ti para asegurar un flujo coordinado y la toma de decisiones centralizada para completar la tarea del grupo eficientemente. No realizas la tarea directamente; facilitas que los otros agentes la completen. Pide aclaraciones si es necesario y resume el progreso. Si el usuario no propone un paso, prioriza agentes con capacidades relevantes para la tarea actual (ej. 'RefactorizadorCodigoExperto' para mejoras de código). Tu respuesta DEBE SER EXCLUSIVAMENTE un objeto JSON válido con las claves 'next_agent_name' (string, el nombre EXACTO de un agente disponible o 'COMPLETADO') y 'reason' (string, justificación concisa). No incluyas NADA más."
        *   **Capacidades**: Generalmente, el Orquestador no necesita capacidades peligrosas como ejecución o escritura de archivos, ya que su rol es delegar.
        *   **Configuración LLM**: Puede ser 'default' o personalizada (se recomienda un modelo capaz de seguir instrucciones JSON estrictas).
*   **Acciones por Agente (en la lista)**:
    *   **Probar**: Abre una ventana de chat modal para interactuar directamente con ese agente, usando su mensaje de sistema y configuración LLM.
    *   **Exportar**: Descarga la configuración del agente como un archivo JSON.
    *   **Editar**: Abre el formulario para modificar los detalles del agente. El nombre del `OrquestadorFlujoAgentes` no se puede cambiar.
    *   **Eliminar**: Borra el agente (con confirmación). El `OrquestadorFlujoAgentes` no se puede eliminar.

### 12. Gestión de Grupos de Trabajo IA (Sección "Grupos de Trabajo IA")

Define equipos de agentes IA para colaborar en tareas más complejas y multifacéticas.

*   Se muestra una lista de todos los grupos de trabajo creados.
*   **Crear Grupo**:
    *   **Nombre**: Un nombre único para el grupo.
    *   **Descripción**: Una breve explicación del propósito del grupo.
    *   **Tarea Principal del Grupo**: Un prompt detallado que describe el objetivo general o la tarea que este grupo de trabajo debe realizar. Esta tarea se pasará inicialmente al agente `OrquestadorFlujoAgentes` del grupo.
    *   **Seleccionar Agentes Participantes**: Elige los agentes (creados en la sección "Agentes IA") que formarán parte de este grupo. El agente `OrquestadorFlujoAgentes` se considera implícitamente parte del grupo si existe y está configurado correctamente, o puedes seleccionarlo explícitamente. Debes seleccionar al menos un agente además del Orquestador.
*   **Acciones por Grupo (en la lista)**:
    *   **Ejecutar**: Abre una ventana modal para la **Ejecución del Grupo de Trabajo**. En esta ventana:
        *   Se muestra la Tarea Principal del grupo.
        *   Comienza la ejecución: el Orquestador recibe la tarea y empieza a coordinar a los agentes.
        *   Se muestra un **Log de Ejecución Detallado** en tiempo real. Este log incluye:
            *   Cada turno de la ejecución (hasta un máximo configurable, por defecto 10).
            *   Las decisiones del Orquestador (a qué agente pasa el control y por qué).
            *   Las respuestas completas de cada agente.
            *   Mensajes de sistema o errores.
        *   Puedes **Copiar los Logs** o **Detener la Ejecución** en cualquier momento.
    *   **Editar**: Abre el formulario para modificar los detalles del grupo.
    *   **Eliminar**: Borra el grupo de trabajo (con confirmación).

## Flujo de Trabajo con IA

CodeAlchemist ofrece flexibilidad en cómo se utilizan los modelos de IA.

### Selección de Fuente de Configuración LLM

En la mayoría de las secciones que interactúan con un LLM (Generar Código, Analizar Código, Chat, etc.), encontrarás un selector llamado **"Usar Configuración LLM De:"**. Las opciones son:

1.  **Ajustes Globales**: Utiliza el proveedor, modelo y clave API definidos en la sección principal de "Configuración".
2.  **Agente: [Nombre del Agente]**: Utiliza la configuración LLM (ya sea global o personalizada) definida para el agente IA seleccionado.
3.  **Grupo: [Nombre del Grupo]**: La tarea o prompt principal se entrega al agente `OrquestadorFlujoAgentes` del grupo seleccionado. El Orquestador usará su propia configuración LLM para tomar decisiones y coordinará a los demás agentes del grupo, cada uno de los cuales usará su respectiva configuración LLM para generar sus respuestas.

### Agentes y Grupos de Trabajo

*   **Agentes**: Son entidades de IA individuales con un rol (definido por su Mensaje de Sistema), capacidades específicas (acceso a código, ejecución, etc.) y su propia configuración LLM (que puede ser la global o una personalizada). Piensa en ellos como especialistas.
*   **Grupos de Trabajo**: Son equipos de agentes diseñados para colaborar en tareas más complejas que requieren múltiples pasos o perspectivas.
    *   El **`OrquestadorFlujoAgentes`** (Orquestador del Grupo) es una pieza fundamental y obligatoria en cada Grupo de Trabajo. Su función principal es recibir y gestionar todas las respuestas generadas por los agentes dentro del grupo. Basándose en la tarea principal asignada al grupo, el historial de la conversación entre agentes y el estado actual del proceso, el Orquestador decide a qué agente (o subgrupo, en futuras implementaciones) debe derivar la interacción. Todas las respuestas de los agentes deben pasar obligatoriamente por el Orquestador. Esto asegura un flujo de trabajo coordinado y una toma de decisiones centralizada, permitiendo al grupo completar la tarea de manera eficiente. El Orquestador no realiza la tarea directamente, sino que facilita que los otros agentes la completen. Si el usuario no propone un paso explícito, el Orquestador prioriza a los agentes con las capacidades más relevantes para la fase actual de la tarea.

## Manejo de Errores

CodeAlchemist se esfuerza por manejar los errores de forma clara y proporcionar herramientas para su resolución.

*   **Errores de API LLM**:
    *   **Límites de Tokens/TPM (Tokens Per Minute)**: Si se exceden los límites de tokens o de solicitudes por minuto del proveedor de IA (errores comunes como 429 "Too Many Requests" o 413 "Payload Too Large"), la aplicación intentará:
        *   Realizar **reintentos con backoff exponencial** para errores 429, esperando un tiempo progresivamente mayor antes de reintentar.
        *   En la sección "AutoUpdate", el código fuente de la aplicación se **fragmenta automáticamente** en trozos más pequeños para evitar errores 413 debido a payloads demasiado grandes. Se procesa un fragmento a la vez con un retraso configurable entre ellos.
    *   **Timeouts**: Las solicitudes a las APIs de IA tienen tiempos de espera configurados para evitar que la aplicación se bloquee indefinidamente. Si una solicitud excede este tiempo, se mostrará un error.
*   **Copia de Errores**: En la mayoría de los casos donde se muestra un error (ya sea de la IA, de Git, o interno de la aplicación), se proporciona un botón para **copiar el mensaje de error completo** al portapapeles. Esto facilita la búsqueda de soluciones o el reporte del problema.
*   **Auto-Fix (Experimental)**:
    *   En secciones como "AutoUpdate" (para errores de análisis o subida a Git) y en la ventana de "Chat con IA" (para errores en la respuesta de la IA), se ofrece un botón "Auto-Fix".
    *   Al hacer clic, CodeAlchemist envía el mensaje de error y el contexto relevante a la IA configurada, solicitándole un análisis de la causa raíz y sugerencias de solución.
    *   Las propuestas de la IA se muestran en un diálogo modal para que el usuario las revise.
    *   **Refuerzo Propuesto para el Sistema Auto-Fix (Concepto para desarrollo futuro integrado con grupos de agentes)**:
        *   **Priorización dinámica**: Implementar un módulo de análisis en tiempo real para clasificar errores por criticidad (ej.: impacto en rendimiento, seguridad o usabilidad), priorizando soluciones automáticas para casos de alta urgencia. Esto podría ser una tarea para un agente especializado dentro de un grupo de "Mantenimiento del Sistema".
        *   **Aprendizaje automático predictivo**: Entrenar un modelo (posiblemente un agente IA dedicado) con datos históricos de errores y correcciones para identificar patrones recurrentes y sugerir soluciones proactivas antes de que los problemas se vuelvan críticos.
        *   **Validación robusta**: Integrar pruebas automatizadas (unitarias, de integración y de regresión) como paso obligatorio antes de aplicar correcciones. Un agente "Validador" podría ejecutar estas pruebas, usando herramientas estándar de CI/CD si la capacidad de ejecución está habilitada.
        *   **Sincronización con el Orquestador**: Establecer canales de comunicación bidireccional entre el sistema "Auto-Fix" (que podría ser un grupo de trabajo específico) y el `OrquestadorFlujoAgentes` principal de la aplicación. Esto aseguraría que las correcciones se ejecuten en concordancia con los flujos de trabajo actuales (ej.: el Orquestador podría pausar tareas conflictivas o ajustar prioridades basándose en la criticidad de un error que el sistema Auto-Fix está intentando resolver).
        *   Estas mejoras conceptuales buscan optimizar la eficiencia del sistema Auto-Fix, reducir la carga manual de supervisión y garantizar la coherencia operativa al vincular la corrección de errores directamente con el núcleo de gestión de la aplicación.

## Notas Importantes y Consideraciones

*   **Sugerencias de IA**: Las sugerencias de código, refactorización o análisis generadas por la IA son herramientas poderosas, pero no infalibles. **Siempre revisa, comprende y prueba exhaustivamente cualquier cambio propuesto por la IA antes de aplicarlo a tu código de producción.**
*   **Límites de API y Timeouts**: El uso intensivo de las funcionalidades de IA puede llevar a alcanzar los límites de tasa de las APIs de los proveedores o a que las solicitudes excedan los tiempos de espera configurados.
    *   **Fragmentación en AutoUpdate**: Para el análisis del propio código fuente de CodeAlchemist, la aplicación divide el código en fragmentos (por defecto, alrededor de 3500 caracteres por fragmento) y procesa cada uno con un retraso entre ellos (por defecto, 7 segundos) para mitigar problemas con los límites de tokens por minuto (TPM). Estos valores son internos y buscan un equilibrio entre velocidad y fiabilidad.
*   **Seguridad**:
    *   La función **"Aplicar Sugerencia"** en la sección "AutoUpdate" modifica directamente los archivos del sistema de CodeAlchemist. Úsala con extrema precaución y asegúrate de tener copias de seguridad o control de versiones.
    *   Las **Capacidades de Agente** como "Capacidad de Ejecución" o "Capacidad Lectura/Escritura" son potencialmente peligrosas si no se configuran y utilizan en un entorno seguro y controlado. Habilítalas solo si comprendes completamente las implicaciones de seguridad.
*   **Costes de API**: El uso de APIs de proveedores de IA (Groq, OpenAI, Anthropic, Google Gemini) puede incurrir en costes según sus modelos de precios. Monitoriza tu uso y presupuesto. El uso de modelos locales (LM Studio, Ollama) no incurre en estos costes de API externos.
*   **Privacidad**: Cuando utilizas un proveedor de IA basado en la nube, tu código y prompts se envían a sus servidores para ser procesados. Revisa las políticas de privacidad y manejo de datos de cada proveedor. Si la privacidad es una preocupación primordial, considera usar modelos locales a través de LM Studio u Ollama.
*   **Estado de Funcionalidades**: Algunas funcionalidades pueden estar marcadas como "(Simulado)" o estar en una fase temprana de desarrollo (ej. aplicación automática de sugerencias de refactorización en proyectos externos, análisis de Diff avanzado). La plataforma está en continua evolución.

## Estructura de Carpetas y Archivos Clave (Conceptual)

Una descripción general de cómo se podría organizar el código fuente de CodeAlchemist para facilitar su comprensión y mantenimiento:

*   `README.md`: Este archivo, proporcionando una visión general del proyecto.
*   `package.json` (o equivalente): Define las dependencias del proyecto, scripts para desarrollo, construcción y ejecución.
*   `configuracion-next.js` (o equivalente, si se usa un framework específico): Archivo de configuración para el framework web (ej. rutas de imágenes, manejo de errores de construcción).
*   `configuracion-typescript.json` (o equivalente): Configuración para el compilador del lenguaje si se usa uno tipado.
*   `configuracion-estilos.css` (o equivalente): Configuración para el sistema de estilos (ej. Tailwind CSS).
*   `src/app/estilos-globales.css`: Estilos globales y variables de tema para la interfaz de usuario (colores, fuentes).
*   `src/app/plantilla-raiz.tsx` (o equivalente): El componente principal o plantilla raíz de la aplicación, donde se define la estructura HTML base.
*   `src/app/(app)/plantilla-app.tsx` (o equivalente): Plantilla para las páginas principales de la aplicación, que usualmente incluye la barra lateral y otros elementos comunes de la interfaz.
*   `src/app/(app)/[nombre_seccion]/pagina.tsx` (o equivalente): Componentes que definen la interfaz de usuario para cada sección principal (ej. `panel-control`, `analizar-codigo`, `autoupdate`).
*   `src/app/(app)/[nombre_seccion]/acciones.ts` (o equivalente): Módulos que contienen la lógica del lado del servidor o las acciones para las funcionalidades de cada sección (ej. llamadas a APIs de IA, manejo de archivos, operaciones Git).
*   `src/components/ui/`: Componentes de interfaz de usuario reutilizables (Botones, Tarjetas, Entradas de texto, etc.).
*   `src/components/layout/`: Componentes estructurales de la interfaz (ej. `barra-lateral.tsx`).
*   `src/components/[nombre_componente_especifico].tsx` (o equivalente): Componentes personalizados y reutilizables para funcionalidades específicas (ej. `formulario-configuracion.tsx`, `visor-versiones.tsx`, `modal-ejecucion-grupo.tsx`).
*   `src/services/servicio-ia.ts` (o equivalente): Módulo central para interactuar con las APIs de los diferentes proveedores de IA. Contiene funciones para analizar código, generar código, analizar fragmentos de proyectos, etc. Maneja la construcción de la solicitud, autenticación y reintentos.
*   `src/config/configuracion-ia.ts`: Define los proveedores de IA soportados, sus URLs base, si requieren clave API, y los modelos disponibles para cada uno con sus características (TPM, tokens, etc.). También define claves para el almacenamiento local.
*   `src/config/configuracion-agentes.ts`: Define constantes relacionadas con agentes y grupos, como las claves de almacenamiento local y nombres de agentes especiales como `ORCHESTRATOR_AGENT_NAME`.
*   `src/types/`: Contiene definiciones de tipos y estructuras de datos utilizadas en toda la aplicación (ej. `agente.ts` para la configuración de Agentes y Grupos, `snapshot.ts` para las Versiones Guardadas).
*   `src/lib/utilidades-ia.ts`: Funciones de utilidad relacionadas con la configuración de IA, como la que determina qué configuración LLM usar basado en la selección del usuario (global, agente o grupo).
*   `src/hooks/`: Funciones reutilizables (hooks) para la lógica de la interfaz de usuario (ej. para notificaciones, para detectar dispositivos móviles).
*   `src/contexts/ContextoDebug.tsx` (o equivalente): Contexto global para gestionar el estado del modo de depuración y los logs que se muestran en la ventana de depuración.

## Pruebas Unitarias (Conceptual)

Aunque no se incluye código de pruebas en esta descripción, un proyecto robusto como CodeAlchemist requeriría pruebas unitarias y de integración. Algunas áreas clave para probar serían:

*   **Validación de Carga de Proyectos ("Refactorizar Proyecto", "Analizar Proyecto")**:
    *   Asegurar que se aceptan archivos ZIP, JSON y de texto válidos.
    *   Rechazar tipos de archivo no soportados o corruptos.
    *   Manejar límites de tamaño de archivo.
    *   Probar la obtención de contenido desde URLs de Git válidas e inválidas.
*   **Flujo de Trabajo de Agentes y Grupos (especialmente para "Refactorizar Proyecto" y "AutoUpdate" si usan grupos)**:
    *   Verificar que el `OrquestadorFlujoAgentes` recibe la tarea correctamente y la delega al agente apropiado (ej. `RefactorizadorCodigoExperto`).
    *   Asegurar que el agente especialista procesa la entrada y genera una respuesta en el formato esperado.
    *   Probar el flujo completo cuando un grupo de trabajo es seleccionado, incluyendo múltiples turnos y la correcta gestión del historial de conversación.
    *   Verificar el manejo de errores si un agente falla o devuelve una respuesta inesperada.
*   **Resolución de Configuración LLM (`utilidades-ia.ts` o similar)**:
    *   Probar la función que resuelve las opciones LLM con diferentes escenarios: configuración global, agente específico (con config default y custom), grupo de trabajo.
    *   Asegurar que se seleccionan las claves API, modelos y URLs correctas.
*   **Manejo de Errores Críticos**:
    *   Simular respuestas de error de APIs LLM (ej. clave inválida, modelo no encontrado, límites de tasa, timeouts) y verificar que la UI los muestra correctamente y que la funcionalidad de "Auto-Fix" (si aplica) se activa.
    *   Probar errores de conexión Git (autenticación fallida, repositorio no encontrado).
*   **Fragmentación de Código ("AutoUpdate")**:
    *   Verificar que la función que obtiene el código fuente de la aplicación y la que maneja el auto-análisis dividen correctamente el código en fragmentos según el límite de caracteres configurado.
*   **Aplicación de Sugerencias ("AutoUpdate")**:
    *   En un entorno de prueba controlado, probar que la función para aplicar cambios modifica correctamente los archivos en el sistema de archivos simulado.
*   **Operaciones Git ("AutoUpdate" - Subida a Git)**:
    *   Probar la subida a un repositorio Git de prueba, verificando commits y autenticación.

## Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un *issue* (incidencia) en el repositorio del proyecto para discutir cambios importantes antes de enviar un *Pull Request* (solicitud de integración de cambios).

## Licencia

(Opcional: Especifica una licencia para el proyecto, por ejemplo, MIT License, Apache 2.0, etc.)

---

¡Gracias por usar CodeAlchemist! Esperamos que esta plataforma te sea de gran utilidad para mejorar tu código y optimizar tu flujo de trabajo de desarrollo.
```