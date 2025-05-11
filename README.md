# CodeAlchemist

CodeAlchemist es una plataforma de desarrollo asistido por inteligencia artificial (IA) diseñada para optimizar y agilizar el ciclo de vida del desarrollo de software. Ofrece herramientas para la generación y análisis de código, refactorización asistida, gestión de versiones, ejecución de grupos de trabajo IA y análisis de proyectos completos, todo ello potenciado por diversos modelos de IA a través de sus respectivas APIs o endpoints locales.

## Características Principales

*   **Generación de Código**: Crea fragmentos de código a partir de descripciones en lenguaje natural.
*   **Generación de Proyectos**: Define una estructura base para nuevos proyectos según tus especificaciones.
*   **Análisis de Código Inteligente**: Pega fragmentos de código o sube archivos para recibir análisis detallados y sugerencias de mejora generadas por IA.
*   **Análisis de Proyecto Completo**: Sube un proyecto en formato ZIP/JSON o proporciona una URL de Git para un análisis holístico (funcionalidad Git actualmente simulada).
*   **AutoUpdate (Análisis del Propio Código)**: Permite que CodeAlchemist analice su propio código fuente. Ofrece sugerencias, permite aplicarlas directamente (modificando los archivos), descargar el código fuente completo en ZIP, o subirlo a un repositorio Git. Las comunicaciones con la IA están optimizadas para manejar grandes cantidades de código mediante fragmentación y timeouts.
*   **Versiones Guardadas (Snapshots)**: Guarda diferentes versiones de tu código (original y sugerido) para una fácil revisión, comparación y seguimiento.
*   **Chat con IA**: Interactúa con un asistente IA para obtener ayuda, resolver dudas o generar ideas.
*   **Gestión de Agentes IA**: Crea y configura agentes IA individuales, cada uno con su propio mensaje de sistema, configuración LLM (global o personalizada) y capacidades (acceso a código propio, ejecución, entorno virtual, lectura/escritura de archivos).
*   **Gestión de Grupos de Trabajo IA**: Define grupos de agentes para colaborar en tareas complejas. Un agente "Orquestador" dirige el flujo de trabajo. Observa la ejecución en un log detallado.
*   **Interfaz de Usuario Intuitiva**: Construida con Next.js y ShadCN UI para una experiencia de usuario moderna, responsiva y agradable. La barra lateral es colapsable para maximizar el espacio de trabajo.
*   **Configuración Personalizada**:
    *   **LLM**: Selecciona el proveedor (Groq, OpenAI, Anthropic, LM Studio, Ollama), introduce tu clave API (si es necesaria), elige el modelo y, para proveedores locales, especifica la URL de la API. Incluye un test de conexión.
    *   **Git**: Configura la URL del repositorio, nombre de usuario, email y Token de Acceso Personal (PAT) para la funcionalidad de subida a Git en AutoUpdate. Incluye un test de conexión.
*   **Manejo de Errores Mejorado**: Los errores, especialmente durante las interacciones con la IA o Git, se muestran claramente. Se pueden copiar para depuración y, en algunos casos (AutoUpdate, Subida a Git), se ofrece un botón "Auto-Fix" para que la IA intente proponer una solución al error. CodeAlchemist intenta gestionar errores comunes de API LLM (límites de tokens/TPM, timeouts) con reintentos y fragmentación.

## Arquitectura

CodeAlchemist está construido con Next.js (utilizando el App Router) y React para el frontend. El backend se basa en Server Actions de Next.js para manejar la lógica de negocio y las interacciones con servicios externos.

*   **Frontend**: Next.js, React, TypeScript, Tailwind CSS, ShadCN UI.
*   **Backend (Server Actions)**: Lógica para interactuar con APIs LLM, gestión de archivos (para AutoUpdate), operaciones Git.
*   **Capa de Servicios LLM**: Un módulo (`src/services/groq.ts`, aunque el nombre es histórico y ahora es genérico) abstrae las llamadas a diferentes proveedores de LLM, manejando la construcción de la solicitud, autenticación y reintentos.
*   **Configuración LLM**: Los usuarios pueden configurar un proveedor LLM global o especificar configuraciones personalizadas para cada Agente IA.
*   **Persistencia**: La configuración de la aplicación, agentes, grupos y snapshots de código se almacenan en el `localStorage` del navegador.

## Tecnologías Utilizadas

