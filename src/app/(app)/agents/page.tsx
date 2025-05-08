// src/app/(app)/agents/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form'; // Import Controller
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Users2, Edit2, Trash2, Wand2, UploadCloud, DownloadCloud, MessageSquare } from 'lucide-react';
import type { AgentConfig, AgentLLMConfig, AgentSpecificLLMConfig } from '@/types/agent';
import { LLM_PROVIDERS, MODELS_BY_PROVIDER, DEFAULT_LLM_PROVIDER, type LLMProviderId, getLocalStorageApiKeyName as getGlobalApiKeyName, getLocalStorageModelName as getGlobalModelName, LOCALSTORAGE_PROVIDER_ID_KEY as GLOBAL_PROVIDER_ID_KEY } from '@/config/llm-config';
import { AgentTestChatModal } from '@/components/agent-test-chat-modal'; // Import the new component
import type { LLMOptions } from '@/services/groq'; // Import LLMOptions type

const agentSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres.'),
  systemMessage: z.string().min(20, 'El mensaje de sistema debe tener al menos 20 caracteres.'),
  llmConfigType: z.enum(['default', 'custom']),
  customProviderId: z.custom<LLMProviderId>().optional(),
  customModelName: z.string().optional(),
  customApiKey: z.string().optional(),
  customApiUrl: z.string().url().optional().or(z.literal('')),
}).refine(data => {
  if (data.llmConfigType === 'custom') {
    return !!data.customProviderId && !!data.customModelName;
  }
  return true;
}, {
  message: "Para configuración LLM personalizada, el proveedor y el modelo son obligatorios.",
  path: ["customModelName"],
});

type AgentFormData = z.infer<typeof agentSchema>;

const LOCALSTORAGE_AGENTS_KEY = 'codealchemist_agents';

const defaultAgents: Omit<AgentConfig, 'id'>[] = [
  { name: "JefeDeProducto", description: "Define requisitos, historias de usuario y prioridades.", systemMessage: "Eres un Jefe de Producto experimentado. Tu tarea es definir claramente los requisitos del proyecto, crear historias de usuario detalladas y establecer prioridades. Comunícate de forma efectiva con el equipo.", llmConfig: 'default' },
  { name: "ArquitectoSoftware", description: "Diseña la arquitectura del sistema y selecciona tecnologías.", systemMessage: "Eres un Arquitecto de Software senior. Tu responsabilidad es diseñar una arquitectura robusta, escalable y mantenible. Selecciona las tecnologías y patrones de diseño más adecuados.", llmConfig: 'default' },
  { name: "DesarrolladorSoftware", description: "Escribe el código fuente de la aplicación.", systemMessage: "Eres un Desarrollador de Software competente. Tu misión es escribir código limpio, eficiente y bien documentado. Implementa las funcionalidades requeridas.", llmConfig: 'default' },
  { name: "IngenieroPruebas", description: "Escribe y ejecuta pruebas para asegurar la calidad.", systemMessage: "Eres un Ingeniero de Pruebas meticuloso. Tu objetivo es asegurar la calidad del software mediante la creación y ejecución de planes de prueba exhaustivos. Reporta los errores de forma clara.", llmConfig: 'default' },
  { name: "IngenieroDevOps", description: "Gestiona infraestructura, despliegues y CI/CD.", systemMessage: "Eres un Ingeniero DevOps eficiente. Tu función es automatizar los procesos de CI/CD y gestionar la infraestructura, asegurando su disponibilidad y rendimiento.", llmConfig: 'default' },
  { name: "RepresentanteUsuario", description: "Proporciona feedback desde la perspectiva del usuario final.", systemMessage: "Eres el Representante del Usuario. Tu perspectiva es crucial. Proporciona feedback sobre las funcionalidades desarrolladas y valida que el producto cumple con las expectativas.", llmConfig: 'default' },
  {
    name: "SimuladorInteraccionUsuario",
    description: "Simula la interacción del usuario, proporciona feedback y aclara requisitos durante el desarrollo.",
    systemMessage: "Actúas como un proxy o simulador del usuario final. Tu rol es interactuar con el equipo de desarrollo (los otros agentes) como si fueras un usuario probando la aplicación o definiendo sus necesidades. Proporciona feedback sobre las propuestas de los otros agentes, haz preguntas aclaratorias sobre los requisitos que ellos discutan, y valida que las soluciones se alinean con la tarea principal del grupo de trabajo. No generes código, enfócate en la perspectiva del usuario y en la usabilidad. Por ejemplo, si discuten una nueva función, pregunta '¿Cómo accedería un usuario a esto?' o '¿Sería esto intuitivo para alguien que no conoce el sistema?'.",
    llmConfig: 'default'
  },
  {
    name: "OrquestadorFlujoAgentes",
    description: "Gestiona y dirige la secuencia de interacciones entre los agentes del grupo para asegurar que la tarea se complete de manera eficiente y coherente.",
    systemMessage: "Eres un Orquestador de Flujo de Agentes experto. Tu rol es dirigir la conversación y las tareas entre los diferentes agentes de IA en el grupo. Asegúrate de que cada agente contribuya en el momento adecuado y que la información fluya correctamente para alcanzar el objetivo del grupo. Puedes pedir a un agente específico que actúe, resumir el progreso, o solicitar aclaraciones si la conversación se desvía. No realices la tarea principal tú mismo, sino facilita que los otros agentes la completen.",
    llmConfig: 'default'
  },
];


