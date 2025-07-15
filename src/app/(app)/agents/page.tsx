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
import { Checkbox } from '@/components/ui/checkbox'; // Import Checkbox
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Users2, Edit2, Trash2, Wand2, UploadCloud, DownloadCloud, MessageSquare, Code, Terminal, FolderGit2, FileCode, ShieldCheck, RefreshCw, Loader2 } from 'lucide-react';
import type { AgentConfig, AgentLLMConfig, AgentSpecificLLMConfig, WorkgroupConfig } from '@/types/agent';
import { LLM_PROVIDERS, MODELS_BY_PROVIDER, DEFAULT_LLM_PROVIDER, type LLMProviderId, getLocalStorageApiKeyName, getLocalStorageModelName, LOCALSTORAGE_PROVIDER_ID_KEY as GLOBAL_PROVIDER_ID_KEY } from '@/config/llm-config';
import { AgentTestChatModal } from '@/components/agent-test-chat-modal'; // Import the new component
import type { LLMOptions } from '@/services/groq'; // Import LLMOptions type
import { Separator } from '@/components/ui/separator'; // Import Separator
import { Badge } from '@/components/ui/badge'; // Import Badge
import { LOCALSTORAGE_WORKGROUPS_KEY, ORCHESTRATOR_AGENT_NAME, REFACTOR_AGENT_NAME, LOCALSTORAGE_AGENTS_KEY } from '@/config/agent-config';
import { resolveLlmOptionsForSource, type LocalStorageSnapshot } from '@/lib/llm-utils';
import { handleFetchModels } from '@/app/(app)/settings/actions';
import { cn } from '@/lib/utils';


const agentSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres.'),
  systemMessage: z.string().min(20, 'El mensaje de sistema debe tener al menos 20 caracteres.'),
  llmConfigType: z.enum(['default', 'custom']),
  customProviderId: z.custom<LLMProviderId>().optional(),
  customModelName: z.string().optional(),
  // customApiKey: z.string().optional(), // Removed
  // customApiUrl: z.string().url().optional().or(z.literal('')), // Removed
  selfCodeAccess: z.boolean().optional().default(false),
  executionCapability: z.boolean().optional().default(false),
  virtualEnvCapability: z.boolean().optional().default(false),
  readWriteCapability: z.boolean().optional().default(false),
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