*   **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS, ShadCN UI
*   **IA y Modelos de Lenguaje**: APIs de Groq, OpenAI, Anthropic; soporte para endpoints locales de LM Studio y Ollama.
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

Es crucial configurar correctamente la aplicación antes de usar las funcionalidades de IA.

*   **Configuración del Proveedor LLM**:
    *   **Proveedor LLM**: Selecciona el servicio que deseas utilizar (Groq, OpenAI, Anthropic, LM Studio, Ollama).
    *   **URL del Endpoint de API**: Para proveedores como LM Studio u Ollama, o si usas un proxy para OpenAI/Anthropic, introduce la URL base del endpoint (ej. `http://localhost:1234/v1` para LM Studio). Para Groq, OpenAI, Anthropic, este campo se rellena automáticamente con el valor por defecto, pero puedes sobrescribirlo.
    *   **Clave API**: Si el proveedor seleccionado la requiere (ej. Groq, OpenAI, Anthropic), introduce tu clave API.
    *   **Nombre del Modelo**: Selecciona uno de los modelos disponibles para el proveedor elegido. La lista se actualiza según el proveedor. Algunos modelos pueden requerir una clave API válida para ser listados o para funcionar.
    *   Haz clic en **"Probar Conexión (Proveedor LLM)"** para verificar que tu configuración es correcta. Recibirás una notificación de éxito o un mensaje de error.
*   **Configuración de Git (Opcional, para AutoUpdate)**:
    *   **URL del Repositorio Git**: La URL HTTPS de tu repositorio (ej. `https://github.com/tu-usuario/tu-repo.git`).
    *   **Nombre de Usuario Git**: Tu nombre de usuario de la plataforma Git (ej. GitHub, GitLab).
    *   **Email de Git**: El email asociado a tus commits de Git.
    *   **Token de Acceso Personal (PAT)**: Un PAT con permisos para escribir en el repositorio. NO uses tu contraseña.
    *   Haz clic en **"Probar Conexión Git"** para verificar la autenticación y el acceso al repositorio.
*   Haz clic en **"Guardar Configuración"**. Tus ajustes se guardarán en el `localStorage` de tu navegador.

### 3. Generar Código (Sección "Generar Código")

Crea fragmentos de código a partir de descripciones.

*   **Usar Configuración LLM De**: Elige si usar la configuración "Global" (definida en Ajustes) o la configuración de un "Agente IA" específico.
*   **Describe tu necesidad**: Escribe un prompt detallado describiendo la función, clase o fragmento de código que necesitas (ej. "Una función en Python que reciba una lista de números y devuelva la suma de los pares.").
*   Haz clic en **"Generar Código"**. Se te pedirá confirmación.
*   Una vez confirmado, la IA procesará tu solicitud.
*   **Resultados**:
    *   **Explicación**: Una descripción del código generado.
    *   **Fragmento de Código**: El código generado por la IA. Puedes copiarlo usando el botón respectivo.

### 4. Generar Proyecto (Sección "Generar Proyecto")

Crea una estructura base para un nuevo proyecto.

*   **Usar Configuración LLM De**: Selecciona la fuente de configuración LLM.
*   **Describe tu proyecto**: Proporciona un prompt detallado sobre el tipo de proyecto, tecnologías, estructura de carpetas deseada y archivos iniciales (ej. "Un proyecto simple de API REST con Express.js y TypeScript. Incluir una ruta GET /health y una ruta POST /users. Configuración básica de ESLint y Prettier.").
*   Haz clic en **"Generar Proyecto"** y confirma.
*   **Resultados**:
    *   **Nombre del Proyecto (sugerido)**.
    *   **Notas de la IA**: Comentarios o próximos pasos.
    *   **Archivos Generados**: Una lista de archivos con sus rutas y contenido. Puedes expandir cada archivo para ver su contenido.
    *   Haz clic en **"Descargar Proyecto (ZIP)"** para obtener la estructura generada.

### 5. Analizar Código (Sección "Analizar Código")

Obtén análisis y sugerencias para fragmentos o archivos.

*   **Usar Configuración LLM De**: Selecciona la fuente de configuración LLM.
*   **Sube un archivo de código (opcional)**: Haz clic para seleccionar un archivo de tu sistema. Su contenido se cargará en el área de texto.
*   **Entrada de Código**: Pega tu código directamente o edita el contenido del archivo subido.
*   Haz clic en **"Analizar Código"**.
*   **Resultados**:
    *   **Explicación**: Descripción de las mejoras sugeridas por la IA.
    *   **Código Original**: Tu código de entrada.
    *   **Código Sugerido**: La versión refactorizada propuesta por la IA.
