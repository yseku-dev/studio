
// src/app/(app)/workgroups/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Workflow, Edit2, Trash2, Play, Users2, Lock } from 'lucide-react';
import type { WorkgroupConfig, AgentConfig } from '@/types/agent';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"; // AlertDialogTrigger is not needed here directly
import { WorkgroupExecutionModal } from '@/components/workgroup-execution-modal'; // Import the new modal
import { LOCALSTORAGE_WORKGROUPS_KEY, LOCALSTORAGE_AGENTS_KEY, ORCHESTRATOR_AGENT_NAME } from '@/config/agent-config'; // Use constants

// Default workgroup using default agent names (IDs will be resolved dynamically)
const defaultWorkgroup: Omit<WorkgroupConfig, 'id' | 'agentIds'> & { agentNames: string[] } = {
  name: "EquipoDesarrolloSoftware",
  description: "Un equipo multidisciplinario capaz de abordar diversas tareas de desarrollo de software, gestionado por un Orquestador.",
  task: `Este grupo de trabajo simula un equipo de producción de software completo. Dada una descripción de proyecto o una necesidad funcional, el Orquestador coordinará a los agentes especializados (JefeDeProducto, ArquitectoSoftware, DesarrolladorSoftware, IngenieroPruebas, IngenieroDevOps, RepresentanteUsuario) para: 
1. Definir requisitos y alcance. 
2. Diseñar la arquitectura técnica. 
3. Implementar el código. 
4. Asegurar la calidad mediante pruebas. 
5. Preparar para el despliegue y gestionar la infraestructura si es necesario. 
6. Validar desde la perspectiva del usuario. 
El objetivo es entregar una solución funcional o un análisis detallado basado en la solicitud inicial.`,
  agentNames: [
    "JefeDeProducto",
    "ArquitectoSoftware",
    "DesarrolladorSoftware",
    "IngenieroPruebas",
    "IngenieroDevOps",
    "RepresentanteUsuario",
  ],
};


const workgroupSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres.'),
  task: z.string().min(20, 'La tarea debe tener al menos 20 caracteres.'),
  agentIds: z.array(z.string()).min(1, 'Debes seleccionar al menos un agente (además del Orquestador).'),
});

type WorkgroupFormData = z.infer<typeof workgroupSchema>;



