
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { FolderSearch } from "lucide-react";

export default function ProjectAnalysisPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center gap-2">
            <FolderSearch className="h-8 w-8" />
            Analizar Proyecto
          </CardTitle>
          <CardDescription className="text-lg">
            Esta sección permitirá analizar proyectos completos subidos en formato ZIP o desde repositorios Git.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-6">
            Funcionalidad en desarrollo. Aquí podrás subir tus proyectos para un análisis exhaustivo.
          </p>
           <div
            data-ai-hint="construction development"
            className="flex justify-center items-center bg-muted/50 rounded-lg p-8 min-h-[300px]"
            >
            <p className="text-xl text-muted-foreground">Página en Construcción</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
