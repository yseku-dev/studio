
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
import { handleTestGitConnection } from '@/app/(app)/settings/actions'; 
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

// Original list of models
const initialGroqModelsList = [
  "compound-beta",
  "compound-beta-mini",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "gemma2-9b-it",
  "llama-guard-3-8b",
  "llama-3.1-70b-versatile", 
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
  const [isTestingGitConnection, setIsTestingGitConnection] = useState(false);
  
  const [validatedGroqModels, setValidatedGroqModels] = useState<string[]>([]);
  const [isTestingAllModels, setIsTestingAllModels] = useState(false);

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
      groqModelName: initialGroqModelsList[0], 
      gitRepositoryUrl: '',
      gitUsername: '',
      gitEmail: '',
      gitPat: '',
    },
  });
  
  const currentModel = watch('groqModelName');
  const currentApiKey = watch('groqApiKey');

  // Effect to load settings from localStorage
  useEffect(() => {
    const apiKeyFromStorage = localStorage.getItem('codealchemist_groq_api_key');
    const modelNameFromStorage = localStorage.getItem('codealchemist_groq_model_name');
    
    if (apiKeyFromStorage) setValue('groqApiKey', apiKeyFromStorage, { shouldDirty: false });
    
    if (modelNameFromStorage) {
      setValue('groqModelName', modelNameFromStorage, { shouldDirty: false });
    } else {
      setValue('groqModelName', initialGroqModelsList[0], { shouldDirty: false });
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
  }, [setValue]); 
  
  // Effect to test all Groq models when API key is available
  useEffect(() => {
    const testAndFilterModels = async (apiKeyToTest: string) => {
      if (!apiKeyToTest) {
        setValidatedGroqModels(initialGroqModelsList); // Use full list if no key
        return;
      }

      setIsTestingAllModels(true);
      toast({
        title: "Validando Modelos Groq...",
        description: "Probando conexión con todos los modelos. Esto puede tardar.",
        duration: 7000,
      });

      const validModels: string[] = [];
      for (const model of initialGroqModelsList) {
        // Adding a small delay to avoid overwhelming the API, though TPM is the main concern for Groq.
        await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay
        const result = await handleTestGroqConnection(apiKeyToTest, model);
        if (result.success) {
          validModels.push(model);
        } else {
          console.warn(`Modelo ${model} falló la prueba de conexión: ${result.message}`);
        }
      }

      setValidatedGroqModels(validModels);
      setIsTestingAllModels(false);

      const currentFormModel = getValues('groqModelName');
      if (validModels.length > 0) {
        toast({
          title: "Validación de Modelos Completa",
          description: `${validModels.length} de ${initialGroqModelsList.length} modelos son accesibles.`,
        });
        // If current model is not in the valid list, or no model was set, update it.
        if (!validModels.includes(currentFormModel)) {
          setValue('groqModelName', validModels[0], { shouldDirty: true });
          toast({
            title: 'Modelo Seleccionado Actualizado',
            description: `El modelo ${currentFormModel ? `"${currentFormModel}"` : 'anterior'} no es válido o no está disponible. Se ha cambiado a "${validModels[0]}".`,
            variant: 'default',
            duration: 8000,
          });
        }
      } else {
        toast({
          title: "No se Validaron Modelos Groq",
          description: "Ningún modelo pasó la prueba de conexión. Verifica tu clave API o prueba los modelos individualmente.",
          variant: "destructive",
          duration: 10000,
        });
         // If no models are valid, clear the selection or set to a placeholder if form allows empty.
         // For now, we require a model, so this state might mean the user can't proceed.
         setValue('groqModelName', '', {shouldDirty: true}); 
      }
    };
    
    // This effect runs when currentApiKey (from watch) changes,
    // meaning when it's loaded from localStorage or manually changed by user.
    // We only want to auto-test when it's first loaded or explicitly if we add a button.
    // For now, let's trigger it if currentApiKey has a value and validatedGroqModels is empty (initial state).
    if (currentApiKey && validatedGroqModels.length === 0 && !isTestingAllModels) {
       testAndFilterModels(currentApiKey);
    } else if (!currentApiKey) {
        // If API key is cleared, reset validated models to the full list (as they can't be tested)
        setValidatedGroqModels(initialGroqModelsList);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentApiKey, getValues, setValue, toast]); // Dependencies carefully chosen


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
                  value={watch('groqModelName') || ''}
                  onValueChange={(value) => setValue('groqModelName', value, { shouldDirty: true })}
                  disabled={isTestingAllModels}
                >
                  <SelectTrigger id="groqModelName" className="w-full bg-card text-foreground">
                    <SelectValue placeholder={
                      isTestingAllModels ? "Validando modelos..." :
                      (validatedGroqModels.length === 0 && !!currentApiKey) ? "Ningún modelo validado" :
                      "Selecciona un modelo de Groq"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {isTestingAllModels ? (
                       <div className="p-2 text-sm text-muted-foreground text-center">Validando modelos...</div>
                    ) : validatedGroqModels.length > 0 ? (
                      validatedGroqModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        { currentApiKey 
                          ? "No hay modelos válidos con la clave API actual."
                          : "Introduce una clave API para validar modelos."
                        }
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {errors.groqModelName && (
                  <p className="text-sm text-destructive">{errors.groqModelName.message}</p>
                )}
                 <p className="text-xs text-muted-foreground">
                    Los modelos se validan al cargar la página si existe una clave API.
                    Modelos con TPM más alto pueden permitir un procesamiento más rápido.
                </p>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onTestConnection} 
                disabled={isTestingConnection || !watch('groqApiKey') || !watch('groqModelName')}
                className="w-full md:w-auto text-foreground"
              >
                {isTestingConnection ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                Probar Conexión Groq (Modelo Actual)
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