const defaultAgents: Omit<AgentConfig, 'id'>[] = [
  { name: "JefeDeProducto", description: "Define requisitos, historias de usuario y prioridades.", systemMessage: "Eres un Jefe de Producto experimentado. Tu tarea es definir claramente los requisitos del proyecto, crear historias de usuario detalladas y establecer prioridades. Comunícate de forma efectiva con el equipo.", llmConfig: 'default' },
  { name: "ArquitectoSoftware", description: "Diseña la arquitectura del sistema y selecciona tecnologías.", systemMessage: "Eres un Arquitecto de Software senior. Tu responsabilidad es diseñar una arquitectura robusta, escalable y mantenible. Selecciona las tecnologías y patrones de diseño más adecuados.", llmConfig: 'default' },
  { name: "DesarrolladorSoftware", description: "Escribe el código fuente de la aplicación.", systemMessage: "Eres un Desarrollador de Software competente. Tu misión es escribir código limpio, eficiente y bien documentado. Implementa las funcionalidades requeridas.", llmConfig: 'default', capabilities: { selfCodeAccess: true, executionCapability: true, virtualEnvCapability: false, readWriteCapability: true }},
  { name: "IngenieroPruebas", description: "Escribe y ejecuta pruebas para asegurar la calidad.", systemMessage: "Eres un Ingeniero de Pruebas meticuloso. Tu objetivo es asegurar la calidad del software mediante la creación y ejecución de planes de prueba exhaustivos. Reporta los errores de forma clara.", llmConfig: 'default', capabilities: { executionCapability: true } },
  { name: "IngenieroDevOps", description: "Gestiona infraestructura, despliegues y CI/CD.", systemMessage: "Eres un Ingeniero DevOps eficiente. Tu función es automatizar los procesos de CI/CD y gestionar la infraestructura, asegurando su disponibilidad y rendimiento.", llmConfig: 'default', capabilities: { executionCapability: true, virtualEnvCapability: true, readWriteCapability: true } },
  { name: "RepresentanteUsuario", description: "Proporciona feedback desde la perspectiva del usuario final.", systemMessage: "Eres el Representante del Usuario. Tu perspectiva es crucial. Proporciona feedback sobre las funcionalidades desarrolladas y valida que el producto cumple con las expectativas.", llmConfig: 'default' },
  {
    name: ORCHESTRATOR_AGENT_NAME,
    description: "Agente central obligatorio en cada Grupo de Trabajo. Gestiona el flujo de interacciones, recibe todas las respuestas y decide qué agente actúa a continuación para garantizar un proceso coordinado y la toma de decisiones centralizada.",
    systemMessage: `Eres ${ORCHESTRATOR_AGENT_NAME}. Tu rol es crítico: debes recibir y gestionar todas las respuestas generadas dentro del grupo. Basado en la tarea principal, el historial de conversación y el estado actual del proceso, decides a qué agente o subgrupo derivar la interacción. Todas las respuestas de los agentes deben pasar obligatoriamente por ti para asegurar un flujo coordinado y la toma de decisiones centralizada para completar la tarea del grupo eficientemente. No realizas la tarea directamente; facilitas que los otros agentes la completen. Pide aclaraciones si es necesario y resume el progreso. Si el usuario no propone un paso explícito, prioriza agentes con capacidades relevantes para la tarea actual (ej. '${REFACTOR_AGENT_NAME}' para mejoras de código). Tu respuesta DEBE SER EXCLUSIVAMENTE un objeto JSON válido con las claves 'next_agent_name' (string, el nombre EXACTO de un agente disponible o 'COMPLETADO') y 'reason' (string, justificación concisa). No incluyas NADA más.`,
    llmConfig: 'default'
  },
  {
    name: REFACTOR_AGENT_NAME,
    description: "Analiza código y propone refactorizaciones para mejorar calidad, rendimiento o legibilidad, priorizando estándares como SOLID y Clean Code.",
    systemMessage: `Eres ${REFACTOR_AGENT_NAME}. Prioriza estándares como SOLID y Clean Code. Analiza el proyecto o fragmento de código proporcionado. Considera las metas y prioridades de refactorización especificadas. Genera una lista de sugerencias de refactorización. Para cada sugerencia, indica el archivo/área, una descripción clara de la mejora, una prioridad (Alta, Media, o Baja) y, si es aplicable, un fragmento del código modificado. Tu respuesta DEBE ser un objeto JSON con la clave "refactoringSuggestions", que es un array de objetos, cada uno con "area", "description", "priority", y opcionalmente "suggestedSnippet". Todas las sugerencias y descripciones deben estar en castellano.`,
    llmConfig: 'default',
    capabilities: { selfCodeAccess: true, executionCapability: true, readWriteCapability: false }
  },
  {
    name: "ValidadorCodigo",
    description: "Analiza resultados de refactorización para detectar errores y asegurar la calidad del código, por ejemplo, ejecutando linters o tests.",
    systemMessage: "Eres un Validador de Código. Tu tarea es analizar el código proporcionado o modificado para detectar errores de sintaxis, violaciones de estilo, y asegurar que las pruebas (si existen) pasen. Informa sobre cualquier problema encontrado.",
    llmConfig: 'default',
    capabilities: { selfCodeAccess: true, executionCapability: true, readWriteCapability: false }
  }
];


