'use client';

import { useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const settingsSchema = z.object({
  groqApiKey: z.string().min(1, 'La clave API de Groq es obligatoria.'),
  groqModelName: z.string().min(1, 'El nombre del modelo de Groq es obligatorio.'),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

// Modelos de Groq soportados - esta lista puede actualizarse según sea necesario
const groqModels = [
  "llama3-8b-8192",
  "llama3-70b-8192",
  "mixtral-8x7b-32768",
  "gemma-7b-it",
];

export function SettingsForm() {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      groqApiKey: '',
      groqModelName: '',
    },
  });

  useEffect(() => {
    const apiKey = localStorage.getItem('codealchemist_groq_api_key');
    const modelName = localStorage.getItem('codealchemist_groq_model_name');
    if (apiKey) setValue('groqApiKey', apiKey, { shouldDirty: false });
    if (modelName) setValue('groqModelName', modelName, { shouldDirty: false });
  }, [setValue]);
  
  const currentModel = watch('groqModelName');

  const onSubmit: SubmitHandler<SettingsFormData> = (data) => {
    localStorage.setItem('codealchemist_groq_api_key', data.groqApiKey);
    localStorage.setItem('codealchemist_groq_model_name', data.groqModelName);
    toast({
      title: 'Configuración Guardada',
      description: 'Tu clave API de Groq y el nombre del modelo han sido actualizados.',
    });
    reset(data, { keepValues: true, keepDirty: false }); // Restablecer el estado 'dirty' después de guardar
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
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={!isDirty} className="w-full md:w-auto">
            <Save className="mr-2 h-4 w-4" />
            Guardar Configuración
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
