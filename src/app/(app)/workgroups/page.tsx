// src/app/(app)/workgroups/page.tsx
'use client';

import { useState, useEffect } from 'react';
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
import { PlusCircle, Workflow, Edit2, Trash2, Play, Users2 } from 'lucide-react';
import type { WorkgroupConfig, AgentConfig } from '@/types/agent';
import { Badge } from '@/components/ui/badge';

const workgroupSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres.'),
  task: z.string().min(20, 'La tarea debe tener al menos 20 caracteres.'),
  agentIds: z.array(z.string()).min(1, 'Debes seleccionar al menos un agente.'),
});

type WorkgroupFormData = z.infer<typeof workgroupSchema>;

const LOCALSTORAGE_WORKGROUPS_KEY = 'codealchemist_workgroups';
const LOCALSTORAGE_AGENTS_KEY = 'codealchemist_agents'; // To load available agents

// Default workgroup using default agent names (IDs will be resolved dynamically)
const defaultWorkgroup: Omit<WorkgroupConfig, 'id' | 'agentIds'> & { agentNames: string[] } = {
  name: "EquipoDesarrolloSoftware",
  description: "Un equipo multidisciplinario para desarrollar una aplicación de lista de tareas.",
  task: "Desarrollar una aplicación web de lista de tareas (To-Do List) simple pero funcional. La aplicación debe permitir a los usuarios crear, ver, editar y eliminar tareas. Debe tener una interfaz de usuario intuitiva y persistencia de datos (simulada en frontend con localStorage si no hay backend).",
  agentNames: ["JefeDeProducto", "ArquitectoSoftware", "DesarrolladorSoftware", "IngenieroPruebas", "IngenieroDevOps", "RepresentanteUsuario"],
};