*   **Guardar Versiones**: Puedes guardar el "Código Original" y/o el "Código Sugerido" como snapshots haciendo clic en los botones **"Guardar Versión"**.

### 6. Analizar Proyecto Completo (Sección "Analizar Proyecto")

Analiza proyectos enteros (actualmente, la parte de análisis de Git es simulada).

*   **Usar Configuración LLM De**: Selecciona la fuente de configuración LLM.
*   **Pestañas**:
    *   **Subir Archivo (ZIP/JSON)**: Sube un archivo `.zip` o `.json` de tu proyecto.
    *   **Desde Repositorio Git**: Ingresa la URL de un repositorio Git.
*   Haz clic en **"Analizar Proyecto"**.
*   *Nota: El análisis de Git es simulado y mostrará resultados de ejemplo. El análisis de ZIP también está en desarrollo y proveerá resultados basados en la capacidad actual del modelo.*

### 7. AutoUpdate (Sección "AutoUpdate")

Permite que CodeAlchemist analice su propio código fuente.

*   **Usar Configuración LLM De**: Selecciona la fuente de configuración LLM.
*   **Preferencias de Análisis (Opcional)**: Introduce texto para guiar a la IA (ej. "mejorar rendimiento de componentes de UI", "revisar manejo de errores"). Si se selecciona un "Grupo", este texto se usará como la tarea principal para el grupo.
*   Haz clic en **"Iniciar Auto-Análisis"**.
    *   La aplicación recopila su código fuente (excluyendo `node_modules`, `.next`, etc.).
    *   Si no se usa un grupo, el código se divide en fragmentos para respetar límites de tokens/TPM y evitar timeouts. Se muestra una barra de progreso.
    *   Si se usa un grupo, la tarea (junto con las preferencias) se pasa al Orquestador del grupo.
*   **Resultados**:
    *   **Título del Análisis**.
    *   **Áreas Identificadas**: Archivos o componentes clave.
    *   **Sugerencias Detalladas**: Lista de sugerencias (área, descripción, prioridad, y a veces contenido de archivo sugerido).
    *   **Evaluación General**.
*   **Aplicar Sugerencias**: Para sugerencias con contenido de archivo completo:
    *   Haz clic en **"Aplicar Sugerencia"** (o "Reintentar Aplicar" si falló).
    *   Se mostrará un diálogo de confirmación con el contenido original y el sugerido.
    *   Al confirmar, el archivo correspondiente en el sistema de CodeAlchemist **será modificado**. ¡Usa con precaución!
*   **Descargar Código Fuente Completo**: Descarga un ZIP con el estado actual del código fuente de la aplicación (incluyendo cambios aplicados).
*   **Subir a Git**: Si la configuración de Git está completa en "Ajustes", este botón subirá el estado actual del código fuente al repositorio configurado, creando un nuevo commit.
*   **Manejo de Errores y Auto-Fix**:
    *   Si ocurre un error (ej. límite de API, error de Git), se mostrará.
    *   Puedes copiar el mensaje de error.
    *   Un botón **"Auto-Fix (Experimental)"** aparecerá, permitiendo que la IA intente analizar el error y proponer una solución. Se abrirá un diálogo con la propuesta de la IA. Para errores de Git, si la propuesta es aceptada, puede reintentar la subida. Para errores de análisis, puede reintentar el análisis.
*   **Logs de Ejecución Detallados**:
    *   Una ventana muestra logs detallados del proceso (cliente y servidor).
    *   Botones para **Copiar Logs**, **Borrar Logs** y **Expandir/Contraer** la ventana de logs.

### 8. Versiones Guardadas (Sección "Versiones Guardadas")

Gestiona snapshots de tu código.

*   Muestra una lista de todas las versiones guardadas.
*   **Acciones por versión**:
    *   **Ver (👁️)**: Abre un diálogo para ver el código de la versión.
    *   **Descargar (📥)**: Descarga el código de esa versión.
    *   **Eliminar (🗑️)**: Elimina la versión.
*   **Comparar Versiones**:
    *   Selecciona una versión como **"A"** y otra como **"B"** usando los botones respectivos.
    *   Se abrirá un diálogo mostrando las diferencias resaltadas entre los dos códigos.
