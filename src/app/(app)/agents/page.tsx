// src/app/(app)/agents/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
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
import { PlusCircle, Users2, Edit2, Trash2, Wand2 } from 'lucide-react';
import type { AgentConfig, AgentLLMConfig, AgentSpecificLLMConfig } from '@/types/agent';
import { LLM_PROVIDERS, MODELS_BY_PROVIDER, DEFAULT_LLM_PROVIDER, type LLMProviderId, getLocalStorageApiKeyName as getGlobalApiKeyName, getLocalStorageModelName as getGlobalModelName, LOCALSTORAGE_PROVIDER_ID_KEY as GLOBAL_PROVIDER_ID_KEY } from '@/config/llm-config';

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
  path: ["customModelName"], // Point error to one of the custom fields
});

type AgentFormData = z.infer<typeof agentSchema>;

const LOCALSTORAGE_AGENTS_KEY = 'codealchemist_agents';

// Default agents
const defaultAgents: Omit<AgentConfig, 'id'>[] = [
  { name: "JefeDeProducto", description: "Define requisitos, historias de usuario y prioridades.", systemMessage: "Eres un Jefe de Producto experimentado. Tu tarea es definir claramente los requisitos del proyecto, crear historias de usuario detalladas y establecer prioridades. Comunícate de forma efectiva con el equipo.", llmConfig: 'default' },
  { name: "ArquitectoSoftware", description: "Diseña la arquitectura del sistema y selecciona tecnologías.", systemMessage: "Eres un Arquitecto de Software senior. Tu responsabilidad es diseñar una arquitectura robusta, escalable y mantenible. Selecciona las tecnologías y patrones de diseño más adecuados.", llmConfig: 'default' },
  { name: "DesarrolladorSoftware", description: "Escribe el código fuente de la aplicación.", systemMessage: "Eres un Desarrollador de Software competente. Tu misión es escribir código limpio, eficiente y bien documentado. Implementa las funcionalidades requeridas.", llmConfig: 'default' },
  { name: "IngenieroPruebas", description: "Escribe y ejecuta pruebas para asegurar la calidad.", systemMessage: "Eres un Ingeniero de Pruebas meticuloso. Tu objetivo es asegurar la calidad del software mediante la creación y ejecución de planes de prueba exhaustivos. Reporta los errores de forma clara.", llmConfig: 'default' },
  { name: "IngenieroDevOps", description: "Gestiona infraestructura, despliegues y CI/CD.", systemMessage: "Eres un Ingeniero DevOps eficiente. Tu función es automatizar los procesos de CI/CD y gestionar la infraestructura, asegurando su disponibilidad y rendimiento.", llmConfig: 'default' },
  { name: "RepresentanteUsuario", description: "Proporciona feedback desde la perspectiva del usuario final.", systemMessage: "Eres el Representante del Usuario. Tu perspectiva es crucial. Proporciona feedback sobre las funcionalidades desarrolladas y valida que el producto cumple con las expectativas.", llmConfig: 'default' },
];


