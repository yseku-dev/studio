'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FolderSearch, UploadCloud, GitFork, Loader2, Settings2 } from "lucide-react"; // Added Settings2
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Import Select components
import type { AgentConfig } from '@/types/agent';
import { resolveLlmOptionsForSource } from '@/lib/llm-utils'; // Import the helper
import type { LLMOptions } from '@/services/groq'; // Import LLMOptions type
import { LOCALSTORAGE_AGENTS_KEY } from '@/config/agent-config'; // Import agents key


type AnalysisStatus = "idle" | "loading" | "success" | "error";

export default function ProjectAnalysisPage() {
  const [activeTab, setActiveTab] = useState<"upload" | "git">("upload");
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [gitUrl, setGitUrl] = useState<string>("");
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const { toast } = useToast();

  // Agent and config source state
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [selectedConfigSource, setSelectedConfigSource] = useState<string>('global'); // Default to global
  const [resolvedLlmOptions, setResolvedLlmOptions] = useState<LLMOptions | null>(null); // State for resolved options


   // Load agents from localStorage
  useEffect(() => {
    const storedAgents = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
    if (storedAgents) {
      try {
        setAgents(JSON.parse(storedAgents));
      } catch (e) {
        console.error("Error parsing stored agents:", e);
        setAgents([]);
      }
    }
  }, []);

  // Update resolved LLM options when config source or agents change
  useEffect(() => {
    const options = resolveLlmOptionsForSource(selectedConfigSource, agents);
    setResolvedLlmOptions(options);
  }, [selectedConfigSource, agents]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === 'application/zip' || file.type === 'application/json' || file.name.endsWith('.zip') || file.name.endsWith('.json')) {
        setProjectFile(file);
      } else {
        toast({
          title: "Tipo de Archivo Inválido",
          description: "Por favor, selecciona un archivo .zip o .json.",
          variant: "destructive",
        });
        setProjectFile(null);
        event.target.value = ''; // Clear the input
      }
    } else {
      setProjectFile(null);
    }
  };

   const getSourceName = (sourceId: string): string => {
    if (sourceId === 'global') return 'Global';
    return agents.find(a => a.id === sourceId)?.name || 'Desconocido';
  }

  const handleAnalyzeProject = async () => {
     // Validate LLM Configuration first
     if (!resolvedLlmOptions) {
        toast({
            title: "Configuración LLM Incompleta",
            description: `La configuración LLM seleccionada (${getSourceName(selectedConfigSource)}) está incompleta o no se pudo resolver. Revisa los Ajustes o la configuración del Agente.`,
            variant: "destructive",
            duration: 7000,
        });
        return;
     }

    if (activeTab === "upload" && !projectFile) {
      toast({
        title: "Archivo Faltante",
        description: "Por favor, selecciona un archivo ZIP o JSON para analizar.",
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

    // TODO: Replace simulation with actual API call using resolvedLlmOptions
    console.log("Simulating analysis with options:", resolvedLlmOptions);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // This would involve sending the file/URL AND resolvedLlmOptions to a server action
    if (activeTab === "upload" && projectFile) {
      console.log("Analizando archivo:", projectFile.name);
      setAnalysisResult(`Análisis simulado para ${projectFile.name} (usando ${resolvedLlmOptions.modelName}) completado. \n- Se encontraron 5 problemas de estilo. \n- Se sugieren 2 refactorizaciones para mejorar la eficiencia.`);
    } else if (activeTab === "git") {
      console.log("Analizando repositorio Git:", gitUrl);
      setAnalysisResult(`Análisis simulado para ${gitUrl} (usando ${resolvedLlmOptions.modelName}) completado. \n- Cubertura de pruebas del 75%. \n- 3 dependencias desactualizadas.`);
    }

    setAnalysisStatus("success");
    toast({
      title: "Análisis de Proyecto Iniciado (Simulado)",
      description: `El análisis para ${activeTab === "upload" ? projectFile?.name : gitUrl} ha comenzado usando la configuración de '${getSourceName(selectedConfigSource)}'. Los resultados se mostrarán abajo.`,
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
          <CardDescription>
            Sube un archivo ZIP o JSON de tu proyecto o proporciona la URL de un repositorio Git para un análisis exhaustivo usando la configuración LLM seleccionada.
            {!resolvedLlmOptions && selectedConfigSource ? (
                 <span className="text-destructive block mt-1"> (Configuración LLM para '{getSourceName(selectedConfigSource)}' incompleta o inválida)</span>
             ) : resolvedLlmOptions ? (
                <span className="text-foreground block mt-1">(Usando: {getSourceName(selectedConfigSource)} - {resolvedLlmOptions.providerId} - {resolvedLlmOptions.modelName})</span>
             ) : (
                 <span className="text-muted-foreground block mt-1">(Selecciona una fuente de configuración)</span>
             )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            {/* LLM Configuration Source Selector */}
            <div className="space-y-2">
                <Label htmlFor="configSource" className="text-base flex items-center gap-1">
                   <Settings2 className="h-4 w-4"/> Usar Configuración LLM De:
                </Label>
                <Select onValueChange={setSelectedConfigSource} value={selectedConfigSource}>
                    <SelectTrigger id="configSource" className="w-full md:w-1/2">
                        <SelectValue placeholder="Seleccionar fuente de configuración" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="global">Ajustes Globales</SelectItem>
                        {agents.map(agent => (
                            <SelectItem key={agent.id} value={agent.id}>
                                Agente: {agent.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {!resolvedLlmOptions && selectedConfigSource && (
                     <p className="text-xs text-destructive mt-1">La configuración para '{getSourceName(selectedConfigSource)}' parece incompleta. Revisa los <a href="/settings" className="underline">Ajustes Globales</a> o la configuración del agente en <a href="/agents" className="underline">Gestión de Agentes</a>.</p>
                )}
            </div>


          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "upload" | "git")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload" className="gap-2">
                <UploadCloud className="h-5 w-5" /> Subir Archivo (ZIP/JSON)
              </TabsTrigger>
              <TabsTrigger value="git" className="gap-2">
                <GitFork className="h-5 w-5" /> Desde Repositorio Git
              </TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="mt-6">
              <div className="space-y-2">
                <Label htmlFor="project-file" className="text-base">Archivo del Proyecto (.zip o .json)</Label>
                <Input id="project-file" type="file" accept=".zip,.json,application/zip,application/json" onChange={handleFileChange} className="text-base file:text-base" />
                {projectFile && <p className="text-sm text-muted-foreground">Archivo seleccionado: {projectFile.name}</p>}
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
          <Button onClick={handleAnalyzeProject} disabled={analysisStatus === "loading" || !resolvedLlmOptions} className="w-full md:w-auto text-base py-3 px-6">
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
                <div
                  data-ai-hint="project analysis loading"
                  className="flex items-center justify-center p-8 bg-muted/50 rounded-lg min-h-[150px]"
                >
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="ml-4 text-lg text-foreground">Analizando proyecto, por favor espera...</p>
                </div>
              )}
              {analysisStatus === "success" && analysisResult && (
                <Card className="bg-card">
                  <CardContent className="p-6">
                    <pre className="whitespace-pre-wrap text-sm font-mono text-foreground">{analysisResult}</pre>
                  </CardContent>
                </Card>
              )}
              {analysisStatus === "error" && (
                 <Card className="bg-destructive/10 border-destructive">
                  <CardContent className="p-6">
                    <p className="text-destructive">Ocurrió un error durante el análisis. Por favor, inténtalo de nuevo.</p>
                    {/* TODO: Display specific error message here */}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">
                El análisis de proyectos grandes puede tomar varios minutos. Los resultados son generados por IA y deben ser revisados. Esta funcionalidad aún está en desarrollo y actualmente utiliza resultados simulados.
            </p>
         </CardFooter>
      </Card>
    </div>
  );
}
