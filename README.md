# YskCodeAlchemist

YskCodeAlchemist es una plataforma de desarrollo asistido por inteligencia artificial (IA) diseñada para optimizar y agilizar el ciclo de vida del desarrollo de software. Ofrece herramientas para el análisis de código, sugerencias de refactorización, gestión de versiones y análisis de proyectos completos, todo ello potenciado por modelos de IA de vanguardia a través de la API de Groq.

## Características Principales

*   **Análisis de Código Inteligente**: Pega fragmentos de código o sube archivos para recibir análisis detallados y sugerencias de mejora generadas por IA.
*   **Refactorización Asistida**: Obtén propuestas de código refactorizado junto con explicaciones claras de los cambios.
*   **Gestión de Versiones (Snapshots)**: Guarda diferentes versiones de tu código (original y sugerido) para una fácil revisión, comparación y seguimiento.
*   **Análisis de Proyecto Completo**: Sube un proyecto en formato ZIP o proporciona una URL de Git para un análisis holístico (funcionalidad en desarrollo, actualmente simulada para la parte de Git).
*   **AutoUpdate (Análisis del Propio Código)**: Permite que YskCodeAlchemist analice su propio código fuente, ofreciendo sugerencias para su mejora. Se puede guiar a la IA con preferencias de análisis y descargar el código fuente completo de la aplicación en un archivo ZIP. Las comunicaciones con la IA están optimizadas para manejar grandes cantidades de código mediante fragmentación y timeouts.
*   **Interfaz de Usuario Intuitiva**: Construida con Next.js y ShadCN UI para una experiencia de usuario moderna, responsiva y agradable. La barra lateral es colapsable para maximizar el espacio de trabajo.
*   **Configuración Personalizada**: Configura tu clave API de Groq y selecciona el modelo de IA que mejor se adapte a tus necesidades, con prueba de conexión.
*   **Manejo de Errores**: Los errores de la aplicación, especialmente durante las interacciones con la IA, se pueden copiar fácilmente desde la interfaz para facilitar la depuración. YskCodeAlchemist intenta gestionar los errores de la API de LLM, como los límites de tokens o timeouts.

## Tecnologías Utilizadas

*   **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS, ShadCN UI
*   **IA y Modelos de Lenguaje**: Groq API (para acceso a LLMs como Llama, Mixtral, Gemma)
*   **Empaquetado (Descarga de Fuente)**: JSZip

## Instalación

Sigue estos pasos para configurar y ejecutar YskCodeAlchemist en tu entorno local:

### Prerrequisitos

*   Node.js (versión 18.x o superior recomendada)
*   npm (normalmente incluido con Node.js) o Yarn

### Pasos de Instalación

1.  **Clonar el Repositorio**:
    ```bash
    git clone https://github.com/tu-usuario/yskcodealchemist.git
    cd yskcodealchemist
    ```
    *(Reemplaza `https://github.com/tu-usuario/yskcodealchemist.git` con la URL real del repositorio si es diferente)*

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
    *   Crea un archivo `.env.local` en la raíz del proyecto. Puedes copiar el archivo `.env.example` (si existe) o crearlo desde cero.
        ```bash
        cp .env.example .env.local
        ```
        O simplemente crea un nuevo archivo `.env.local`.
    *   Abre el archivo `.env.local`. No se requieren variables de entorno específicas por ahora, ya que la clave API de Groq se gestiona desde la UI y `localStorage`.
        ```env
        # No se requieren variables de entorno específicas por ahora.
        # La clave API de Groq se gestiona desde la UI.
        ```
        **Importante**: La clave API de Groq se configura principalmente a través de la interfaz de usuario de la aplicación (en la sección "Configuración") y se almacena en el `localStorage` de tu navegador.

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
    *   Haz clic en **"Probar Conexión"** para verificar que tu clave API y el modelo seleccionado funcionan correctamente. Deberías recibir una notificación de éxito o un mensaje de error detallado si falla.
    *   Haz clic en **"Guardar Configuración"**. Tus ajustes se guardarán en el almacenamiento local de tu navegador.

2.  **Barra Lateral**:
    *   Puedes colapsar la barra lateral haciendo clic en el icono respectivo en la parte superior (generalmente un icono de panel o menú) para tener más espacio para el contenido principal. Haz clic de nuevo para expandirla.

3.  **Analizar Código (Fragmentos o Archivos)**:
    *   Ve a la sección **Analizar Código**.
    *   Puedes pegar tu código directamente en el área de texto o subir un archivo de código (compatible con múltiples extensiones comunes) usando el botón **"Sube un archivo de código"**.
    *   Haz clic en **"Analizar Código"**. La IA procesará tu código y mostrará:
        *   **Explicación**: Una descripción de las mejoras sugeridas.
        *   **Código Original**: Tu código de entrada.
        *   **Código Sugerido**: La versión refactorizada propuesta por la IA.
    *   Puedes guardar tanto el código original como el sugerido como una "Versión" (snapshot) haciendo clic en los botones **"Guardar Versión"** correspondientes.

4.  **Analizar Proyecto Completo**:
    *   Accede a la sección **Analizar Proyecto**.
    *   Aquí puedes subir un archivo ZIP de tu proyecto. (La funcionalidad de análisis desde URL de Git está actualmente simulada).
    *   Haz clic en **"Analizar Proyecto"**.
    *   *Nota: Actualmente, esta funcionalidad está en desarrollo. El análisis del ZIP proporcionará resultados basados en ejemplos, mientras que el análisis de Git es simulado.*