*   **Eliminar Todas**: Botón para borrar todas las versiones guardadas.

### 9. Chat con IA (Sección "Chat con IA")

Conversa directamente con un asistente IA.

*   **Usar Configuración LLM De**: Selecciona la fuente de configuración LLM.
*   Escribe tu mensaje en el área de texto y presiona Enter o el botón de enviar.
*   El historial de chat se muestra arriba.
*   Puedes borrar el chat actual.

### 10. Gestión de Agentes IA (Sección "Agentes IA")

Crea y administra agentes IA personalizados.

*   Muestra una lista de agentes creados.
*   **Crear Agente**:
    *   **Nombre, Descripción, Mensaje de Sistema (Prompt)**.
    *   **Capacidades del Agente**:
        *   **Acceso a Código Propio**: Permite leer el código fuente de la aplicación.
        *   **Capacidad de Ejecución**: Permite ejecutar código (¡Peligroso!).
        *   **Capacidad de Entorno Virtual**: Permite gestionar entornos virtuales.
        *   **Capacidad Lectura/Escritura**: Permite leer/escribir archivos (¡Peligroso!).
    *   **Configuración LLM del Agente**:
        *   **Usar Configuración Global**: El agente usará los ajustes de la sección "Configuración".
        *   **Configuración Personalizada**: Define un Proveedor, Modelo, Clave API (opcional, sobrescribe la global) y URL de API (opcional) específicos para este agente.
*   **Acciones por Agente**:
    *   **Probar (💬)**: Abre un chat modal para interactuar directamente con el agente usando su configuración.
    *   **Exportar (📥)**: Descarga la configuración del agente en JSON.
    *   **Editar (✏️)**.
    *   **Eliminar (🗑️)**.
*   **Importar/Exportar Todos**: Botones para importar un archivo JSON de agentes o exportar todos los agentes actuales.

### 11. Gestión de Grupos de Trabajo IA (Sección "Grupos de Trabajo IA")

Define equipos de agentes para tareas colaborativas.

*   Muestra una lista de grupos creados.
*   **Crear Grupo**:
    *   **Nombre, Descripción, Tarea Principal del Grupo**.
    *   **Agentes en el Grupo**: Selecciona los agentes participantes. El agente **`OrquestadorFlujoAgentes`** (o "Orquestador del Grupo") se añade automáticamente y no se puede quitar; es responsable de dirigir el flujo de trabajo.
*   **Acciones por Grupo**:
    *   **Ejecutar (▶️)**: Abre un modal de ejecución donde el Orquestador del Grupo comienza a procesar la tarea con los agentes seleccionados. Se muestra un log detallado de las interacciones, decisiones del orquestador y respuestas de los agentes. La ejecución tiene un número máximo de turnos.
    *   **Editar (✏️)**.
    *   **Eliminar (🗑️)**.

## Flujo de Trabajo con IA

### Selección de Fuente de Configuración LLM

En la mayoría de las secciones que interactúan con un LLM (Generar Código, Analizar Código, AutoUpdate, Chat, etc.), encontrarás un selector llamado **"Usar Configuración LLM De:"**. Este te permite elegir:

1.  **Ajustes Globales**: Utiliza la configuración (proveedor, modelo, API key, URL) definida en la sección "Configuración".
2.  **Agente: [Nombre del Agente]**: Utiliza la configuración LLM específica definida para ese agente en "Gestión de Agentes IA". Si el agente está configurado para usar "default", se recurrirá a los Ajustes Globales.
3.  **Grupo: [Nombre del Grupo]** (En AutoUpdate, Generar Código, Generar Proyecto, Analizar Código, Analizar Proyecto): La tarea o prompt principal se pasa como objetivo al agente Orquestador del Grupo seleccionado. El Orquestador utilizará su propia configuración LLM para tomar decisiones y luego invocará a otros agentes del grupo, cada uno usando su respectiva configuración LLM.

### Agentes y Grupos de Trabajo

