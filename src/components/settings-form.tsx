
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
import { Save, Settings as SettingsIcon, Zap, Loader2, GitFork, CheckCircle, XCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { handleTestGroqConnection } from '@/app/(app)/settings/actions';
import { handleTestGitConnection } from '@/app/(app)/settings/actions'; // Import the new action
import { Separator } from '@/components/ui/separator';

const settingsSchema = z.object({
  groqApiKey: z.string().min(1, 'La clave API de Groq es obligatoria.'),
  groqModelName: z.string().min(1, 'El nombre del modelo de Groq es obligatorio.'),
  gitRepositoryUrl: z.string().url({ message: "Por favor, introduce una URL válida para el repositorio Git." }).optional().or(z.literal('')),
  gitUsername: z.string().optional(),
  gitEmail: z.string().email({ message: "Por favor, introduce un email válido." }).optional().or(z.literal('')),
  gitPat: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

// Updated model list based on provided limits, ordered by TPM and then other factors
const groqModels = [
  // 70000 TPM
  "compound-beta",
  "compound-beta-mini",
  // 30000 TPM
  "meta-llama/llama-4-scout-17b-16e-instruct",
  // 15000 TPM
  "gemma2-9b-it",
  "llama-guard-3-8b", // Note: Guard model, specific purpose
  // 12000 TPM
  "llama-3.1-70b-versatile",
  // 6000 TPM (Ordered by perceived capability/size then alphabetically)
  "deepseek-r1-distill-llama-70b",
  "llama3-70b-8192",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "mistral-saba-24b",
  "qwen-qwq-32b",
  "allam-2-7b",
  "llama-3.1-8b-instant",
  "llama3-8b-8192",
];


export function SettingsForm() {
  const { toast } = useToast();
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isTestingGitConnection, setIsTestingGitConnection] = useState(false); // New state for Git test
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
    reset,
    getValues,
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      groqApiKey: '',
      groqModelName: groqModels[0], // Default to the first model in the new list
      gitRepositoryUrl: '',
      gitUsername: '',
      gitEmail: '',
      gitPat: '',
    },
  });

  useEffect(() => {
    const apiKey = localStorage.getItem('codealchemist_groq_api_key');
    const modelName = localStorage.getItem('codealchemist_groq_model_name');
    if (apiKey) setValue('groqApiKey', apiKey, { shouldDirty: false });
    
    if (modelName && groqModels.includes(modelName)) {
      setValue('groqModelName', modelName, { shouldDirty: false });
    } else if (modelName) { // Model was saved but not in the new list
      setValue('groqModelName', groqModels[0], { shouldDirty: true }); // Default to new first model
       toast({
        title: 'Modelo no Encontrado o Actualizado',
        description: `El modelo guardado "${modelName}" no está en la lista actualizada o ha cambiado. Se ha seleccionado "${groqModels[0]}" por defecto. Por favor, verifica y guarda la configuración.`,
        variant: 'default',
        duration: 10000,
      });
    } else { // No model saved, use default
        setValue('groqModelName', groqModels[0], { shouldDirty: false });
    }


    const gitRepoUrl = localStorage.getItem('codealchemist_git_repository_url');
    const gitUsername = localStorage.getItem('codealchemist_git_username');
    const gitEmail = localStorage.getItem('codealchemist_git_email');
    const gitPat = localStorage.getItem('codealchemist_git_pat');

    if (gitRepoUrl) setValue('gitRepositoryUrl', gitRepoUrl, { shouldDirty: false });
    if (gitUsername) setValue('gitUsername', gitUsername, { shouldDirty: false });
    if (gitEmail) setValue('gitEmail', gitEmail, { shouldDirty: false });
    if (gitPat) setValue('gitPat', gitPat, { shouldDirty: false });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setValue, toast]);
  
  const currentModel = watch('groqModelName');

  const onSubmit: SubmitHandler<SettingsFormData> = (data) => {
    localStorage.setItem('codealchemist_groq_api_key', data.groqApiKey);
    localStorage.setItem('codealchemist_groq_model_name', data.groqModelName);
    
    if (data.gitRepositoryUrl) localStorage.setItem('codealchemist_git_repository_url', data.gitRepositoryUrl);
    else localStorage.removeItem('codealchemist_git_repository_url');
    
    if (data.gitUsername) localStorage.setItem('codealchemist_git_username', data.gitUsername);
    else localStorage.removeItem('codealchemist_git_username');

    if (data.gitEmail) localStorage.setItem('codealchemist_git_email', data.gitEmail);
    else localStorage.removeItem('codealchemist_git_email');

    if (data.gitPat) localStorage.setItem('codealchemist_git_pat', data.gitPat);
    else localStorage.removeItem('codealchemist_git_pat');
    
    toast({
      title: 'Configuración Guardada',
      description: 'Tus configuraciones han sido actualizadas.',
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
        title: 'Conexión Groq Exitosa',
        description: `Conectado correctamente a Groq con el modelo ${groqModelName}. Respuesta: ${result.data || 'OK'}`,
        action: <CheckCircle className="text-green-500" />,
      });
    } else {
      toast({
        title: 'Error de Conexión Groq',
        description: result.message,
        variant: 'destructive',
        action: <XCircle className="text-white" />,
      });
    }
  };

  const onTestGitConnection = async () => {
    const { gitRepositoryUrl, gitUsername, gitPat } = getValues();
     if (!gitRepositoryUrl || !gitUsername || !gitPat) {
      toast({
        title: 'Campos Git incompletos',
        description: 'Por favor, introduce la URL del Repositorio, Nombre de Usuario Git y Token de Acceso Personal (PAT) antes de probar la conexión Git.',
        variant: 'destructive',
      });
      return;
    }
    setIsTestingGitConnection(true);
    const result = await handleTestGitConnection({
        repoUrl: gitRepositoryUrl,
        username: gitUsername,
        pat: gitPat,
    });
    setIsTestingGitConnection(false);

    if (result.success) {
      toast({
        title: 'Conexión Git Exitosa',
        description: result.message,
        action: <CheckCircle className="text-green-500" />,
      });
    } else {
      toast({
        title: 'Error de Conexión Git',
        description: result.message,
        variant: 'destructive',
        duration: 7000,
        action: <XCircle className="text-white" />,
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
          Configura tus claves API, modelo de IA preferido y detalles de Git. Estos ajustes se guardan en el almacenamiento local de tu navegador.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-primary mb-2">Configuración de Groq API</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="groqApiKey" className="text-foreground">Clave API de Groq</Label>
                <Input
                  id="groqApiKey"
                  type="password"
                  {...register('groqApiKey')}
                  placeholder="Introduce tu clave API de Groq"
                  className="bg-card text-foreground"
                />
                {errors.groqApiKey && (
                  <p className="text-sm text-destructive">{errors.groqApiKey.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="groqModelName" className="text-foreground">Nombre del Modelo de Groq</Label>
                <Select
                  value={currentModel || groqModels[0]} // Fallback to first model if currentModel is somehow undefined
                  onValueChange={(value) => setValue('groqModelName', value, { shouldDirty: true })}
                >
                  <SelectTrigger id="groqModelName" className="w-full bg-card text-foreground">
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
                 <p className="text-xs text-muted-foreground">
                    Los modelos están ordenados aproximadamente por su límite de Tokens Por Minuto (TPM) y capacidad. 
                    Modelos con TPM más alto pueden permitir un procesamiento más rápido de múltiples fragmentos.
                </p>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onTestConnection} 
                disabled={isTestingConnection}
                className="w-full md:w-auto text-foreground"
              >
                {isTestingConnection ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                Probar Conexión Groq
              </Button>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-lg font-medium text-primary mb-2 flex items-center gap-2">
              <GitFork className="h-5 w-5" />
              Configuración de Git (Opcional)
            </h3>
            <CardDescription className="mb-3 text-muted-foreground">
              Configura los detalles de tu repositorio Git para subir el código fuente desde la sección AutoUpdate.
              El Token de Acceso Personal (PAT) se usa para la autenticación.
            </CardDescription>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gitRepositoryUrl" className="text-foreground">URL del Repositorio Git</Label>
                <Input
                  id="gitRepositoryUrl"
                  type="url"
                  {...register('gitRepositoryUrl')}
                  placeholder="https://github.com/tu-usuario/tu-repositorio.git"
                  className="bg-card text-foreground"
                />
                {errors.gitRepositoryUrl && (
                  <p className="text-sm text-destructive">{errors.gitRepositoryUrl.message}</p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gitUsername" className="text-foreground">Nombre de Usuario Git</Label>
                  <Input
                    id="gitUsername"
                    {...register('gitUsername')}
                    placeholder="Tu nombre de usuario de Git"
                    className="bg-card text-foreground"
                  />
                  {errors.gitUsername && (
                    <p className="text-sm text-destructive">{errors.gitUsername.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gitEmail" className="text-foreground">Email de Git</Label>
                  <Input
                    id="gitEmail"
                    type="email"
                    {...register('gitEmail')}
                    placeholder="tu-email@ejemplo.com"
                    className="bg-card text-foreground"
                  />
                  {errors.gitEmail && (
                    <p className="text-sm text-destructive">{errors.gitEmail.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gitPat" className="text-foreground">Token de Acceso Personal (PAT) de Git</Label>
                <Input
                  id="gitPat"
                  type="password"
                  {...register('gitPat')}
                  placeholder="Introduce tu PAT de Git"
                  className="bg-card text-foreground"
                />
                {errors.gitPat && (
                  <p className="text-sm text-destructive">{errors.gitPat.message}</p>
                )}
                 <p className="text-xs text-muted-foreground">
                    El PAT se utiliza para autenticar las subidas a tu repositorio. Asegúrate de que tiene los permisos necesarios (ej. `repo` o `public_repo`).
                </p>
              </div>
               <Button 
                type="button" 
                variant="outline" 
                onClick={onTestGitConnection} 
                disabled={isTestingGitConnection || !watch('gitRepositoryUrl') || !watch('gitUsername') || !watch('gitPat')}
                className="w-full md:w-auto text-foreground"
              >
                {isTestingGitConnection ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <GitFork className="mr-2 h-4 w-4" />
                )}
                Probar Conexión Git
              </Button>
            </div>
          </div>

        </CardContent>
        <CardFooter>
          <Button 
            type="submit" 
            disabled={!isDirty && !watch('groqApiKey') && !watch('groqModelName') && !watch('gitRepositoryUrl') && !watch('gitUsername') && !watch('gitEmail') && !watch('gitPat')} 
            className="w-full md:w-auto"
          >
            <Save className="mr-2 h-4 w-4" />
            Guardar Configuración
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

    
