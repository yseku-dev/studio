
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default function AutoUpdatePage() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center gap-2">
            <Sparkles className="h-8 w-8" />
            AutoUpdate
          </CardTitle>
          <CardDescription className="text-lg">
            Esta sección permitirá analizar y sugerir mejoras para el propio código de la aplicación CodeAlchemist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-6">
            Funcionalidad en desarrollo. Aquí, la IA analizará el código fuente de esta aplicación para proponer optimizaciones y actualizaciones.
          </p>
          <div
            data-ai-hint="code screen"
            className="flex justify-center items-center bg-muted/50 rounded-lg p-8 min-h-[300px]"
            >
            <p className="text-xl text-muted-foreground">Página en Construcción</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
