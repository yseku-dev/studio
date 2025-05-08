
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ScanLine, GitCompareArrows, Settings as SettingsIcon, FolderSearch, Sparkles, Lightbulb,Rocket, BarChart3, CodeXml, FolderPlus } from "lucide-react";

const featureCards = [
  {
    href: "/generate-code",
    icon: CodeXml,
    title: "Generar Código",
    description: "Genera fragmentos de código a partir de descripciones en lenguaje natural."
  },
  {
    href: "/generate-project",
    icon: FolderPlus,
    title: "Generar Proyecto",
    description: "Crea una estructura base para un nuevo proyecto según tus especificaciones."
  },
  {
    href: "/analyze",
    icon: ScanLine,
    title: "Analizar Código",
    description: "Pega fragmentos o sube archivos para obtener análisis y sugerencias de mejora."
  },
  {
    href: "/project-analysis",
    icon: FolderSearch,
    title: "Analizar Proyecto",
    description: "Sube un ZIP o un repositorio Git para un análisis holístico de tu proyecto."
  },
  {
    href: "/autoupdate",
    icon: Sparkles,
    title: "AutoUpdate",
    description: "Permite que YskCodeAlchemist analice y sugiera mejoras para su propio código fuente."
  },
  {
    href: "/versions",
    icon: GitCompareArrows,
    title: "Versiones Guardadas",
    description: "Guarda, revisa, compara y gestiona diferentes snapshots de tu código."
  },
  {
    href: "/settings",
    icon: SettingsIcon,
    title: "Configuración",
    description: "Ajusta tu clave API de Groq, selecciona modelos y personaliza la aplicación."
  },
];


export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Rocket className="h-10 w-10 text-primary" />
            <div>
              <CardTitle className="text-3xl font-bold text-primary">Bienvenido a YskCodeAlchemist</CardTitle>
              <CardDescription className="text-lg text-muted-foreground mt-1">
                Tu asistente potenciado por IA para generación de código, análisis de código, refactorización y gestión de versiones.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-base text-foreground/80">
            Explora las funcionalidades de YskCodeAlchemist para optimizar tu flujo de trabajo de desarrollo.
            Desde la generación de código nuevo, análisis detallados de fragmentos hasta la auto-mejora de la propia aplicación,
            YskCodeAlchemist está diseñado para potenciar tu código.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
             <BarChart3 className="h-7 w-7 text-accent"/>
             Características Principales
          </CardTitle>
           <CardDescription className="text-foreground">Accede rápidamente a las herramientas clave de YskCodeAlchemist.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featureCards.map((feature) => (
              <Link href={feature.href} passHref key={feature.href}>
                <Card className="hover:shadow-xl hover:border-accent transition-all duration-300 ease-in-out cursor-pointer h-full flex flex-col bg-card hover:bg-accent/5">
                  <CardHeader className="items-center text-center pt-6 pb-3">
                    <feature.icon className="h-12 w-12 text-accent mb-3" />
                    <CardTitle className="text-xl text-foreground">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center text-sm text-muted-foreground flex-grow pb-6">
                    <p>{feature.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-accent/5 border-accent/30">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2 text-accent">
            <Lightbulb className="h-7 w-7"/>
            Guía Rápida de Inicio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-foreground">
          <p><strong>1. Configura tus Ajustes:</strong> Ve a la sección de <Link href="/settings" className="font-semibold text-primary hover:underline">Configuración</Link> para ingresar tu clave API de Groq y seleccionar el modelo de IA que prefieras. ¡No olvides probar la conexión!</p>
          <p><strong>2. Genera Código o Proyectos:</strong> Usa <Link href="/generate-code" className="font-semibold text-primary hover:underline">Generar Código</Link> para fragmentos o <Link href="/generate-project" className="font-semibold text-primary hover:underline">Generar Proyecto</Link> para estructuras completas.</p>
          <p><strong>3. Analiza tu Código:</strong> Dirígete a <Link href="/analyze" className="font-semibold text-primary hover:underline">Analizar Código</Link>. Pega tu código o sube un archivo para recibir análisis detallados y sugerencias de refactorización.</p>
          <p><strong>4. Explora el AutoUpdate:</strong> En la sección de <Link href="/autoupdate" className="font-semibold text-primary hover:underline">AutoUpdate</Link>, permite que YskCodeAlchemist analice su propio código fuente. Puedes guiar el análisis con tus preferencias.</p>
          <p><strong>5. Gestiona tus Versiones:</strong> Utiliza <Link href="/versions" className="font-semibold text-primary hover:underline">Versiones Guardadas</Link> para almacenar, comparar y revertir diferentes estados de tu código a lo largo del tiempo.</p>
        </CardContent>
      </Card>
    </div>
  );
}