*   **Agentes**: Son entidades IA con un rol (definido por su mensaje de sistema), capacidades y una configuración LLM. Actúan individualmente o como parte de un grupo.
*   **Grupos de Trabajo**: Son equipos de agentes colaborando en una tarea común.
    *   El **Orquestador del Grupo** (agente `OrquestadorFlujoAgentes`) es una pieza obligatoria y fundamental. Se encarga de recibir y gestionar todas las respuestas generadas dentro del grupo. En caso de que el usuario no haya realizado una propuesta explícita sobre el siguiente paso, el Orquestador decidirá a qué agente o subgrupo derivar la interacción. Todas las respuestas deben pasar obligatoriamente por el Orquestador para garantizar un flujo coordinado y la toma de decisiones centralizada.
    *   La ejecución de un grupo es una secuencia de turnos. En cada turno, el Orquestador toma una decisión, y luego el agente seleccionado (si lo hay) responde. Esto continúa hasta que la tarea se considera completa o se alcanza el número máximo de turnos.

## Manejo de Errores

*   **Errores de API LLM**:
    *   **Límites de Tokens/TPM (ej. 429 Too Many Requests, 413 Payload Too Large)**: CodeAlchemist implementa reintentos con backoff exponencial para errores 429. Para errores 413 (payload demasiado grande), especialmente en AutoUpdate, el código fuente se divide en fragmentos más pequeños antes de enviarlo a la IA.
    *   **Timeouts**: Las llamadas a las APIs tienen timeouts configurados para evitar bloqueos indefinidos.
*   **Copia de Errores**: Cuando se muestra un mensaje de error en la UI (ej. en AutoUpdate o Chat), generalmente hay un botón o la opción de copiar el mensaje de error para facilitar la depuración.
*   **Auto-Fix (Experimental)**:
    *   En la sección **AutoUpdate**, si ocurre un error durante el análisis del código o durante una subida a Git, aparecerá un botón **"Auto-Fix"**.
    *   Al hacer clic, la IA analizará el mensaje de error y el contexto, y propondrá una posible causa raíz y sugerencias de solución en un diálogo.
    *   Para errores de Git, si la propuesta es aceptada (y tiene sentido), puede permitir reintentar la operación Git. Para errores de análisis, puede permitir reintentar el análisis.
    *   Esta función es experimental y las soluciones propuestas deben ser revisadas cuidadosamente.

## Notas Importantes y Consideraciones

*   **Sugerencias de IA**: El código y las sugerencias generadas por la IA son herramientas para asistir en el desarrollo. **Siempre revisa, comprende y prueba exhaustivamente los cambios propuestos antes de integrarlos en tu trabajo o aplicarlos directamente (como en AutoUpdate).**
*   **API Limits & Timeouts**: Aunque CodeAlchemist intenta gestionar los límites, el uso intensivo puede llevar a errores temporales de las APIs LLM.
    *   **Fragmentación en AutoUpdate**: Para el análisis del propio código, si el código fuente completo es demasiado grande, se divide en fragmentos de aproximadamente `MAX_CHARS_PER_CHUNK` (actualmente ~3500 caracteres). Cada fragmento se envía por separado, con un retraso (`INTER_CHUNK_PROCESSING_DELAY_MS`, actualmente 5 segundos) entre ellos para ayudar a gestionar los límites de TPM.
*   **Seguridad**:
    *   **Aplicación de Cambios en AutoUpdate**: La función "Aplicar Sugerencia" **modifica directamente los archivos** en el sistema donde se ejecuta CodeAlchemist. Ten extrema precaución.
    *   **Capacidades de Agente**: Habilitar "Capacidad de Ejecución" o "Capacidad Lectura/Escritura" para agentes IA es **potencialmente peligroso** y solo debe hacerse en entornos controlados y seguros, entendiendo los riesgos.
*   **Costes de API**: El uso de APIs LLM (Groq, OpenAI, Anthropic) puede incurrir en costes según tu plan y volumen de uso. Monitoriza tu consumo en los paneles de control de los respectivos proveedores.
*   **Privacidad**: El código que envías para análisis o generación se procesa en los servidores del proveedor LLM seleccionado (o localmente si usas LM Studio/Ollama). Revisa las políticas de privacidad de los proveedores si tienes preocupaciones sobre la confidencialidad.
*   **Estado de Funcionalidades**: Algunas funcionalidades, como el análisis detallado de proyectos Git o la aplicación automática de todas las sugerencias de un grupo, pueden estar aún en desarrollo o ser simuladas. El README intentará reflejar el estado actual.

## Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un *issue* para discutir cambios importantes o envía un *Pull Request*.

## Licencia

(Opcional: Especifica una licencia, por ejemplo, MIT License)

---

¡Gracias por usar CodeAlchemist! Esperamos que te ayude a mejorar tu código y tu flujo de trabajo de desarrollo.
