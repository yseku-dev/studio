import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ScanLine, GitCompareArrows, Settings as SettingsIcon } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary">Bienvenido a CodeAlchemist</CardTitle>
          <CardDescription className="text-lg">
            Tu asistente potenciado por IA para análisis de código, refactorización y gestión de versiones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-6">
            Navega por las secciones usando la barra lateral para analizar tu código, gestionar versiones guardadas o configurar tus ajustes.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/analyze" passHref>
              <Button variant="outline" className="w-full h-24 text-lg flex flex-col items-center justify-center gap-2 hover:bg-accent/10">
                <ScanLine className="h-8 w-8 text-accent" />
                Analizar Código
              </Button>
            </Link>
            <Link href="/versions" passHref>
              <Button variant="outline" className="w-full h-24 text-lg flex flex-col items-center justify-center gap-2 hover:bg-accent/10">
                <GitCompareArrows className="h-8 w-8 text-accent" />
                Ver Versiones
              </Button>
            </Link>
            <Link href="/settings" passHref>
              <Button variant="outline" className="w-full h-24 text-lg flex flex-col items-center justify-center gap-2 hover:bg-accent/10">
                <SettingsIcon className="h-8 w-8 text-accent" />
                Configurar Ajustes
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inicio Rápido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p><strong>1. Configurar Ajustes:</strong> Ve a la página de <Link href="/settings" className="text-accent hover:underline">Configuración</Link> para añadir tu clave API de Groq y seleccionar un modelo.</p>
          <p><strong>2. Analizar Código:</strong> Navega a la página de <Link href="/analyze" className="text-accent hover:underline">Analizar Código</Link>, pega tu código y obtén sugerencias potenciadas por IA.</p>
          <p><strong>3. Gestionar Versiones:</strong> Usa la página de <Link href="/versions" className="text-accent hover:underline">Versiones Guardadas</Link> para guardar y comparar diferentes versiones de tu código.</p>
        </CardContent>
      </Card>
    </div>
  );
}