5.  **AutoUpdate (Análisis del Propio Código de YskCodeAlchemist)**:
    *   Dirígete a la sección **AutoUpdate**.
    *   Esta función permite a YskCodeAlchemist analizar su propio código fuente.
    *   **Preferencias de Análisis (Opcional)**: Puedes introducir texto en el área designada para guiar a la IA sobre qué tipo de actualizaciones o áreas específicas te gustaría que analizara (por ejemplo, "mejorar rendimiento de componentes de UI", "revisar manejo de errores en servicios").
    *   Haz clic en **"Iniciar Auto-Análisis"**. La aplicación recopilará su código fuente (excluyendo `node_modules`, `.next`, etc.), lo dividirá en fragmentos manejables si es necesario (para respetar límites de tokens y timeouts de la API de Groq), y lo enviará a la IA. Se mostrará el progreso del procesamiento de fragmentos.
    *   Los resultados incluirán:
        *   **Título del Análisis**.
        *   **Áreas Identificadas**: Archivos o componentes clave que la IA sugiere revisar.
        *   **Sugerencias Detalladas**: Una lista de sugerencias específicas, cada una con un área, la descripción de la sugerencia, y a veces una prioridad y el contenido completo del archivo sugerido.
        *   **Evaluación General**.
    *   **Aplicar Sugerencias (Simulado)**: Para cada sugerencia que incluya un cambio de código completo, puedes hacer clic en **"Aplicar Sugerencia (Sim.)"**. Esto mostrará el contenido original y el contenido que la IA propone. Al confirmar, la acción de aplicar el cambio se registra en la consola del navegador y del servidor (la modificación real del archivo en el sistema está desactivada por seguridad en esta versión, pero la lógica simula cómo se aplicaría y actualiza el estado interno para futuras descargas). Esto representa la capacidad de "auto-reparación" guiada.
    *   **Descargar Código Fuente Completo**: Haz clic en este botón para descargar un archivo ZIP que contiene todo el código fuente actual de la aplicación YskCodeAlchemist (incluyendo cambios simulados si se aplicaron).
    *   **Manejo de Errores**: Si ocurre un error durante el análisis (ej. "Payload Too Large" de la API de Groq), se mostrará un mensaje. Podrás copiar el detalle del error para facilitar la depuración.

6.  **Versiones Guardadas**:
    *   Visita la sección **Versiones Guardadas**.
    *   Verás una lista de todas las versiones de código que has guardado.
    *   **Ver**: Haz clic en el icono del ojo (👁️) para ver el contenido de una versión.
    *   **Descargar**: Haz clic en el icono de descarga (📥) para bajar el código de esa versión.
    *   **Eliminar**: Haz clic en el icono de la papelera (🗑️) para eliminar una versión. También hay un botón para "Eliminar Todas".
    *   **Comparar**:
        *   Selecciona una versión como "A" y otra como "B" usando los respectivos botones.
        *   Una vez que A y B estén seleccionados, se abrirá un diálogo mostrando las diferencias entre los dos códigos, resaltando líneas añadidas y eliminadas.

7.  **Panel de Control (Dashboard)**:
    *   Es la página de inicio después de la configuración.
    *   Proporciona una bienvenida y accesos directos a las principales secciones de la aplicación.

## Notas Importantes

*   **Sugerencias de IA**: Las sugerencias y el código generado por la IA son herramientas para asistir en el desarrollo. Siempre revisa y comprende los cambios propuestos antes de integrarlos en tu trabajo.
*   **Límites de API y Timeouts**: Las llamadas a la API de Groq (especialmente en AutoUpdate) dividen el código en fragmentos para no exceder los límites de tokens por solicitud (ej. 6000 tokens) y tienen un tiempo de espera (timeout, ej. 1 minuto por fragmento) para prevenir bloqueos. Si un fragmento es demasiado grande, puede resultar en un error "Payload Too Large".
*   **Aplicación de Cambios en AutoUpdate (Simulación)**: La función "Aplicar Sugerencia" en la sección AutoUpdate está diseñada para mostrar cómo la IA modificaría los archivos. Por razones de seguridad, la escritura directa de archivos en el sistema de la aplicación está actualmente desactivada; en su lugar, los cambios se registran en la consola y actualizan el estado interno de los archivos para la descarga.
*   **Costes de API**: El uso de la API de Groq puede incurrir en costes dependiendo de tu plan y el volumen de uso. Monitoriza tu consumo en el panel de control de GroqCloud.
*   **Privacidad**: El código que envías para análisis a través de la API de Groq se procesa en sus servidores. Revisa la política de privacidad de Groq si tienes preocupaciones sobre la confidencialidad de tu código.
*   **"Auto-Reparación"**: La capacidad de la aplicación para "arreglar sus propios errores" se refiere a la funcionalidad de AutoUpdate donde la IA analiza el código de YskCodeAlchemist y propone cambios. Estos cambios pueden ser "aplicados" de forma simulada por el usuario, actualizando el estado del código fuente que luego puede ser descargado. No es una auto-reparación autónoma en tiempo real.

## Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue para discutir cambios importantes o envía un Pull Request.

## Licencia

(Opcional: Especifica una licencia, por ejemplo, MIT License)

---

¡Gracias por usar YskCodeAlchemist! Esperamos que te ayude a mejorar tu código y tu flujo de trabajo de desarrollo.