export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentConfig | null>(null);
  const [testingAgent, setTestingAgent] = useState<AgentConfig | null>(null); // State for the agent being tested
  const [isTestModalOpen, setIsTestModalOpen] = useState(false); // State for the test modal visibility
  const [resolvedLlmOptions, setResolvedLlmOptions] = useState<LLMOptions | null>(null); // State for resolved LLM options for testing
  const [isFetchingAgentModels, setIsFetchingAgentModels] = useState(false);

  const { toast } = useToast();
  const importFileRef = useRef<HTMLInputElement>(null);

  const { control, register, handleSubmit, reset, setValue, watch, getValues, formState: { errors, dirtyFields } } = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      llmConfigType: 'default',
      selfCodeAccess: false,
      executionCapability: false,
      virtualEnvCapability: false,
      readWriteCapability: false,
    }
  });

  const watchedLlmConfigType = watch('llmConfigType');
  const watchedCustomProviderId = watch('customProviderId');

  const [availableCustomModels, setAvailableCustomModels] = useState<string[]>([]);

   useEffect(() => {
    const storedAgentsRaw = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
    let currentAgents: AgentConfig[] = [];
    let agentsModified = false;

    if (storedAgentsRaw) {
      try {
        const parsedAgents = JSON.parse(storedAgentsRaw);
        if (Array.isArray(parsedAgents)) {
          currentAgents = parsedAgents.map(agent => ({
              ...agent,
              id: agent.id || crypto.randomUUID(), // Ensure ID exists
              llmConfig: agent.llmConfig || 'default', // Ensure llmConfig exists
              capabilities: { // Ensure capabilities object and its properties exist with defaults
                selfCodeAccess: agent.capabilities?.selfCodeAccess ?? agent.selfCodeAccess ?? false,
                executionCapability: agent.capabilities?.executionCapability ?? agent.executionCapability ?? false,
                virtualEnvCapability: agent.capabilities?.virtualEnvCapability ?? agent.virtualEnvCapability ?? false,
                readWriteCapability: agent.capabilities?.readWriteCapability ?? agent.readWriteCapability ?? false,
              }
          }));
        } else {
          throw new Error("Stored agents is not an array");
        }
      } catch (e) {
        console.error("Error parsing stored agents, re-initializing with defaults:", e);
        localStorage.removeItem(LOCALSTORAGE_AGENTS_KEY); // Clear corrupted data
        // currentAgents will be empty, leading to full initialization below
      }
    }

    // Ensure essential default agents exist by name, add if missing
    defaultAgents.forEach(defaultAgentData => {
      const existingAgent = currentAgents.find(a => a.name === defaultAgentData.name);
      if (!existingAgent) {
        console.warn(`Default agent "${defaultAgentData.name}" not found in storage. Adding it.`);
        currentAgents.push({
          ...defaultAgentData,
          id: crypto.randomUUID(),
          llmConfig: defaultAgentData.llmConfig || 'default',
          capabilities: {
            selfCodeAccess: defaultAgentData.capabilities?.selfCodeAccess ?? false,
            executionCapability: defaultAgentData.capabilities?.executionCapability ?? false,
            virtualEnvCapability: defaultAgentData.capabilities?.virtualEnvCapability ?? false,
            readWriteCapability: defaultAgentData.capabilities?.readWriteCapability ?? false,
          }
        });
        agentsModified = true;
      } else {
        // Ensure existing agents have the capabilities structure
        if (typeof existingAgent.capabilities !== 'object' || existingAgent.capabilities === null) {
           console.warn(`Agent "${existingAgent.name}" missing capabilities object. Initializing.`);
           existingAgent.capabilities = {
                selfCodeAccess: defaultAgentData.capabilities?.selfCodeAccess ?? false,
                executionCapability: defaultAgentData.capabilities?.executionCapability ?? false,
                virtualEnvCapability: defaultAgentData.capabilities?.virtualEnvCapability ?? false,
                readWriteCapability: defaultAgentData.capabilities?.readWriteCapability ?? false,
           };
           agentsModified = true;
        }
      }
    });
    
    setAgents(currentAgents);

    // Save back to localStorage if agents were added/modified or if localStorage was initially empty/corrupted
    if (agentsModified || !storedAgentsRaw) {
      localStorage.setItem(LOCALSTORAGE_AGENTS_KEY, JSON.stringify(currentAgents));
      if (!storedAgentsRaw) console.log("Initialized agents in localStorage with defaults.");
      else if (agentsModified) console.log("Updated agents in localStorage with missing defaults.");
    }
  }, []);


  useEffect(() => {
    if (watchedLlmConfigType === 'custom' && watchedCustomProviderId) {
      const models = MODELS_BY_PROVIDER[watchedCustomProviderId] || {};
      const modelNames = Object.keys(models).sort((a,b) => (models[b].tpm || 0) - (models[a].tpm || 0) || a.localeCompare(b));
      setAvailableCustomModels(modelNames);
      const currentModel = watch('customModelName');
      if (modelNames.length > 0 && (!currentModel || !modelNames.includes(currentModel))) {
        setValue('customModelName', modelNames[0], { shouldDirty: !!editingAgent }); 
      }
    } else {
      setAvailableCustomModels([]);
    }
  }, [watchedLlmConfigType, watchedCustomProviderId, setValue, watch, editingAgent]);

  const handleOpenForm = (agent?: AgentConfig) => {
    if (agent) {
      setEditingAgent(agent);
      const llmConfig = agent.llmConfig;
      reset({
        name: agent.name,
        description: agent.description,
        systemMessage: agent.systemMessage,
        llmConfigType: llmConfig === 'default' ? 'default' : 'custom',
        customProviderId: llmConfig !== 'default' ? llmConfig.providerId : undefined,
        customModelName: llmConfig !== 'default' ? llmConfig.modelName : undefined,
        selfCodeAccess: agent.capabilities?.selfCodeAccess ?? false,
        executionCapability: agent.capabilities?.executionCapability ?? false,
        virtualEnvCapability: agent.capabilities?.virtualEnvCapability ?? false,
        readWriteCapability: agent.capabilities?.readWriteCapability ?? false,
      });
    } else {
      setEditingAgent(null);
      reset({
        name: '', description: '', systemMessage: '',
        llmConfigType: 'default',
        customProviderId: undefined, customModelName: undefined,
        selfCodeAccess: false, executionCapability: false,
        virtualEnvCapability: false, readWriteCapability: false,
      });
    }
    setIsFormOpen(true);
  };

  const onSubmit: SubmitHandler<AgentFormData> = (data) => {
    let llmConfigToSave: AgentLLMConfig = 'default';
    if (data.llmConfigType === 'custom' && data.customProviderId && data.customModelName) {
      llmConfigToSave = {
        providerId: data.customProviderId,
        modelName: data.customModelName,
      };
    }

    const newAgent: AgentConfig = {
      id: editingAgent?.id || crypto.randomUUID(),
      name: data.name,
      description: data.description,
      systemMessage: data.systemMessage,
      llmConfig: llmConfigToSave,
      capabilities: {
        selfCodeAccess: data.selfCodeAccess ?? false,
        executionCapability: data.executionCapability ?? false,
        virtualEnvCapability: data.virtualEnvCapability ?? false,
        readWriteCapability: data.readWriteCapability ?? false,
      }
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
    const agentToDelete = agents.find(a => a.id === agentId);
    if (!agentToDelete) return;

    if (agentToDelete.name === ORCHESTRATOR_AGENT_NAME) {
      toast({
        title: 'Eliminación Denegada',
        description: `El agente Orquestador principal (${ORCHESTRATOR_AGENT_NAME}) no puede ser eliminado.`,
        variant: 'destructive',
      });
      return;
    }
    
    const updatedAgents = agents.filter(a => a.id !== agentId);
    setAgents(updatedAgents);
    localStorage.setItem(LOCALSTORAGE_AGENTS_KEY, JSON.stringify(updatedAgents));

    const storedWorkgroupsRaw = localStorage.getItem(LOCALSTORAGE_WORKGROUPS_KEY);
    if (storedWorkgroupsRaw) {
      try {
        let currentWorkgroups: WorkgroupConfig[] = JSON.parse(storedWorkgroupsRaw);
        const newWorkgroups = currentWorkgroups.map(wg => ({
          ...wg,
          agentIds: wg.agentIds.filter(id => id !== agentId)
        }));
        localStorage.setItem(LOCALSTORAGE_WORKGROUPS_KEY, JSON.stringify(newWorkgroups));
      } catch (e) {
        console.error("Error updating workgroups in localStorage after agent deletion:", e);
        toast({ title: "Error al Actualizar Grupos", description: "No se pudieron actualizar los grupos de trabajo después de eliminar el agente.", variant: "destructive"});
      }
    }
    toast({ title: 'Agente Eliminado', description: `El agente "${agentToDelete.name}" ha sido eliminado y removido de los grupos de trabajo.` });
  };

  const handleTestAgent = (agent: AgentConfig) => {
    let options: LLMOptions | null = null;
    
    const localStorageSnapshot: LocalStorageSnapshot = {
      [GLOBAL_PROVIDER_ID_KEY]: localStorage.getItem(GLOBAL_PROVIDER_ID_KEY) as LLMProviderId | null,
      apiKeys: {},
      modelNames: {},
      apiUrls: {},
    };
    LLM_PROVIDERS.forEach(provider => {
        localStorageSnapshot.apiKeys[provider.id] = localStorage.getItem(getLocalStorageApiKeyName(provider.id));
        localStorageSnapshot.modelNames[provider.id] = localStorage.getItem(getLocalStorageModelName(provider.id));
        localStorageSnapshot.apiUrls[provider.id] = localStorage.getItem(`codealchemist_apiurl_${provider.id}`);
    });
    
    options = resolveLlmOptionsForSource(`agent:${agent.id}`, agents, [], localStorageSnapshot);


    if (options) {
        setResolvedLlmOptions(options);
        setTestingAgent(agent);
        setIsTestModalOpen(true);
    } else {
         toast({ title: "Error de Configuración de Agente", description: `No se pudo resolver la configuración LLM para el agente '${agent.name}'. Revisa la configuración del agente y la configuración global.`, variant: "destructive" });
    }
  };

  const getLLMConfigDisplay = (llmConfig: AgentLLMConfig): string => {
    if (llmConfig === 'default') {
      const globalProviderId = localStorage.getItem(GLOBAL_PROVIDER_ID_KEY) as LLMProviderId | null || DEFAULT_LLM_PROVIDER;
      const globalModelName = localStorage.getItem(getLocalStorageModelName(globalProviderId)) || 'No configurado';
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
        name: '', description: '', systemMessage: '',
        llmConfigType: 'default', customProviderId: undefined, customModelName: undefined,
        selfCodeAccess: false, executionCapability: false, virtualEnvCapability: false, readWriteCapability: false,
      });
    }
  };

  const onFetchAgentModels = async () => {
    const providerId = getValues('customProviderId');
    if (!providerId) {
        toast({title: "Error", description: "Selecciona un proveedor primero.", variant: "destructive"});
        return;
    }
    const provider = LLM_PROVIDERS.find(p => p.id === providerId);
    if (!provider) return;
    
    const apiKey = localStorage.getItem(getLocalStorageApiKeyName(providerId)) || "";
    const apiUrl = localStorage.getItem(`codealchemist_apiurl_${providerId}`) || provider.apiUrl;

    if (provider.requiresApiKey && !apiKey) {
        toast({title: "Clave API Global Requerida", description: `La clave API para ${provider.name} no está configurada en los ajustes globales.`, variant: "destructive", duration: 7000});
        return;
    }

    setIsFetchingAgentModels(true);
    toast({title: "Actualizando Modelos...", description: `Contactando a ${provider.name}...`});

    const result = await handleFetchModels(providerId, apiKey, apiUrl);
    
    if (result.success) {
        setAvailableCustomModels(result.models);
        if (result.models.length > 0 && !result.models.includes(getValues('customModelName') || '')) {
            setValue('customModelName', result.models[0], { shouldDirty: true });
        }
        toast({title: "Modelos Actualizados", description: `Se encontraron ${result.models.length} modelos para ${provider.name}. ${result.message || ''}`});
    } else {
        toast({title: "Error al Actualizar Modelos", description: result.message || "No se pudieron obtener los modelos.", variant: "destructive"});
    }

    setIsFetchingAgentModels(false);
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

        let agentsToImport: AgentConfig[];
        if (Array.isArray(importedData)) {
          agentsToImport = importedData as AgentConfig[]; 
        } else if (typeof importedData === 'object' && importedData !== null && 'id' in importedData && 'name' in importedData) {
          agentsToImport = [importedData as AgentConfig];
        } else {
          throw new Error("El archivo JSON no contiene un agente o una lista de agentes válidos.");
        }

        agentsToImport.forEach(agent => {
          if (!agent.id || !agent.name || !agent.systemMessage) {
            throw new Error(`Agente importado inválido: falta id, name o systemMessage. Agente: ${JSON.stringify(agent).substring(0,100)}`);
          }
          // Ensure capabilities object exists and has default values if missing from imported agent
            agent.capabilities = {
                selfCodeAccess: agent.capabilities?.selfCodeAccess ?? agent.selfCodeAccess ?? false,
                executionCapability: agent.capabilities?.executionCapability ?? agent.executionCapability ?? false,
                virtualEnvCapability: agent.capabilities?.virtualEnvCapability ?? agent.virtualEnvCapability ?? false,
                readWriteCapability: agent.capabilities?.readWriteCapability ?? agent.readWriteCapability ?? false,
            };
        });

        let updatedAgents = [...agents];
        let newAgentsCount = 0;
        let updatedAgentsCount = 0;

        agentsToImport.forEach(importedAgent => {
          const existingIndex = updatedAgents.findIndex(a => a.id === importedAgent.id);
          if (existingIndex > -1) {
            updatedAgents[existingIndex] = importedAgent; 
            updatedAgentsCount++;
          } else {
            updatedAgents.push({...importedAgent, id: importedAgent.id || crypto.randomUUID()}); 
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
            <CardHeader className="border-b pb-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <Users2 className="h-6 w-6 text-primary" />
                      Gestión de Agentes IA
                    </CardTitle>
                    <CardDescription className="mt-1 text-muted-foreground">
                      Crea, administra, prueba, importa y exporta tus agentes de IA.
                      Los agentes pueden ser configurados con capacidades específicas y asignados a grupos de trabajo.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
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
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {agents.length === 0 ? (
                <p className="text-muted-foreground text-center py-12">No hay agentes creados. ¡Empieza creando uno o importa agentes existentes!</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"> 
                  {agents.map(agent => (
                    <Card key={agent.id} className="flex flex-col bg-card hover:shadow-md transition-shadow duration-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold text-primary">{agent.name}</CardTitle>
                        <CardDescription className="text-sm text-muted-foreground h-10 line-clamp-2">{agent.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow space-y-3 pt-2 pb-4">
                         <div className="space-y-1">
                           <Label className="text-xs font-medium text-foreground">Mensaje de Sistema:</Label>
                           <ScrollArea className="h-20 p-2 border rounded bg-muted/50 text-xs text-muted-foreground">
                             <pre className="whitespace-pre-wrap font-mono">{agent.systemMessage}</pre>
                           </ScrollArea>
                         </div>
                         <div className="space-y-1">
                           <Label className="text-xs font-medium text-foreground">Config LLM:</Label>
                           <p className="text-xs text-muted-foreground">{getLLMConfigDisplay(agent.llmConfig)}</p>
                         </div>
                         <div className="space-y-1">
                              <Label className="text-xs font-medium text-foreground">Capacidades:</Label>
                              <div className="flex flex-wrap gap-1">
                                  {agent.capabilities?.selfCodeAccess && <Badge variant="outline" className="text-xs"><Code className="mr-1 h-3 w-3"/>Código Propio</Badge>}
                                  {agent.capabilities?.executionCapability && <Badge variant="outline" className="text-xs"><Terminal className="mr-1 h-3 w-3"/>Ejecución</Badge>}
                                  {agent.capabilities?.virtualEnvCapability && <Badge variant="outline" className="text-xs"><FolderGit2 className="mr-1 h-3 w-3"/>Entorno Virtual</Badge>}
                                  {agent.capabilities?.readWriteCapability && <Badge variant="outline" className="text-xs"><FileCode className="mr-1 h-3 w-3"/>Lectura/Escritura</Badge>}
                                  {(!agent.capabilities?.selfCodeAccess && !agent.capabilities?.executionCapability && !agent.capabilities?.virtualEnvCapability && !agent.capabilities?.readWriteCapability) && <span className="text-xs text-muted-foreground italic">Ninguna</span>}
                              </div>
                          </div>
                      </CardContent>
                      <CardFooter className="flex justify-end gap-2 border-t pt-3 pb-3 bg-muted/30">
                        <Button variant="outline" size="sm" onClick={() => handleTestAgent(agent)} className="text-xs px-2">
                          <MessageSquare className="mr-1 h-3 w-3" /> Probar
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleExportAgent(agent.id)} title="Exportar Agente" className="text-muted-foreground hover:text-primary">
                          <DownloadCloud className="h-4 w-4" />
                        </Button>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenForm(agent)} title="Editar Agente" className="text-muted-foreground hover:text-primary">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                         <AlertDialog>
                           <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Eliminar Agente" className="text-muted-foreground hover:text-destructive" disabled={agent.name === ORCHESTRATOR_AGENT_NAME}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                           </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar Agente?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  ¿Estás seguro de que quieres eliminar al agente "{agent.name}"? Esta acción no se puede deshacer.
                                  {agent.name === ORCHESTRATOR_AGENT_NAME && <p className="mt-2 font-semibold text-destructive">Este es el agente Orquestador principal y no puede ser eliminado.</p>}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteAgent(agent.id)} className="bg-destructive hover:bg-destructive/90" disabled={agent.name === ORCHESTRATOR_AGENT_NAME}>
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <DialogContent className="sm:max-w-3xl"> 
            <DialogHeader>
              <DialogTitle>{editingAgent ? 'Editar Agente' : 'Crear Nuevo Agente'}</DialogTitle>
              <DialogDescription>
                {editingAgent ? 'Modifica los detalles de tu agente.' : 'Define un nuevo agente para tus grupos de trabajo.'}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] w-full" type="always">
              <form id="agent-form-id" onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4 pr-6">
                <div className="space-y-4 px-1">
                  <div>
                    <Label htmlFor="name">Nombre del Agente</Label>
                    <Input id="name" {...register('name')} placeholder="Ej: Planificador, Programador" disabled={editingAgent?.name === ORCHESTRATOR_AGENT_NAME} />
                    {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                     {editingAgent?.name === ORCHESTRATOR_AGENT_NAME && <p className="text-xs text-muted-foreground mt-1">El nombre del agente Orquestrador no puede ser modificado.</p>}
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

                   <div className="space-y-3 rounded-md border p-4 bg-muted/30">
                        <Label className="text-base font-medium text-foreground">Capacidades del Agente</Label>
                        <p className="text-xs text-muted-foreground">Habilita permisos específicos para el agente. ¡Ten cuidado con las capacidades de ejecución y escritura!</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                           <Controller
                              name="selfCodeAccess"
                              control={control}
                              render={({ field }) => (
                                <div className="flex items-center space-x-2">
                                  <Checkbox id="selfCodeAccess" checked={field.value} onCheckedChange={field.onChange} />
                                  <Label htmlFor="selfCodeAccess" className="text-sm font-normal text-foreground flex items-center gap-1"><Code className="h-4 w-4"/> Acceso a Código Propio</Label>
                                </div>
                              )}
                            />
                           <Controller
                              name="executionCapability"
                              control={control}
                              render={({ field }) => (
                                <div className="flex items-center space-x-2">
                                  <Checkbox id="executionCapability" checked={field.value} onCheckedChange={field.onChange} />
                                  <Label htmlFor="executionCapability" className="text-sm font-normal text-foreground flex items-center gap-1"><Terminal className="h-4 w-4"/> Capacidad de Ejecución <Badge variant="destructive" className="h-4 px-1 py-0 text-[10px]">Peligroso</Badge></Label>
                                </div>
                              )}
                            />
                            <Controller
                              name="virtualEnvCapability"
                              control={control}
                              render={({ field }) => (
                                <div className="flex items-center space-x-2">
                                  <Checkbox id="virtualEnvCapability" checked={field.value} onCheckedChange={field.onChange} />
                                  <Label htmlFor="virtualEnvCapability" className="text-sm font-normal text-foreground flex items-center gap-1"><FolderGit2 className="h-4 w-4"/> Capacidad de Entorno Virtual</Label>
                                </div>
                              )}
                            />
                             <Controller
                              name="readWriteCapability"
                              control={control}
                              render={({ field }) => (
                                <div className="flex items-center space-x-2">
                                  <Checkbox id="readWriteCapability" checked={field.value} onCheckedChange={field.onChange} />
                                  <Label htmlFor="readWriteCapability" className="text-sm font-normal text-foreground flex items-center gap-1"><FileCode className="h-4 w-4"/> Capacidad Lectura/Escritura <Badge variant="destructive" className="h-4 px-1 py-0 text-[10px]">Peligroso</Badge></Label>
                                </div>
                              )}
                            />
                        </div>
                        { (watch('executionCapability') || watch('readWriteCapability')) &&
                            <p className="text-xs text-destructive mt-1">Advertencia: Habilitar la ejecución o la escritura de archivos puede tener implicaciones de seguridad.</p>
                        }
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
                              <p className="text-xs text-muted-foreground">Define qué proveedor y modelo usará específicamente este agente. La clave API y la URL se heredarán de la configuración global.</p>
                              <div>
                                  <Label htmlFor="customProviderId">Proveedor LLM (Personalizado)</Label>
                                   <Controller
                                      name="customProviderId"
                                      control={control}
                                      render={({ field }) => (
                                        <Select value={field.value || ''} onValueChange={(value) => {
                                            field.onChange(value);
                                            setValue('customModelName', undefined, { shouldDirty: true });
                                            setAvailableCustomModels([]);
                                        }}>
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
                                          <div className="flex items-center gap-2">
                                            <Button type="button" variant="outline" size="sm" onClick={onFetchAgentModels} disabled={isFetchingAgentModels}>
                                              <RefreshCw className={cn("mr-2 h-4 w-4", isFetchingAgentModels && "animate-spin")} />
                                              Actualizar Modelos
                                            </Button>
                                          </div>
                                          <Controller
                                                name="customModelName"
                                                control={control}
                                                render={({ field }) => (
                                                  <Select value={field.value || ''} onValueChange={field.onChange} disabled={availableCustomModels.length === 0}>
                                                      <SelectTrigger id="customModelName" className="mt-2">
                                                          <SelectValue placeholder={availableCustomModels.length > 0 ? "Seleccionar modelo" : "Pulsa 'Actualizar Modelos'"} />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                          {availableCustomModels.length > 0 ? availableCustomModels.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)
                                                          : <div className="p-2 text-sm text-muted-foreground text-center">No hay modelos. Pulsa 'Actualizar'.</div>
                                                          }
                                                      </SelectContent>
                                                  </Select>
                                                )}
                                            />
                                          {errors.customModelName && <p className="text-sm text-destructive mt-1">{errors.customModelName.message}</p>}
                                      </div>
                                  </>
                              )}
                          </div>
                      )}
                  </div>
                </div>
              </form>
            </ScrollArea>
            <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancelar</Button>
                </DialogClose>
                <Button type="submit" form="agent-form-id" disabled={editingAgent?.name === ORCHESTRATOR_AGENT_NAME && dirtyFields.name}>
                  <Wand2 className="mr-2 h-4 w-4" />
                  {editingAgent ? 'Guardar Cambios' : 'Crear Agente'}
                </Button>
            </DialogFooter>
          </DialogContent>
        </div>
      </Dialog>

      {testingAgent && resolvedLlmOptions && (
        <AgentTestChatModal
          isOpen={isTestModalOpen}
          onClose={() => {
            setIsTestModalOpen(false);
            setTestingAgent(null);
            setResolvedLlmOptions(null);
          }}
          agent={testingAgent}
          llmOptions={resolvedLlmOptions}
        />
      )}
    </>
  );
}
