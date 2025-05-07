'use client';

import { useEffect, useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Save, Settings as SettingsIcon, Zap, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { handleTestGroqConnection } from '@/app/(app)/settings/actions';

const settingsSchema = z.object({
  groqApiKey: z.string().min(1, 'La clave API de Groq es obligatoria.'),
  groqModelName: z.string().min(1, 'El nombre del modelo de Groq es obligatorio.'),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

const groqModels = [
  "llama3-8b-8192",
  "llama3-70b-8192",
  "mixtral-8x7b-32768",
  "gemma-7b-it",
  "gemma2-9b-it", // Added a newer model
  "llama-3.1-8b-instant",
  "llama-3.1-70b-versatile",
];

export function SettingsForm() {
  const { toast } = useToast();
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
    reset,
    getValues, // Added to get current form values for testing
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      groqApiKey: '',
      groqModelName: groqModels[0], // Default to the first model in the list
    },
  });

  useEffect(() => {
    const apiKey = localStorage.getItem('codealchemist_groq_api_key');
    const modelName = localStorage.getItem('codealchemist_groq_model_name');
    if (apiKey) setValue('groqApiKey', apiKey, { shouldDirty: false });
    if (modelName && groqModels.includes(modelName)) {
      setValue('groqModelName', modelName, { shouldDirty: false });
    } else if (modelName) {
      // If stored model is not in the list, default to first and notify user
      setValue('groqModelName', groqModels[0], { shouldDirty: true });
       toast({
        title: 'Modelo no Encontrado',
        description: `El modelo guardado "${modelName}" ya no está en la lista. Se ha seleccionado "${groqModels[0]}" por defecto. Por favor, guarda la configuración si es correcto.`,
        variant: 'default',
        duration: 7000,
      });
    }
  }, [setValue, toast]);
  
  const currentModel = watch('groqModelName');

  const onSubmit: SubmitHandler<SettingsFormData> = (data) => {
    localStorage.setItem('codealchemist_groq_api_key', data.groqApiKey);
    localStorage.setItem('codealchemist_groq_model_name', data.groqModelName);
    toast({
      title: 'Configuración Guardada',
      description: 'Tu clave API de Groq y el nombre del modelo han sido actualizados.',
    });
    reset(data, { keepValues: true, keepDirty: false }); 
  };

  const onTestConnection = async () => {
    const { groqApiKey, groqModelName } = getValues();
    if (!groqApiKey || !groqModelName) {
      toast({
        title: 'Campos incompletos',
        description: 'Por favor, introduce la Clave API de Groq y selecciona un Modelo antes de probar la conexión.',
        variant: 'destructive',
      });
      return;
    }
    setIsTestingConnection(true);
    const result = await handleTestGroqConnection(groqApiKey, groqModelName);
    setIsTestingConnection(false);

    if (result.success) {
      toast({
        title: 'Conexión Exitosa',
        description: `Conectado correctamente a Groq con el modelo ${groqModelName}. Respuesta: ${result.data || 'OK'}`,
        variant: 'default',
      });
    } else {
      toast({
        title: 'Error de Conexión',
        description: result.message,
        variant: 'destructive',
      });
    }
  };


  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-primary" />
          Configuración de la Aplicación
        </CardTitle>
        <CardDescription>
          Configura tus claves API y selecciona tu modelo de IA preferido. Estos ajustes se guardan en el almacenamiento local de tu navegador.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="groqApiKey">Clave API de Groq</Label>
            <Input
              id="groqApiKey"
              type="password"
              {...register('groqApiKey')}
              placeholder="Introduce tu clave API de Groq"
              className="bg-card"
            />
            {errors.groqApiKey && (
              <p className="text-sm text-destructive">{errors.groqApiKey.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="groqModelName">Nombre del Modelo de Groq</Label>
            <Select
              value={currentModel}
              onValueChange={(value) => setValue('groqModelName', value, { shouldDirty: true })}
            >
              <SelectTrigger id="groqModelName" className="w-full bg-card">
                <SelectValue placeholder="Selecciona un modelo de Groq" />
              </SelectTrigger>
              <SelectContent>
                {groqModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.groqModelName && (
              <p className="text-sm text-destructive">{errors.groqModelName.message}</p>
            )}
          </div>
          <Button 
            type="button" 
            variant="outline" 
            onClick={onTestConnection} 
            disabled={isTestingConnection}
            className="w-full md:w-auto"
          >
            {isTestingConnection ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            Probar Conexión
          </Button>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={!isDirty && !watch('groqApiKey') && !watch('groqModelName')} className="w-full md:w-auto">
            <Save className="mr-2 h-4 w-4" />
            Guardar Configuración
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