export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentConfig | null>(null);
  const { toast } = useToast();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema),
    defaultValues: { llmConfigType: 'default' }
  });

  const watchedLlmConfigType = watch('llmConfigType');
  const watchedCustomProviderId = watch('customProviderId');

  const [availableCustomModels, setAvailableCustomModels] = useState<string[]>([]);

   useEffect(() => {
    const storedAgents = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
    if (storedAgents) {
      setAgents(JSON.parse(storedAgents));
    } else {
      // Pre-populate with default agents if none are stored
      const initialAgents = defaultAgents.map(agent => ({ ...agent, id: crypto.randomUUID() }));
      setAgents(initialAgents);
      localStorage.setItem(LOCALSTORAGE_AGENTS_KEY, JSON.stringify(initialAgents));
    }
  }, []);

  useEffect(() => {
    if (watchedLlmConfigType === 'custom' && watchedCustomProviderId) {
      const models = MODELS_BY_PROVIDER[watchedCustomProviderId] || {};
      const modelNames = Object.keys(models).sort((a,b) => (models[b].tpm || 0) - (models[a].tpm || 0) || a.localeCompare(b));
      setAvailableCustomModels(modelNames);
      if (modelNames.length > 0 && !watch('customModelName')) {
        setValue('customModelName', modelNames[0]);
      }
    } else {
      setAvailableCustomModels([]);
    }
  }, [watchedLlmConfigType, watchedCustomProviderId, setValue, watch]);

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
        apiKey: data.customApiKey || null,
        apiUrl: data.customApiUrl || provider?.apiUrl || null,
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


  return (
    <Dialog open={isFormOpen} onOpenChange={handleDialogVisibilityChange}>
      <div className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Users2 className="h-6 w-6 text-primary" />
                Gestión de Agentes IA
              </CardTitle>
              <CardDescription>
                Crea y administra tus agentes de IA para AutoGen.
              </CardDescription>
            </div>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenForm()}>
                <PlusCircle className="mr-2 h-4 w-4" /> Crear Agente
              </Button>
            </DialogTrigger>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No hay agentes creados. ¡Empieza creando uno!</p>
            ) : (
              <ScrollArea className="h-[calc(100vh-20rem)]">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {agents.map(agent => (
                    <Card key={agent.id} className="flex flex-col">
                      <CardHeader>
                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                        <CardDescription className="text-xs truncate">{agent.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow space-y-2">
                         <p className="text-xs text-muted-foreground"><strong>Mensaje de Sistema:</strong> <span className="line-clamp-2">{agent.systemMessage}</span></p>
                         <p className="text-xs text-muted-foreground"><strong>Config LLM:</strong> {getLLMConfigDisplay(agent.llmConfig)}</p>
                      </CardContent>
                      <CardFooter className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" size="sm" onClick={() => handleOpenForm(agent)}>
                          <Edit2 className="mr-1 h-3 w-3" /> Editar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteAgent(agent.id)}>
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

        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAgent ? 'Editar Agente' : 'Crear Nuevo Agente'}</DialogTitle>
            <DialogDescription>
              {editingAgent ? 'Modifica los detalles de tu agente.' : 'Define un nuevo agente para tus grupos de trabajo.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            <ScrollArea className="max-h-[60vh] p-1 -mx-1 pr-4">
              <div className="space-y-4 px-1">
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

                <div className="space-y-2 rounded-md border p-4">
                    <Label className="text-base">Configuración LLM del Agente</Label>
                     <Select value={watchedLlmConfigType} onValueChange={(value) => setValue('llmConfigType', value as 'default' | 'custom')}>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tipo de configuración LLM" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="default">Usar Configuración Global de la Aplicación</SelectItem>
                            <SelectItem value="custom">Configuración Personalizada para este Agente</SelectItem>
                        </SelectContent>
                    </Select>

                    {watchedLlmConfigType === 'custom' && (
                        <div className="space-y-3 pt-3">
                            <div>
                                <Label htmlFor="customProviderId">Proveedor LLM (Personalizado)</Label>
                                <Select value={watch('customProviderId')} onValueChange={(value) => setValue('customProviderId', value as LLMProviderId)}>
                                    <SelectTrigger id="customProviderId">
                                        <SelectValue placeholder="Seleccionar proveedor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {LLM_PROVIDERS.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {errors.customProviderId && <p className="text-sm text-destructive mt-1">{errors.customProviderId.message}</p>}
                            </div>
                            {watch('customProviderId') && (
                                <>
                                    <div>
                                        <Label htmlFor="customModelName">Modelo (Personalizado)</Label>
                                        <Select value={watch('customModelName')} onValueChange={(value) => setValue('customModelName', value)}>
                                            <SelectTrigger id="customModelName">
                                                <SelectValue placeholder="Seleccionar modelo" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableCustomModels.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        {errors.customModelName && <p className="text-sm text-destructive mt-1">{errors.customModelName.message}</p>}
                                    </div>
                                    
                                    {(LLM_PROVIDERS.find(p=>p.id === watch('customProviderId'))?.requiresApiKey) && 
                                        <div>
                                            <Label htmlFor="customApiKey">Clave API (Personalizada, opcional)</Label>
                                            <Input id="customApiKey" type="password" {...register('customApiKey')} placeholder="Sobrescribir clave API global (si aplica)" />
                                        </div>
                                    }
                                    {(LLM_PROVIDERS.find(p=>p.id === watch('customProviderId'))?.id === 'lmstudio' || LLM_PROVIDERS.find(p=>p.id === watch('customProviderId'))?.id === 'ollama') &&
                                      <div>
                                          <Label htmlFor="customApiUrl">URL de API (Personalizada, opcional)</Label>
                                          <Input id="customApiUrl" type="url" {...register('customApiUrl')} placeholder="Ej: http://localhost:1234/v1" />
                                          {errors.customApiUrl && <p className="text-sm text-destructive mt-1">{errors.customApiUrl.message}</p>}
                                      </div>
                                    }
                                </>
                            )}
                        </div>
                    )}
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit">
                <Wand2 className="mr-2 h-4 w-4" />
                {editingAgent ? 'Guardar Cambios' : 'Crear Agente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </div>
    </Dialog>
  );
}

