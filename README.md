# YskCodeAI

YskCodeAI es una plataforma de desarrollo asistido por inteligencia artificial (IA) diseñada para optimizar y agilizar el ciclo de vida del desarrollo de software. Ofrece herramientas para el análisis de código, sugerencias de refactorización, gestión de versiones y análisis de proyectos completos, todo ello potenciado por modelos de IA de vanguardia a través de la API de Groq.

## Características Principales

*   **Análisis de Código Inteligente**: Pega fragmentos de código o sube archivos para recibir análisis detallados y sugerencias de mejora generadas por IA.
*   **Refactorización Asistida**: Obtén propuestas de código refactorizado junto con explicaciones claras de los cambios.
*   **Gestión de Versiones (Snapshots)**: Guarda diferentes versiones de tu código (original y sugerido) para una fácil revisión, comparación y seguimiento.
*   **Análisis de Proyecto Completo (Simulado)**: Sube un proyecto en formato ZIP o proporciona una URL de Git para un análisis holístico (actualmente simulado, funcionalidad en desarrollo).
*   **AutoUpdate (Análisis del Propio Código)**: Permite que YskCodeAI analice su propio código fuente, ofreciendo sugerencias para su mejora y la opción de descargar el código fuente completo de la aplicación en un archivo ZIP.
*   **Interfaz de Usuario Intuitiva**: Construida con Next.js y ShadCN UI para una experiencia de usuario moderna, responsiva y agradable.
*   **Configuración Personalizada**: Configura tu clave API de Groq y selecciona el modelo de IA que mejor se adapte a tus necesidades.

## Tecnologías Utilizadas

*   **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS, ShadCN UI
*   **IA y Modelos de Lenguaje**: Groq API (para acceso a LLMs como Llama, Mixtral, Gemma)
*   **Análisis de Código (Objetivo Inicial)**: Python (con planes de expansión a otros lenguajes)
*   **Empaquetado (Descarga de Fuente)**: JSZip

## Instalación

Sigue estos pasos para configurar y ejecutar YskCodeAI en tu entorno local:

### Prerrequisitos

*   Node.js (versión 18.x o superior recomendada)
*   npm (normalmente incluido con Node.js) o Yarn

### Pasos de Instalación

1.  **Clonar el Repositorio**:
    ```bash
    git clone https://github.com/tu-usuario/yskcodeai.git
    cd yskcodeai
    ```
    *(Reemplaza `https://github.com/tu-usuario/yskcodeai.git` con la URL real del repositorio si es diferente)*

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
    *   Crea un archivo `.env.local` en la raíz del proyecto. Para ello, puedes copiar el archivo `.env.example` (si existe) o crearlo desde cero.
        ```bash
        cp .env.example .env.local
        ```
        O simplemente crea un nuevo archivo `.env.local`.
    *   Abre el archivo `.env.local` y añade tu clave API de Groq:
        ```env
        # No se requieren variables de entorno específicas por ahora,
        # la clave API de Groq se gestiona desde la UI y localStorage.
        # Sin embargo, si futuras integraciones requieren claves del lado del servidor,
        # se añadirían aquí. Por ejemplo:
        # GROQ_API_KEY_SERVER=tu_clave_api_de_groq_para_servidor
        ```
        **Importante**: La clave API de Groq se configura principalmente a través de la interfaz de usuario de la aplicación (en la sección "Configuración") y se almacena en el `localStorage` de tu navegador. El archivo `.env.local` se usaría para variables de entorno del lado del servidor si fueran necesarias en el futuro.

4.  **Ejecutar la Aplicación en Desarrollo**:
    ```bash
    npm run dev
    ```
    O si usas Yarn:
    ```bash
    yarn dev
    ```
    La aplicación debería estar disponible en `http://localhost:9002` (o el puerto que hayas configurado).

## Tutorial de Uso

Una vez que la aplicación esté en funcionamiento, sigue esta guía para aprovechar sus características:

1.  **Configuración Inicial**:
    *   Navega a la sección **Configuración** desde la barra lateral.
    *   Introduce tu **Clave API de Groq**. Puedes obtener una clave API registrándote en [GroqCloud](https://console.groq.com/).
    *   Selecciona el **Nombre del Modelo de Groq** que deseas utilizar (por ejemplo, `llama3-8b-8192`, `mixtral-8x7b-32768`).
    *   Haz clic en **"Probar Conexión"** para verificar que tu clave API y el modelo seleccionado funcionan correctamente. Deberías recibir una notificación de éxito.
    *   Haz clic en **"Guardar Configuración"**. Tus ajustes se guardarán en el almacenamiento local de tu navegador.

2.  **Analizar Código (Fragmentos o Archivos)**:
    *   Ve a la sección **Analizar Código**.
    *   Puedes pegar tu código directamente en el área de texto o subir un archivo de código (`.py`, `.js`, `.ts`, etc.) usando el botón **"Sube un archivo de código"**.
    *   Haz clic en **"Analizar Código"**. La IA procesará tu código y mostrará:
        *   **Explicación**: Una descripción de las mejoras sugeridas.
        *   **Código Original**: Tu código de entrada.
        *   **Código Sugerido**: La versión refactorizada propuesta por la IA.
    *   Puedes guardar tanto el código original como el sugerido como una "Versión" (snapshot) haciendo clic en los botones **"Guardar Versión"** correspondientes.

3.  **AutoUpdate (Análisis del Propio Código de YskCodeAI)**:
    *   Dirígete a la sección **AutoUpdate**.
    *   Esta función permite a YskCodeAI analizar su propio código fuente.
    *   **Preferencias de Análisis (Opcional)**: Puedes introducir texto en el área designada para guiar a la IA sobre qué tipo de actualizaciones o áreas específicas te gustaría que analizara (por ejemplo, "mejorar rendimiento de componentes de UI", "revisar manejo de errores en servicios").
    *   Haz clic en **"Iniciar Auto-Análisis"**. La aplicación recopilará su código fuente y lo enviará a la IA.
    *   Los resultados incluirán:
        *   **Título del Análisis**.
        *   **Áreas Identificadas**: Archivos o componentes clave que la IA sugiere revisar.
        *   **Sugerencias Detalladas**: Una lista de sugerencias específicas, cada una con un área, la descripción de la sugerencia, y a veces una prioridad.
        *   **Evaluación General**.
    *   **Aplicar Sugerencias**: Para cada sugerencia, puedes hacer clic en **"Aplicar Sugerencia"**. Esto mostrará el contenido original y el contenido que la IA propone. Al confirmar, la acción de aplicar el cambio se registra (la modificación real del archivo en el sistema está desactivada por seguridad en esta versión, pero la lógica simula cómo se aplicaría).
    *   **Descargar Código Fuente Completo**: Haz clic en este botón para descargar un archivo ZIP que contiene todo el código fuente actual de la aplicación YskCodeAI.

4.  **Analizar Proyecto Completo (Simulado)**:
    *   Accede a la sección **Analizar Proyecto**.
    *   Aquí puedes subir un archivo ZIP de tu proyecto o proporcionar una URL de un repositorio Git.
    *   Haz clic en **"Analizar Proyecto"**.
    *   *Nota: Actualmente, esta funcionalidad es principalmente simulada y no realiza un análisis profundo con la IA sobre el contenido del ZIP/Git de la misma manera que "Analizar Código" o "AutoUpdate". Muestra resultados de ejemplo.*

5.  **Versiones Guardadas**:
    *   Visita la sección **Versiones Guardadas**.
    *   Verás una lista de todas las versiones de código que has guardado.
    *   **Ver**: Haz clic en el icono del ojo (👁️) para ver el contenido de una versión.
    *   **Descargar**: Haz clic en el icono de descarga (📥) para bajar el código de esa versión.
    *   **Eliminar**: Haz clic en el icono de la papelera (🗑️) para eliminar una versión. También hay un botón para "Eliminar Todas".
    *   **Comparar**:
        *   Selecciona una versión como "A" y otra como "B" usando los respectivos botones.
        *   Una vez que A y B estén seleccionados, se abrirá un diálogo mostrando las diferencias entre los dos códigos, resaltando líneas añadidas y eliminadas.

6.  **Panel de Control (Dashboard)**:
    *   Es la página de inicio después de la configuración.
    *   Proporciona una bienvenida y accesos directos a las principales secciones de la aplicación.

## Notas Importantes

*   **Sugerencias de IA**: Las sugerencias y el código generado por la IA son herramientas para asistir en el desarrollo. Siempre revisa y comprende los cambios propuestos antes de integrarlos en tu trabajo.
*   **Aplicación de Cambios en AutoUpdate**: La función "Aplicar Sugerencia" en la sección AutoUpdate está diseñada para mostrar cómo la IA modificaría los archivos. Por razones de seguridad, la escritura directa de archivos en el sistema de la aplicación está actualmente desactivada; en su lugar, los cambios se registran en la consola.
*   **Costes de API**: El uso de la API de Groq puede incurrir en costes dependiendo de tu plan y el volumen de uso. Monitoriza tu consumo en el panel de control de GroqCloud.
*   **Privacidad**: El código que envías para análisis a través de la API de Groq se procesa en sus servidores. Revisa la política de privacidad de Groq si tienes preocupaciones sobre la confidencialidad de tu código.

## Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue para discutir cambios importantes o envía un Pull Request.

## Licencia

(Opcional: Especifica una licencia, por ejemplo, MIT License)

---

¡Gracias por usar YskCodeAI! Esperamos que te ayude a mejorar tu código y tu flujo de trabajo de desarrollo.