export default function WorkgroupsPage() {
  const [workgroups, setWorkgroups] = useState<WorkgroupConfig[]>([]);
  const [availableAgents, setAvailableAgents] = useState<AgentConfig[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWorkgroup, setEditingWorkgroup] = useState<WorkgroupConfig | null>(null);
  const [executingWorkgroup, setExecutingWorkgroup] = useState<WorkgroupConfig | null>(null); 
  const [isExecutionModalOpen, setIsExecutionModalOpen] = useState(false); 
  const { toast } = useToast();

  const orchestratorAgent = useMemo(() =>
    availableAgents.find(a => a.name === ORCHESTRATOR_AGENT_NAME),
    [availableAgents]
  );

  const selectableAgents = useMemo(() =>
    availableAgents.filter(a => a.name !== ORCHESTRATOR_AGENT_NAME),
    [availableAgents]
  );

  const { control, register, handleSubmit, reset, setValue, formState: { errors } } = useForm<WorkgroupFormData>({
    resolver: zodResolver(workgroupSchema),
    defaultValues: { agentIds: [] }
  });

  useEffect(() => {
    const storedAgents = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
    let agentsList: AgentConfig[] = [];
    if (storedAgents) {
      try {
        agentsList = JSON.parse(storedAgents);
        setAvailableAgents(agentsList);
      } catch (e) {
        console.error("Error parsing stored agents:", e);
        setAvailableAgents([]);
      }
    }

    const storedWorkgroups = localStorage.getItem(LOCALSTORAGE_WORKGROUPS_KEY);
    if (storedWorkgroups) {
       try {
           setWorkgroups(JSON.parse(storedWorkgroups));
       } catch(e) {
            console.error("Error parsing stored workgroups:", e);
            localStorage.removeItem(LOCALSTORAGE_WORKGROUPS_KEY); 
            setWorkgroups([]);
       }
    } else if (agentsList.length > 0) {
      const defaultAgentIds = defaultWorkgroup.agentNames
        .map(name => agentsList.find(a => a.name === name)?.id)
        .filter((id): id is string => !!id);

      const orchestrator = agentsList.find(a => a.name === ORCHESTRATOR_AGENT_NAME);

      if (orchestrator && defaultAgentIds.length > 0) { 
        const initialWorkgroup: WorkgroupConfig = {
          id: crypto.randomUUID(),
          name: defaultWorkgroup.name,
          description: defaultWorkgroup.description,
          task: defaultWorkgroup.task,
          agentIds: [orchestrator.id, ...defaultAgentIds], 
        };
        setWorkgroups([initialWorkgroup]);
        localStorage.setItem(LOCALSTORAGE_WORKGROUPS_KEY, JSON.stringify([initialWorkgroup]));
      }
    }
  }, []);

  const handleOpenForm = (workgroup?: WorkgroupConfig) => {
     if (!orchestratorAgent) {
      toast({
        title: 'Error',
        description: `No se encontró el agente ${ORCHESTRATOR_AGENT_NAME} necesario para crear grupos.`,
        variant: 'destructive',
      });
      return;
    }
    if (workgroup) {
      setEditingWorkgroup(workgroup);
      const selectableAgentIds = workgroup.agentIds.filter(id => id !== orchestratorAgent?.id);
      reset({
        name: workgroup.name,
        description: workgroup.description,
        task: workgroup.task,
        agentIds: selectableAgentIds,
      });
    } else {
      setEditingWorkgroup(null);
      reset({ name: '', description: '', task: defaultWorkgroup.task, agentIds: [] }); // Set default task for new groups
    }
    setIsFormOpen(true);
  };

  const onSubmit: SubmitHandler<WorkgroupFormData> = (data) => {
     if (!orchestratorAgent) {
      toast({
        title: 'Error Interno',
        description: `No se encontró el agente ${ORCHESTRATOR_AGENT_NAME}. No se puede guardar el grupo.`,
        variant: 'destructive',
      });
      return;
    }

    const finalAgentIds = Array.from(new Set([orchestratorAgent.id, ...data.agentIds]));

    const newWorkgroup: WorkgroupConfig = {
      id: editingWorkgroup?.id || crypto.randomUUID(),
      name: data.name,
      description: data.description,
      task: data.task,
      agentIds: finalAgentIds,
    };

    let updatedWorkgroups;
    if (editingWorkgroup) {
      updatedWorkgroups = workgroups.map(wg => wg.id === editingWorkgroup.id ? newWorkgroup : wg);
    } else {
      updatedWorkgroups = [...workgroups, newWorkgroup];
    }
    setWorkgroups(updatedWorkgroups);
    localStorage.setItem(LOCALSTORAGE_WORKGROUPS_KEY, JSON.stringify(updatedWorkgroups));
    toast({ title: `Grupo de Trabajo ${editingWorkgroup ? 'Actualizado' : 'Creado'}`, description: `El grupo "${newWorkgroup.name}" ha sido ${editingWorkgroup ? 'actualizado' : 'creado'} exitosamente.` });
    setIsFormOpen(false);
  };

  const handleDeleteWorkgroup = (workgroupId: string) => {
    const updatedWorkgroups = workgroups.filter(wg => wg.id !== workgroupId);
    setWorkgroups(updatedWorkgroups);
    localStorage.setItem(LOCALSTORAGE_WORKGROUPS_KEY, JSON.stringify(updatedWorkgroups));
    toast({ title: 'Grupo de Trabajo Eliminado', description: 'El grupo ha sido eliminado.' });
  };

  const handleRunWorkgroup = (workgroup: WorkgroupConfig) => {
    if (!orchestratorAgent || !workgroup.agentIds.includes(orchestratorAgent.id)) {
      toast({
        title: 'Error de Configuración',
        description: `El grupo "${workgroup.name}" no incluye al agente Orquestador (${ORCHESTRATOR_AGENT_NAME}) o este no existe.`,
        variant: 'destructive',
      });
      return;
    }
    setExecutingWorkgroup(workgroup);
    setIsExecutionModalOpen(true);
    toast({
      title: 'Iniciando Grupo de Trabajo',
      description: `Abriendo vista de ejecución para "${workgroup.name}".`,
    });
  };

  const getAgentNameById = (agentId: string): string => {
    return availableAgents.find(a => a.id === agentId)?.name || 'Agente Desconocido';
  }

  const handleDialogVisibilityChange = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setEditingWorkgroup(null);
      reset({ name: '', description: '', task: defaultWorkgroup.task, agentIds: [] });
    }
  };

  return (
    <>
    <Dialog open={isFormOpen} onOpenChange={handleDialogVisibilityChange}>
      <div className="space-y-6">
        <Card className="shadow-lg w-full max-w-6xl mx-auto"> 
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Workflow className="h-6 w-6 text-primary" />
                Gestión de Grupos de Trabajo IA
              </CardTitle>
              <CardDescription>
                Crea, configura y ejecuta grupos de trabajo con tus agentes de IA. El Orquestador se incluye automáticamente.
              </CardDescription>
            </div>
             <DialogTrigger asChild>
               <Button onClick={() => handleOpenForm()} disabled={availableAgents.length <= 1 || !orchestratorAgent}> 
                <PlusCircle className="mr-2 h-4 w-4" /> Crear Grupo
              </Button>
            </DialogTrigger>
          </CardHeader>
          <CardContent>
             {availableAgents.length <= 1 && !orchestratorAgent && ( 
              <p className="text-destructive text-center py-4">
                Primero debes crear agentes (además del Orquestador) en la página de <a href="/agents" className="underline hover:text-destructive/80">Gestión de Agentes</a> para poder crear grupos de trabajo.
              </p>
            )}
            {workgroups.length === 0 && availableAgents.length > 1 && orchestratorAgent && (
              <p className="text-muted-foreground text-center py-8">No hay grupos de trabajo creados. ¡Empieza creando uno!</p>
            )}
            {workgroups.length > 0 && (
               <ScrollArea className="h-[calc(100vh-20rem)]"> 
                 <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"> 
                  {workgroups.map(wg => (
                    <Card key={wg.id} className="flex flex-col">
                      <CardHeader>
                        <CardTitle className="text-lg">{wg.name}</CardTitle>
                        <CardDescription className="text-xs line-clamp-2">{wg.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow space-y-3">
                        <div>
                          <h4 className="text-sm font-semibold mb-1 text-foreground">Tarea Principal:</h4>
                          <p className="text-xs text-muted-foreground line-clamp-3">{wg.task}</p>
                        </div>
                        <div>
                           <h4 className="text-sm font-semibold mb-1 text-foreground">Agentes ({wg.agentIds.length}):</h4>
                           <div className="flex flex-wrap gap-1">
                             {wg.agentIds.map(id => {
                                const agentName = getAgentNameById(id);
                                const isOrchestrator = agentName === ORCHESTRATOR_AGENT_NAME;
                                return (
                                    <Badge key={id} variant={isOrchestrator ? "default" : "secondary"} className={isOrchestrator ? "bg-accent text-accent-foreground" : ""}>
                                        {isOrchestrator && <Lock className="mr-1 h-3 w-3"/>}
                                        {agentName}
                                    </Badge>
                                );
                             })}
                           </div>
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-end gap-2 border-t pt-4">
                         <Button variant="default" size="sm" onClick={() => handleRunWorkgroup(wg)}>
                          <Play className="mr-1 h-3 w-3" /> Ejecutar
                        </Button>
                         <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => handleOpenForm(wg)}>
                              <Edit2 className="mr-1 h-3 w-3" /> Editar
                            </Button>
                         </DialogTrigger>
                         <AlertDialog>
                           <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="mr-1 h-3 w-3" /> Eliminar
                            </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar Grupo de Trabajo?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    ¿Estás seguro de que quieres eliminar el grupo "{wg.name}"? Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteWorkgroup(wg.id)} className="bg-destructive hover:bg-destructive/90">
                                    Eliminar
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
        {/* Agent Group Creation/Editing Form Dialog, wrapped in Dialog component */}
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingWorkgroup ? 'Editar Grupo de Trabajo' : 'Crear Nuevo Grupo de Trabajo'}</DialogTitle>
            <DialogDescription>
              {editingWorkgroup ? 'Modifica los detalles de tu grupo.' : 'Define un nuevo grupo y asígnale agentes y una tarea.'} El agente Orquestador se añadirá automáticamente.
            </DialogDescription>
          </DialogHeader>
          <form id="workgroup-form-id" onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            <ScrollArea className="max-h-[60vh] p-1 -mx-1 pr-4">
              <div className="space-y-4 px-1">
                <div>
                  <Label htmlFor="wg-name">Nombre del Grupo</Label>
                  <Input id="wg-name" {...register('name')} placeholder="Ej: Equipo de Redacción, Grupo de Análisis de Datos" />
                  {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <Label htmlFor="wg-description">Descripción Corta</Label>
                  <Input id="wg-description" {...register('description')} placeholder="Ej: Responsable de generar contenido para el blog" />
                  {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
                </div>
                <div>
                  <Label htmlFor="wg-task">Tarea Principal del Grupo</Label>
                  <Textarea id="wg-task" {...register('task')} rows={6} placeholder="Ej: Escribir un artículo de 1000 palabras sobre..." />
                  {errors.task && <p className="text-sm text-destructive mt-1">{errors.task.message}</p>}
                </div>
                <div>
                  <Label className="mb-2 block">Agentes en el Grupo (Selecciona al menos uno)</Label>
                  {selectableAgents.length === 0 ? (
                     <p className="text-sm text-muted-foreground">No hay agentes disponibles para seleccionar (además del Orquestrador). Por favor, crea más agentes.</p>
                  ) : (
                    <Controller
                        control={control}
                        name="agentIds"
                        render={({ field }) => (
                            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                             {orchestratorAgent && (
                                <div className="flex items-center space-x-2 opacity-70">
                                     <Checkbox id={`agent-${orchestratorAgent.id}-display`} checked={true} disabled={true} />
                                    <label htmlFor={`agent-${orchestratorAgent.id}-display`} className="text-sm font-medium leading-none flex items-center gap-1 text-muted-foreground">
                                        <Lock className="h-3 w-3"/>
                                        {orchestratorAgent.name} (Automático)
                                    </label>
                                </div>
                             )}
                             {selectableAgents.map(agent => (
                                <div key={agent.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`agent-select-${agent.id}`}
                                    checked={field.value?.includes(agent.id)}
                                    onCheckedChange={(checked) => {
                                    const currentAgentIds = field.value || [];
                                    return checked
                                        ? field.onChange([...currentAgentIds, agent.id])
                                        : field.onChange(currentAgentIds.filter(id => id !== agent.id));
                                    }}
                                />
                                <label htmlFor={`agent-select-${agent.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    {agent.name} <span className="text-xs text-muted-foreground">({agent.description.substring(0,30)}...)</span>
                                </label>
                                </div>
                            ))}
                            </div>
                        )}
                        />
                  )}
                  {errors.agentIds && <p className="text-sm text-destructive mt-1">{errors.agentIds.message}</p>}
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit" form="workgroup-form-id" disabled={selectableAgents.length === 0 && !editingWorkgroup}>
                <Users2 className="mr-2 h-4 w-4" />
                {editingWorkgroup ? 'Guardar Cambios' : 'Crear Grupo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </div>
    </Dialog>

      {executingWorkgroup && (
        <WorkgroupExecutionModal
          isOpen={isExecutionModalOpen}
          onClose={() => {
            setIsExecutionModalOpen(false);
            setExecutingWorkgroup(null);
          }}
          workgroup={executingWorkgroup}
          agents={availableAgents}
          workgroups={workgroups} 
        />
      )}
    </>
  );
}
