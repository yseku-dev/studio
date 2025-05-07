
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FolderSearch, UploadCloud, GitFork, Loader2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';

type AnalysisStatus = "idle" | "loading" | "success" | "error";

export default function ProjectAnalysisPage() {
  const [activeTab, setActiveTab] = useState<"zip" | "git">("zip");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [gitUrl, setGitUrl] = useState<string>("");
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setZipFile(event.target.files[0]);
    } else {
      setZipFile(null);
    }
  };

  const handleAnalyzeProject = async () => {
    if (activeTab === "zip" && !zipFile) {
      toast({
        title: "Archivo Faltante",
        description: "Por favor, selecciona un archivo ZIP para analizar.",
        variant: "destructive",
      });
      return;
    }
    if (activeTab === "git" && !gitUrl) {
      toast({
        title: "URL Faltante",
        description: "Por favor, ingresa la URL del repositorio Git.",
        variant: "destructive",
      });
      return;
    }

    setAnalysisStatus("loading");
    setAnalysisResult(null);

    // Simulación de llamada a API
    await new Promise(resolve => setTimeout(resolve, 2000));

    // TODO: Implementar la lógica real de análisis del proyecto
    // Esto implicaría enviar el archivo o la URL a un backend/flujo de IA
    if (activeTab === "zip" && zipFile) {
      console.log("Analizando archivo ZIP:", zipFile.name);
      setAnalysisResult(`Análisis simulado para ${zipFile.name} completado. \n- Se encontraron 5 problemas de estilo. \n- Se sugieren 2 refactorizaciones para mejorar la eficiencia.`);
    } else if (activeTab === "git") {
      console.log("Analizando repositorio Git:", gitUrl);
      setAnalysisResult(`Análisis simulado para ${gitUrl} completado. \n- Cubertura de pruebas del 75%. \n- 3 dependencias desactualizadas.`);
    }
    
    setAnalysisStatus("success");
    toast({
      title: "Análisis de Proyecto Iniciado",
      description: `El análisis para ${activeTab === "zip" ? zipFile?.name : gitUrl} ha comenzado. Los resultados se mostrarán abajo. (Simulado)`,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center gap-2">
            <FolderSearch className="h-8 w-8" />
            Analizar Proyecto Completo
          </CardTitle>
          <CardDescription className="text-lg">
            Sube un archivo ZIP de tu proyecto o proporciona la URL de un repositorio Git para un análisis exhaustivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "zip" | "git")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="zip" className="gap-2">
                <UploadCloud className="h-5 w-5" /> Subir Archivo ZIP
              </TabsTrigger>
              <TabsTrigger value="git" className="gap-2">
                <GitFork className="h-5 w-5" /> Desde Repositorio Git
              </TabsTrigger>
            </TabsList>
            <TabsContent value="zip" className="mt-6">
              <div className="space-y-2">
                <Label htmlFor="zip-file" className="text-base">Archivo del Proyecto (.zip)</Label>
                <Input id="zip-file" type="file" accept=".zip" onChange={handleFileChange} className="text-base file:text-base" />
                {zipFile && <p className="text-sm text-muted-foreground">Archivo seleccionado: {zipFile.name}</p>}
              </div>
            </TabsContent>
            <TabsContent value="git" className="mt-6">
              <div className="space-y-2">
                <Label htmlFor="git-url" className="text-base">URL del Repositorio Git</Label>
                <Input 
                  id="git-url" 
                  type="url" 
                  placeholder="https://github.com/usuario/repositorio.git" 
                  value={gitUrl} 
                  onChange={(e) => setGitUrl(e.target.value)}
                  className="text-base"
                />
              </div>
            </TabsContent>
          </Tabs>
          <Button onClick={handleAnalyzeProject} disabled={analysisStatus === "loading"} className="w-full md:w-auto text-base py-3 px-6">
            {analysisStatus === "loading" ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <FolderSearch className="mr-2 h-5 w-5" />
            )}
            Analizar Proyecto
          </Button>

          {analysisStatus !== "idle" && (
            <div className="mt-6 space-y-4">
              <h3 className="text-xl font-semibold">Resultados del Análisis</h3>
              {analysisStatus === "loading" && (
                <div className="flex items-center justify-center p-8 bg-muted/50 rounded-lg min-h-[150px]">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="ml-4 text-lg text-muted-foreground">Analizando proyecto, por favor espera...</p>
                </div>
              )}
              {analysisStatus === "success" && analysisResult && (
                <Card className="bg-card">
                  <CardContent className="p-6">
                    <pre className="whitespace-pre-wrap text-sm font-mono">{analysisResult}</pre>
                  </CardContent>
                </Card>
              )}
              {analysisStatus === "error" && (
                 <Card className="bg-destructive/10 border-destructive">
                  <CardContent className="p-6">
                    <p className="text-destructive-foreground">Ocurrió un error durante el análisis. Por favor, inténtalo de nuevo.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">
                El análisis de proyectos grandes puede tomar varios minutos. Los resultados son generados por IA y deben ser revisados.
            </p>
         </CardFooter>
      </Card>
    </div>
  );
}