export default function WorkgroupsPage() {
  const [workgroups, setWorkgroups] = useState<WorkgroupConfig[]>([]);
  const [availableAgents, setAvailableAgents] = useState<AgentConfig[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWorkgroup, setEditingWorkgroup] = useState<WorkgroupConfig | null>(null);
  const { toast } = useToast();

  const { control, register, handleSubmit, reset, setValue, formState: { errors } } = useForm<WorkgroupFormData>({
    resolver: zodResolver(workgroupSchema),
    defaultValues: { agentIds: [] }
  });

  useEffect(() => {
    const storedAgents = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
    if (storedAgents) {
      setAvailableAgents(JSON.parse(storedAgents));
    }

    const storedWorkgroups = localStorage.getItem(LOCALSTORAGE_WORKGROUPS_KEY);
    if (storedWorkgroups) {
      setWorkgroups(JSON.parse(storedWorkgroups));
    } else if (storedAgents) {
      // Pre-populate with default workgroup if agents exist and no workgroups are stored
      const agentsList: AgentConfig[] = JSON.parse(storedAgents);
      const defaultAgentIds = defaultWorkgroup.agentNames
        .map(name => agentsList.find(a => a.name === name)?.id)
        .filter((id): id is string => !!id);
      
      if (defaultAgentIds.length === defaultWorkgroup.agentNames.length) { // Ensure all default agents were found
        const initialWorkgroup: WorkgroupConfig = {
          id: crypto.randomUUID(),
          name: defaultWorkgroup.name,
          description: defaultWorkgroup.description,
          task: defaultWorkgroup.task,
          agentIds: defaultAgentIds,
        };
        setWorkgroups([initialWorkgroup]);
        localStorage.setItem(LOCALSTORAGE_WORKGROUPS_KEY, JSON.stringify([initialWorkgroup]));
      }
    }
  }, []);

  const handleOpenForm = (workgroup?: WorkgroupConfig) => {
    if (workgroup) {
      setEditingWorkgroup(workgroup);
      reset({
        name: workgroup.name,
        description: workgroup.description,
        task: workgroup.task,
        agentIds: workgroup.agentIds,
      });
    } else {
      setEditingWorkgroup(null);
      reset({ name: '', description: '', task: '', agentIds: [] });
    }
    setIsFormOpen(true);
  };

  const onSubmit: SubmitHandler<WorkgroupFormData> = (data) => {
    const newWorkgroup: WorkgroupConfig = {
      id: editingWorkgroup?.id || crypto.randomUUID(),
      ...data,
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
    // Placeholder for running the workgroup (actual AutoGen execution would be complex)
    toast({
      title: 'Iniciando Grupo de Trabajo (Simulado)',
      description: `El grupo "${workgroup.name}" comenzaría a ejecutar su tarea: "${workgroup.task.substring(0, 50)}..."`,
    });
    console.log("Ejecutando grupo de trabajo (simulado):", workgroup);
    // Here you would typically trigger a backend process or a complex client-side orchestration.
  };
  
  const getAgentNameById = (agentId: string): string => {
    return availableAgents.find(a => a.id === agentId)?.name || 'Agente Desconocido';
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Workflow className="h-6 w-6 text-primary" />
              Gestión de Grupos de Trabajo IA
            </CardTitle>
            <CardDescription>
              Crea, configura y ejecuta grupos de trabajo con tus agentes de IA.
            </CardDescription>
          </div>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenForm()} disabled={availableAgents.length === 0}>
              <PlusCircle className="mr-2 h-4 w-4" /> Crear Grupo
            </Button>
          </DialogTrigger>
        </CardHeader>
        <CardContent>
          {availableAgents.length === 0 && (
            <p className="text-destructive text-center py-4">
              Primero debes crear agentes en la página de <a href="/agents" className="underline hover:text-destructive/80">Gestión de Agentes</a> para poder crear grupos de trabajo.
            </p>
          )}
          {workgroups.length === 0 && availableAgents.length > 0 && (
            <p className="text-muted-foreground text-center py-8">No hay grupos de trabajo creados. ¡Empieza creando uno!</p>
          )}
          {workgroups.length > 0 && (
            <ScrollArea className="h-[calc(100vh-20rem)]">
              <div className="grid gap-4 md:grid-cols-2">
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
                          {wg.agentIds.map(id => <Badge key={id} variant="secondary">{getAgentNameById(id)}</Badge>)}
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2 border-t pt-4">
                       <Button variant="default" size="sm" onClick={() => handleRunWorkgroup(wg)}>
                        <Play className="mr-1 h-3 w-3" /> Ejecutar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleOpenForm(wg)}>
                        <Edit2 className="mr-1 h-3 w-3" /> Editar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteWorkgroup(wg.id)}>
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

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingWorkgroup ? 'Editar Grupo de Trabajo' : 'Crear Nuevo Grupo de Trabajo'}</DialogTitle>
            <DialogDescription>
              {editingWorkgroup ? 'Modifica los detalles de tu grupo.' : 'Define un nuevo grupo y asígnale agentes y una tarea.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
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
                  <Textarea id="wg-task" {...register('task')} rows={4} placeholder="Ej: Escribir un artículo de 1000 palabras sobre..." />
                  {errors.task && <p className="text-sm text-destructive mt-1">{errors.task.message}</p>}
                </div>
                <div>
                  <Label className="mb-2 block">Agentes en el Grupo</Label>
                  {availableAgents.length === 0 ? (
                     <p className="text-sm text-muted-foreground">No hay agentes disponibles. Por favor, crea agentes primero.</p>
                  ) : (
                    <Controller
                        control={control}
                        name="agentIds"
                        render={({ field }) => (
                            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                            {availableAgents.map(agent => (
                                <div key={agent.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`agent-${agent.id}`}
                                    checked={field.value?.includes(agent.id)}
                                    onCheckedChange={(checked) => {
                                    const currentAgentIds = field.value || [];
                                    return checked
                                        ? field.onChange([...currentAgentIds, agent.id])
                                        : field.onChange(currentAgentIds.filter(id => id !== agent.id));
                                    }}
                                />
                                <label htmlFor={`agent-${agent.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
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
              <Button type="submit" disabled={availableAgents.length === 0}>
                <Users2 className="mr-2 h-4 w-4" />
                {editingWorkgroup ? 'Guardar Cambios' : 'Crear Grupo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