export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentConfig | null>(null);
  const [testingAgent, setTestingAgent] = useState<AgentConfig | null>(null); // State for the agent being tested
  const [isTestModalOpen, setIsTestModalOpen] = useState(false); // State for the test modal visibility
  const [resolvedLlmOptions, setResolvedLlmOptions] = useState<LLMOptions | null>(null); // State for resolved LLM options for testing

  const { toast } = useToast();
  const importFileRef = useRef<HTMLInputElement>(null);

  const { control, register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<AgentFormData>({ // Add control
    resolver: zodResolver(agentSchema),
    defaultValues: { llmConfigType: 'default' }
  });

  const watchedLlmConfigType = watch('llmConfigType');
  const watchedCustomProviderId = watch('customProviderId');

  const [availableCustomModels, setAvailableCustomModels] = useState<string[]>([]);

   useEffect(() => {
    const storedAgents = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
    if (storedAgents) {
      try {
        const parsedAgents = JSON.parse(storedAgents);
        if (Array.isArray(parsedAgents)) {
          setAgents(parsedAgents);
        } else {
          throw new Error("Stored agents is not an array");
        }
      } catch (e) {
        console.error("Error parsing stored agents:", e);
        localStorage.removeItem(LOCALSTORAGE_AGENTS_KEY); // Clear corrupted data
        initializeDefaultAgents();
      }
    } else {
      initializeDefaultAgents();
    }
  }, []);

  const initializeDefaultAgents = () => {
    const initialAgents = defaultAgents.map(agent => ({ ...agent, id: crypto.randomUUID() }));
    setAgents(initialAgents);
    localStorage.setItem(LOCALSTORAGE_AGENTS_KEY, JSON.stringify(initialAgents));
  };

  useEffect(() => {
    if (watchedLlmConfigType === 'custom' && watchedCustomProviderId) {
      const models = MODELS_BY_PROVIDER[watchedCustomProviderId] || {};
      const modelNames = Object.keys(models).sort((a,b) => (models[b].tpm || 0) - (models[a].tpm || 0) || a.localeCompare(b));
      setAvailableCustomModels(modelNames);
      if (modelNames.length > 0 && !watch('customModelName')) {
        // Only set default if no model is currently selected for custom config
        setValue('customModelName', modelNames[0], { shouldDirty: !!editingAgent }); // Mark dirty if editing
      }
    } else {
      setAvailableCustomModels([]);
    }
  }, [watchedLlmConfigType, watchedCustomProviderId, setValue, watch, editingAgent]);

  const handleOpenForm = (agent?: AgentConfig) => {
    if (agent) {
      setEditingAgent(agent);
      reset({
        name: agent.name,
        description: agent.description,
        systemMessage: agent.systemMessage,
        llmConfigType: agent.llmConfig === 'default' ? 'default' : 'custom',
        customProviderId: agent.llmConfig !== 'default' ? agent.llmConfig.providerId : undefined,
        customModelName: agent.llmConfig !== 'default' ? agent.llmConfig.modelName : undefined,
        customApiKey: agent.llmConfig !== 'default' ? agent.llmConfig.apiKey || '' : '',
        customApiUrl: agent.llmConfig !== 'default' ? agent.llmConfig.apiUrl || '' : '',
      });
    } else {
      setEditingAgent(null);
      reset({
        name: '',
        description: '',
        systemMessage: '',
        llmConfigType: 'default',
        customProviderId: undefined,
        customModelName: undefined,
        customApiKey: '',
        customApiUrl: '',
      });
    }
    setIsFormOpen(true);
  };

  const onSubmit: SubmitHandler<AgentFormData> = (data) => {
    let llmConfigToSave: AgentLLMConfig = 'default';
    if (data.llmConfigType === 'custom' && data.customProviderId && data.customModelName) {
      const provider = LLM_PROVIDERS.find(p => p.id === data.customProviderId);
      llmConfigToSave = {
        providerId: data.customProviderId,
        modelName: data.customModelName,
        apiKey: data.customApiKey || null, // Store empty string as null
        apiUrl: data.customApiUrl || provider?.apiUrl || null, // Store empty string as null or use provider default
      };
    }

    const newAgent: AgentConfig = {
      id: editingAgent?.id || crypto.randomUUID(),
      name: data.name,
      description: data.description,
      systemMessage: data.systemMessage,
      llmConfig: llmConfigToSave,
    };

    let updatedAgents;
    if (editingAgent) {
      updatedAgents = agents.map(a => a.id === editingAgent.id ? newAgent : a);
    } else {
      updatedAgents = [...agents, newAgent];
    }
    setAgents(updatedAgents);
    localStorage.setItem(LOCALSTORAGE_AGENTS_KEY, JSON.stringify(updatedAgents));
    toast({ title: `Agente ${editingAgent ? 'Actualizado' : 'Creado'}`, description: `El agente "${newAgent.name}" ha sido ${editingAgent ? 'actualizado' : 'creado'} exitosamente.` });
    setIsFormOpen(false);
  };

  const handleDeleteAgent = (agentId: string) => {
    const updatedAgents = agents.filter(a => a.id !== agentId);
    setAgents(updatedAgents);
    localStorage.setItem(LOCALSTORAGE_AGENTS_KEY, JSON.stringify(updatedAgents));
    // TODO: Also remove this agent from any workgroups
    toast({ title: 'Agente Eliminado', description: 'El agente ha sido eliminado.' });
  };

  const handleTestAgent = (agent: AgentConfig) => {
    let options: LLMOptions | null = null;
    let providerConfig = null;

    if (agent.llmConfig === 'default') {
      const globalProviderId = localStorage.getItem(GLOBAL_PROVIDER_ID_KEY) as LLMProviderId | null || DEFAULT_LLM_PROVIDER;
      providerConfig = LLM_PROVIDERS.find(p => p.id === globalProviderId);
      const globalModelName = localStorage.getItem(getGlobalModelName(globalProviderId));
      const globalApiKey = localStorage.getItem(getGlobalApiKeyName(globalProviderId));
      const globalApiUrl = localStorage.getItem(`codealchemist_apiurl_${globalProviderId}`);

      if (!providerConfig) {
         toast({ title: "Error de Configuración Global", description: `Proveedor LLM global '${globalProviderId}' no encontrado.`, variant: "destructive" });
         return;
      }
      if (!globalModelName) {
        toast({ title: "Error de Configuración Global", description: "Modelo LLM global no configurado en Ajustes.", variant: "destructive" });
        return;
      }
      if (providerConfig.requiresApiKey && !globalApiKey) {
        toast({ title: "Error de Configuración Global", description: `Clave API global para ${providerConfig.name} no configurada en Ajustes.`, variant: "destructive" });
        return;
      }
      options = {
        providerId: globalProviderId,
        modelName: globalModelName,
        apiKey: globalApiKey || "", // Pass empty string if null
        apiUrl: globalApiUrl || providerConfig.apiUrl,
      };
    } else {
      providerConfig = LLM_PROVIDERS.find(p => p.id === agent.llmConfig.providerId);
      if (!providerConfig) {
         toast({ title: "Error de Configuración de Agente", description: `Proveedor LLM '${agent.llmConfig.providerId}' no encontrado.`, variant: "destructive" });
         return;
      }
      const apiKeyToUse = agent.llmConfig.apiKey || localStorage.getItem(getGlobalApiKeyName(agent.llmConfig.providerId)); // Use agent's key or fallback to global for that provider
      if (providerConfig.requiresApiKey && !apiKeyToUse) {
         toast({ title: "Error de Configuración de Agente", description: `Se requiere clave API para ${providerConfig.name}, pero no está configurada ni en el agente ni globalmente.`, variant: "destructive" });
         return;
      }
      const apiUrlToUse = agent.llmConfig.apiUrl || localStorage.getItem(`codealchemist_apiurl_${agent.llmConfig.providerId}`) || providerConfig.apiUrl; // Use agent's URL, fallback to global for provider, fallback to provider default

       options = {
        providerId: agent.llmConfig.providerId,
        modelName: agent.llmConfig.modelName,
        apiKey: apiKeyToUse || "",
        apiUrl: apiUrlToUse,
      };
    }

    if (options) {
        setResolvedLlmOptions(options);
        setTestingAgent(agent);
        setIsTestModalOpen(true);
    }
  };

  const getLLMConfigDisplay = (llmConfig: AgentLLMConfig): string => {
    if (llmConfig === 'default') {
      const globalProviderId = localStorage.getItem(GLOBAL_PROVIDER_ID_KEY) as LLMProviderId | null || DEFAULT_LLM_PROVIDER;
      const globalModelName = localStorage.getItem(getGlobalModelName(globalProviderId)) || 'No configurado';
      const providerName = LLM_PROVIDERS.find(p => p.id === globalProviderId)?.name || globalProviderId;
      return `Global (${providerName} - ${globalModelName})`;
    }
    const providerName = LLM_PROVIDERS.find(p => p.id === llmConfig.providerId)?.name || llmConfig.providerId;
    return `Personalizado (${providerName} - ${llmConfig.modelName})`;
  };

  const handleDialogVisibilityChange = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setEditingAgent(null);
      reset({
        name: '',
        description: '',
        systemMessage: '',
        llmConfigType: 'default',
        customProviderId: undefined,
        customModelName: undefined,
        customApiKey: '',
        customApiUrl: '',
      });
    }
  };

  const handleExportAllAgents = () => {
    if (agents.length === 0) {
      toast({ title: "Nada que exportar", description: "No hay agentes para exportar.", variant: "default" });
      return;
    }
    const jsonData = JSON.stringify(agents, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codealchemist_all_agents.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Exportación Exitosa", description: "Todos los agentes han sido exportados." });
  };

  const handleExportAgent = (agentId: string) => {
    const agentToExport = agents.find(a => a.id === agentId);
    if (!agentToExport) {
      toast({ title: "Error de Exportación", description: "No se encontró el agente.", variant: "destructive" });
      return;
    }
    const jsonData = JSON.stringify(agentToExport, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codealchemist_agent_${agentToExport.name.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Exportación Exitosa", description: `Agente "${agentToExport.name}" exportado.` });
  };

  const handleImportAgents = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const importedData = JSON.parse(text);

        // Validate if it's an array (for multiple agents) or a single agent object
        let agentsToImport: AgentConfig[];
        if (Array.isArray(importedData)) {
          agentsToImport = importedData as AgentConfig[]; // Add more validation here if needed
        } else if (typeof importedData === 'object' && importedData !== null && 'id' in importedData && 'name' in importedData) {
          agentsToImport = [importedData as AgentConfig];
        } else {
          throw new Error("El archivo JSON no contiene un agente o una lista de agentes válidos.");
        }

        // Basic validation for each agent (can be enhanced with Zod)
        agentsToImport.forEach(agent => {
          if (!agent.id || !agent.name || !agent.systemMessage) {
            throw new Error(`Agente importado inválido: falta id, name o systemMessage. Agente: ${JSON.stringify(agent).substring(0,100)}`);
          }
          // Ensure new IDs if they conflict, or decide on an update strategy
          // For simplicity, we'll add new ones, or update if ID matches
        });

        let updatedAgents = [...agents];
        let newAgentsCount = 0;
        let updatedAgentsCount = 0;

        agentsToImport.forEach(importedAgent => {
          const existingIndex = updatedAgents.findIndex(a => a.id === importedAgent.id);
          if (existingIndex > -1) {
            updatedAgents[existingIndex] = importedAgent; // Update existing
            updatedAgentsCount++;
          } else {
            updatedAgents.push({...importedAgent, id: importedAgent.id || crypto.randomUUID()}); // Add new
            newAgentsCount++;
          }
        });

        setAgents(updatedAgents);
        localStorage.setItem(LOCALSTORAGE_AGENTS_KEY, JSON.stringify(updatedAgents));
        toast({ title: "Importación Exitosa", description: `${newAgentsCount} agente(s) nuevo(s) añadido(s), ${updatedAgentsCount} agente(s) actualizado(s).` });

      } catch (error) {
        console.error("Error importing agents:", error);
        toast({ title: "Error de Importación", description: `No se pudo importar el archivo. ${error instanceof Error ? error.message : "Formato inválido."}`, variant: "destructive" });
      } finally {
        // Reset file input
        if (importFileRef.current) {
          importFileRef.current.value = "";
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <Dialog open={isFormOpen} onOpenChange={handleDialogVisibilityChange}>
        <div className="space-y-6">
          <Card className="shadow-lg border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
              <div className="flex-grow">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Users2 className="h-6 w-6 text-primary" />
                  Gestión de Agentes IA
                </CardTitle>
                <CardDescription className="mt-1 text-muted-foreground">
                  Crea, administra, prueba, importa y exporta tus agentes de IA para grupos de trabajo.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => importFileRef.current?.click()}>
                  <UploadCloud className="mr-2 h-4 w-4" /> Importar
                </Button>
                <Input
                  type="file"
                  ref={importFileRef}
                  className="hidden"
                  accept=".json"
                  onChange={handleImportAgents}
                />
                <Button variant="outline" size="sm" onClick={handleExportAllAgents} disabled={agents.length === 0}>
                  <DownloadCloud className="mr-2 h-4 w-4" /> Exportar Todos
                </Button>
                <DialogTrigger asChild>
                  <Button onClick={() => handleOpenForm()} size="sm">
                    <PlusCircle className="mr-2 h-4 w-4" /> Crear Agente
                  </Button>
                </DialogTrigger>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {agents.length === 0 ? (
                <p className="text-muted-foreground text-center py-12">No hay agentes creados. ¡Empieza creando uno o importa agentes existentes!</p>
              ) : (
                <ScrollArea className="h-[calc(100vh-18rem)]"> {/* Adjusted height */}
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {agents.map(agent => (
                      <Card key={agent.id} className="flex flex-col bg-card hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg font-semibold text-primary">{agent.name}</CardTitle>
                          <CardDescription className="text-xs text-muted-foreground h-8 line-clamp-2">{agent.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow space-y-3 pt-2 pb-4">
                           <div className="text-xs text-foreground">
                             <strong>Mensaje de Sistema:</strong>
                             <ScrollArea className="h-16 mt-1 p-1.5 border rounded bg-muted/50 text-xs">
                               <pre className="whitespace-pre-wrap">{agent.systemMessage}</pre>
                             </ScrollArea>
                           </div>
                           <p className="text-xs text-foreground">
                             <strong>Config LLM:</strong>
                             <span className="ml-1 text-muted-foreground">{getLLMConfigDisplay(agent.llmConfig)}</span>
                           </p>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2 border-t pt-3 pb-3">
                          <Button variant="outline" size="sm" onClick={() => handleTestAgent(agent)} className="text-xs">
                            <MessageSquare className="mr-1 h-3 w-3" /> Probar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleExportAgent(agent.id)} className="text-xs text-muted-foreground hover:text-primary">
                            <DownloadCloud className="mr-1 h-3 w-3" /> Exportar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleOpenForm(agent)} className="text-xs">
                            <Edit2 className="mr-1 h-3 w-3" /> Editar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteAgent(agent.id)} className="text-xs">
                            <Trash2 className="mr-1 h-3 w-3" /> Eliminar
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Agent Creation/Editing Form Dialog */}
          <DialogContent className="sm:max-w-3xl"> {/* Adjusted max-width */}
            <DialogHeader>
              <DialogTitle>{editingAgent ? 'Editar Agente' : 'Crear Nuevo Agente'}</DialogTitle>
              <DialogDescription>
                {editingAgent ? 'Modifica los detalles de tu agente.' : 'Define un nuevo agente para tus grupos de trabajo.'}
              </DialogDescription>
            </DialogHeader>
            <form id="agent-form-id" onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
              <ScrollArea className="max-h-[70vh] p-1 -mx-1 pr-4">
                <div className="space-y-4 px-1">
                  {/* Form fields remain the same */}
                  <div>
                    <Label htmlFor="name">Nombre del Agente</Label>
                    <Input id="name" {...register('name')} placeholder="Ej: Planificador, Programador" />
                    {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="description">Descripción Corta</Label>
                    <Input id="description" {...register('description')} placeholder="Ej: Responsable de planificar tareas" />
                    {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="systemMessage">Mensaje de Sistema (Prompt)</Label>
                    <Textarea id="systemMessage" {...register('systemMessage')} rows={5} placeholder="Ej: Eres un asistente experto en..." />
                    {errors.systemMessage && <p className="text-sm text-destructive mt-1">{errors.systemMessage.message}</p>}
                  </div>

                  <div className="space-y-2 rounded-md border p-4 bg-muted/30">
                      <Label className="text-base font-medium text-foreground">Configuración LLM del Agente</Label>
                      <Controller
                        name="llmConfigType"
                        control={control}
                        render={({ field }) => (
                           <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar tipo de configuración LLM" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="default">Usar Configuración Global de la Aplicación</SelectItem>
                                  <SelectItem value="custom">Configuración Personalizada para este Agente</SelectItem>
                              </SelectContent>
                          </Select>
                        )}
                      />


                      {watchedLlmConfigType === 'custom' && (
                          <div className="space-y-3 pt-3 border-t border-border mt-3">
                              <p className="text-xs text-muted-foreground">Define qué proveedor y modelo usará específicamente este agente.</p>
                              <div>
                                  <Label htmlFor="customProviderId">Proveedor LLM (Personalizado)</Label>
                                   <Controller
                                      name="customProviderId"
                                      control={control}
                                      render={({ field }) => (
                                        <Select value={field.value || ''} onValueChange={field.onChange}>
                                          <SelectTrigger id="customProviderId">
                                              <SelectValue placeholder="Seleccionar proveedor" />
                                          </SelectTrigger>
                                          <SelectContent>
                                              {LLM_PROVIDERS.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                          </SelectContent>
                                        </Select>
                                      )}
                                  />
                                  {errors.customProviderId && <p className="text-sm text-destructive mt-1">{errors.customProviderId.message}</p>}
                              </div>
                              {watch('customProviderId') && (
                                  <>
                                      <div>
                                          <Label htmlFor="customModelName">Modelo (Personalizado)</Label>
                                          <Controller
                                                name="customModelName"
                                                control={control}
                                                render={({ field }) => (
                                                  <Select value={field.value || ''} onValueChange={field.onChange}>
                                                      <SelectTrigger id="customModelName">
                                                          <SelectValue placeholder="Seleccionar modelo" />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                          {availableCustomModels.length > 0 ? availableCustomModels.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)
                                                          : <div className="p-2 text-sm text-muted-foreground text-center">No hay modelos para este proveedor</div>
                                                          }
                                                      </SelectContent>
                                                  </Select>
                                                )}
                                            />
                                          {errors.customModelName && <p className="text-sm text-destructive mt-1">{errors.customModelName.message}</p>}
                                      </div>

                                      {(LLM_PROVIDERS.find(p=>p.id === watch('customProviderId'))?.requiresApiKey) &&
                                          <div>
                                              <Label htmlFor="customApiKey">Clave API (Personalizada, opcional)</Label>
                                              <Input id="customApiKey" type="password" {...register('customApiKey')} placeholder="Sobrescribir clave API global (si aplica)" />
                                              <p className="text-xs text-muted-foreground mt-1">Deja vacío para usar la clave API global (si está configurada).</p>
                                          </div>
                                      }
                                      {(LLM_PROVIDERS.find(p=>p.id === watch('customProviderId'))?.id === 'lmstudio' || LLM_PROVIDERS.find(p=>p.id === watch('customProviderId'))?.id === 'ollama') &&
                                        <div>
                                            <Label htmlFor="customApiUrl">URL de API (Personalizada, opcional)</Label>
                                            <Input id="customApiUrl" type="url" {...register('customApiUrl')} placeholder={LLM_PROVIDERS.find(p=>p.id === watch('customProviderId'))?.apiUrl || 'Ej: http://localhost:1234/v1'} />
                                            {errors.customApiUrl && <p className="text-sm text-destructive mt-1">{errors.customApiUrl.message}</p>}
                                            <p className="text-xs text-muted-foreground mt-1">Deja vacío para usar la URL global (si está configurada) o el valor por defecto del proveedor.</p>
                                        </div>
                                      }
                                  </>
                              )}
                          </div>
                      )}
                  </div>
                </div>
              </ScrollArea>
            </form>
            <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancelar</Button>
                </DialogClose>
                {/* Submit button uses form attribute to link to the form inside ScrollArea */}
                <Button type="submit" form="agent-form-id">
                  <Wand2 className="mr-2 h-4 w-4" />
                  {editingAgent ? 'Guardar Cambios' : 'Crear Agente'}
                </Button>
            </DialogFooter>
          </DialogContent>
        </div>
      </Dialog>

      {/* Test Agent Chat Modal */}
      {testingAgent && resolvedLlmOptions && (
        <AgentTestChatModal
          isOpen={isTestModalOpen}
          onClose={() => {
            setIsTestModalOpen(false);
            setTestingAgent(null);
            setResolvedLlmOptions(null);
          }}
          agent={testingAgent}
          llmOptions={resolvedLlmOptions} // Pass resolved options
        />
      )}
    </>
  );
}
