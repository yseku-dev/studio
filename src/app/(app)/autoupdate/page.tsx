
'use client';

import type { AppSourceFile } from './actions';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ShieldCheck, AlertTriangle, DownloadCloud, FileCode } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { handleAutoAnalyzeAppSource, getApplicationSourceBundle } from './actions';
import type { AnalyzeCodeAlchemistSourceOutput } from '@/ai/flows/analyze-codealchemist-source-flow';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';


type AutoUpdateStatus = "idle" | "loading" | "success" | "error";

// Un fragmento de código representativo de CodeAlchemist para el auto-análisis.
// En un escenario real, esto podría obtenerse de forma más dinámica o ser una selección de archivos.
const CONCEPTUAL_CODEALCHEMIST_SOURCE_SNIPPET = `
// Archivo: src/components/layout/app-sidebar.tsx (Conceptual)
import Link from 'next/link';
import { PackageSearch } from 'lucide-react';

function AppSidebar() {
  return (
    <div className="p-4 border-r h-screen">
      <Link href="/dashboard">
        <PackageSearch className="h-8 w-8 text-primary" />
        <h1 className="text-xl font-semibold">CodeAlchemist</h1>
      </Link>
      <nav className="mt-8 space-y-2">
        {/* Navigation items here */}
      </nav>
    </div>
  );
}

// Archivo: src/app/page.tsx (Conceptual)
export default function HomePage() {
  // Redirect to dashboard or show landing page
  return <h1>Welcome to CodeAlchemist</h1>;
}
`;


export default function AutoUpdatePage() {
  const [status, setStatus] = useState<AutoUpdateStatus>("idle");
  const [analysisResult, setAnalysisResult] = useState<AnalyzeCodeAlchemistSourceOutput | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string | null>(null);

  useEffect(() => {
    setApiKey(localStorage.getItem('codealchemist_groq_api_key'));
    setModelName(localStorage.getItem('codealchemist_groq_model_name'));
  }, []);

  const handleStartAutoAnalysis = async () => {
    if (!apiKey || !modelName) {
      toast({
        title: 'Configuración Faltante',
        description: 'Por favor, establece tu Clave API de Groq y Nombre de Modelo en Configuración.',
        variant: 'destructive',
      });
      return;
    }

    setStatus("loading");
    setAnalysisResult(null);
    toast({
      title: "Auto-Análisis Iniciado",
      description: "Analizando el código fuente conceptual de CodeAlchemist..."
    });

    const result = await handleAutoAnalyzeAppSource(CONCEPTUAL_CODEALCHEMIST_SOURCE_SNIPPET, apiKey, modelName);

    if (result.success && result.data) {
      setAnalysisResult(result.data);
      setStatus("success");
      toast({
        title: "Auto-Análisis Completado",
        description: "Se han generado sugerencias para CodeAlchemist."
      });
    } else {
      setStatus("error");
      toast({
        title: "Error en Auto-Análisis",
        description: result.error || "Ocurrió un error desconocido.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadSource = async () => {
    setIsDownloading(true);
    toast({
      title: "Preparando Descarga",
      description: "Recopilando archivos fuente conceptuales de CodeAlchemist..."
    });

    const result = await getApplicationSourceBundle();

    if (result.success && result.data) {
      try {
        const bundleJsonString = JSON.stringify(result.data, null, 2);
        const blob = new Blob([bundleJsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'codealchemist-source-bundle.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({
          title: "Descarga Iniciada",
          description: "El paquete de código fuente conceptual (codealchemist-source-bundle.json) se está descargando."
        });
      } catch (e) {
         toast({
          title: "Error al Crear Descarga",
          description: "No se pudo crear el archivo de descarga en el navegador.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Error al Obtener Código Fuente",
        description: result.error || "No se pudo obtener el paquete de código fuente.",
        variant: "destructive",
      });
    }
    setIsDownloading(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center gap-2">
            <Sparkles className="h-8 w-8" />
            AutoUpdate: Análisis de CodeAlchemist
          </CardTitle>
          <CardDescription className="text-lg">
            Esta sección permite a la IA analizar el propio código fuente (conceptual) de la aplicación CodeAlchemist para proponer mejoras y optimizaciones.
             {!apiKey || !modelName ? (
                <span className="text-destructive block mt-1"> (Clave API o Modelo no configurado en Ajustes)</span>
            ) : <span className="text-muted-foreground block mt-1">(Usando modelo Groq: {modelName})</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Al hacer clic en &quot;Iniciar Auto-Análisis&quot;, CodeAlchemist enviará un fragmento conceptual de su propio código fuente
            al modelo de IA configurado para obtener un resumen de posibles mejoras. También puedes descargar un paquete conceptual de los archivos fuente.
          </p>
          
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={handleStartAutoAnalysis} 
              disabled={status === "loading" || !apiKey || !modelName}
              className="text-base py-3 px-6"
            >
              {status === "loading" ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-5 w-5" />
              )}
              Iniciar Auto-Análisis
            </Button>
            <Button 
              onClick={handleDownloadSource} 
              disabled={isDownloading}
              variant="outline"
              className="text-base py-3 px-6"
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <DownloadCloud className="mr-2 h-5 w-5" />
              )}
              Descargar Código Fuente (Conceptual)
            </Button>
          </div>

          {status !== "idle" && analysisResult && (
            <Card className="mt-6 border-accent bg-accent/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center gap-2 text-accent-foreground">
                  <FileCode className="h-6 w-6" />
                  {analysisResult.analysisTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-accent-foreground/90 mb-1">Evaluación General:</h4>
                  <p className="text-sm text-accent-foreground/80">{analysisResult.overallAssessment}</p>
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold text-accent-foreground/90 mb-2">Áreas Identificadas:</h4>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.identifiedAreas.map((area, index) => (
                      <Badge key={index} variant="secondary">{area}</Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold text-accent-foreground/90 mb-2">Sugerencias Detalladas:</h4>
                  <ScrollArea className="h-[300px] pr-3">
                    <ul className="space-y-3">
                      {analysisResult.suggestions.map((s, index) => (
                        <li key={index} className="p-3 rounded-md border bg-background/70 shadow-sm">
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-sm">{s.area}</span>
                            {s.priority && (
                              <Badge variant={s.priority === 'high' ? 'destructive' : s.priority === 'medium' ? 'default' : 'outline'} className="capitalize text-xs">
                                {s.priority}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{s.suggestion}</p>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          )}
           {status === "loading" && (
            <div 
              data-ai-hint="code processing animation"
              className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-8 min-h-[200px] mt-6"
            >
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg text-muted-foreground">Analizando el código conceptual de CodeAlchemist...</p>
              <p className="text-sm text-muted-foreground">Esto podría tomar unos momentos.</p>
            </div>
          )}
          {status === "error" && !analysisResult && ( // Show generic error if analysisResult is null
             <Card className="mt-6 border-red-500 bg-red-500/5">
               <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-6 w-6" />
                  Error en el Auto-Análisis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-red-700 dark:text-red-400">Ocurrió un error durante el auto-análisis. Revisa la consola para más detalles o inténtalo de nuevo.</p>
              </CardContent>
            </Card>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            <strong>Nota Importante:</strong> El análisis se realiza sobre un fragmento de código conceptual representativo de CodeAlchemist.
            La descarga de código fuente proporciona un paquete conceptual de archivos clave no sensibles con fines demostrativos.
            Las sugerencias de IA siempre deben ser revisadas cuidadosamente por un desarrollador.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
