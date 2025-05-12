
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Save, Settings as SettingsIcon, Zap, Loader2, GitFork, CheckCircle, XCircle, Bug } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { handleTestLLMConnection, handleTestGitConnection } from '@/app/(app)/settings/actions';
import { Separator } from '@/components/ui/separator';
import { useDebug } from '@/contexts/DebugContext';
import {
  LLM_PROVIDERS,
  DEFAULT_LLM_PROVIDER,
  MODELS_BY_PROVIDER,
  type LLMProviderId,
  type LLMProvider,
  getLocalStorageApiKeyName,
  getLocalStorageModelName,
  LOCALSTORAGE_PROVIDER_ID_KEY,
  LOCALSTORAGE_GIT_REPO_URL_KEY,
  LOCALSTORAGE_GIT_USERNAME_KEY,
  LOCALSTORAGE_GIT_EMAIL_KEY,
  LOCALSTORAGE_GIT_PAT_KEY,
} from '@/config/llm-config';

const settingsSchema = z.object({
  llmProviderId: z.custom<LLMProviderId>(val => LLM_PROVIDERS.some(p => p.id === val), {
    message: "Debes seleccionar un proveedor de LLM válido."
  }),
  apiKey: z.string().optional(),
  llmModelName: z.string().min(1, 'El nombre del modelo es obligatorio.'),
  apiUrl: z.string().url({message: "URL de API inválida"}).optional().or(z.literal('')),
  gitRepositoryUrl: z.string().url({ message: "Por favor, introduce una URL válida para el repositorio Git." }).optional().or(z.literal('')),
  gitUsername: z.string().optional(),
  gitEmail: z.string().email({ message: "Por favor, introduce un email válido." }).optional().or(z.literal('')),
  gitPat: z.string().optional(),
  isDebugModeActive: z.boolean().optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export function SettingsForm() {
  const { toast } = useToast();
  const { isDebugModeActive, setIsDebugModeActive, addDebugLog } = useDebug();
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isTestingGitConnection, setIsTestingGitConnection] = useState(false);
  
  const [currentProvider, setCurrentProvider] = useState<LLMProvider | undefined>(
    LLM_PROVIDERS.find(p => p.id === DEFAULT_LLM_PROVIDER)
  );
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty: formIsDirty, dirtyFields }, // Renamed isDirty to formIsDirty
    reset,
    getValues,
    trigger,
    control,
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
        isDebugModeActive: isDebugModeActive,
    }
  });
  
  const watchedProviderId = watch('llmProviderId');
  const watchedApiKey = watch('apiKey');
  const watchedModelName = watch('llmModelName');
  const watchedApiUrl = watch('apiUrl');
  const watchedDebugMode = watch('isDebugModeActive');

  useEffect(() => {
    // Sync form state with context state for debug mode
    setValue('isDebugModeActive', isDebugModeActive, { shouldDirty: false });
  }, [isDebugModeActive, setValue]);

  const updateModelsForProvider = useCallback((providerId: LLMProviderId | undefined) => {
    if (!providerId) {
      setAvailableModels([]);
      return;
    }
    const models = MODELS_BY_PROVIDER[providerId] || {};
    const modelNames = Object.keys(models).sort((a, b) => {
      const tpmA = models[a].tpm || 0;
      const tpmB = models[b].tpm || 0;
      if (tpmA !== tpmB) return tpmB - tpmA;
      const tokensA = models[a].tokens || 0;
      const tokensB = models[b].tokens || 0;
      if (tokensA !== tokensB) return tokensB - tokensA; 
      return a.localeCompare(b);
    });
    setAvailableModels(modelNames);
  }, []);

  useEffect(() => {
    addDebugLog({ source: 'SETTINGS_FORM', type: 'INFO', message: 'Montando formulario de configuración.'});
    const storedProviderId = localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null;
    const initialProviderId = storedProviderId || DEFAULT_LLM_PROVIDER;
    const provider = LLM_PROVIDERS.find(p => p.id === initialProviderId) || LLM_PROVIDERS.find(p => p.id === DEFAULT_LLM_PROVIDER)!;
    
    setCurrentProvider(provider);
    setValue('llmProviderId', provider.id, { shouldDirty: false });
    
    const apiKeyFromStorage = localStorage.getItem(getLocalStorageApiKeyName(provider.id)) || '';
    setValue('apiKey', apiKeyFromStorage, { shouldDirty: false });

    const modelNameFromStorage = localStorage.getItem(getLocalStorageModelName(provider.id));
    updateModelsForProvider(provider.id); 

    const providerModels = MODELS_BY_PROVIDER[provider.id] || {};
    const providerModelKeys = Object.keys(providerModels);
    if (modelNameFromStorage && providerModelKeys.includes(modelNameFromStorage)) {
      setValue('llmModelName', modelNameFromStorage, { shouldDirty: false });
    } else if (providerModelKeys.length > 0) {
      const sortedModels = Object.keys(providerModels).sort((a,b) => (providerModels[b].tpm || 0) - (providerModels[a].tpm || 0) || a.localeCompare(b) );
      setValue('llmModelName', sortedModels[0], { shouldDirty: false });
    } else {
      setValue('llmModelName', '', {shouldDirty: false});
    }
    
    const storedApiUrl = localStorage.getItem(`codealchemist_apiurl_${provider.id}`);
    setValue('apiUrl', storedApiUrl || provider.apiUrl, { shouldDirty: false });

    setValue('gitRepositoryUrl', localStorage.getItem(LOCALSTORAGE_GIT_REPO_URL_KEY) || '', { shouldDirty: false });
    setValue('gitUsername', localStorage.getItem(LOCALSTORAGE_GIT_USERNAME_KEY) || '', { shouldDirty: false });
    setValue('gitEmail', localStorage.getItem(LOCALSTORAGE_GIT_EMAIL_KEY) || '', { shouldDirty: false });
    setValue('gitPat', localStorage.getItem(LOCALSTORAGE_GIT_PAT_KEY) || '', { shouldDirty: false });
    
    setValue('isDebugModeActive', isDebugModeActive, { shouldDirty: false });

    reset(getValues(), {keepValues: true, keepDirty:false}); 
    addDebugLog({ source: 'SETTINGS_FORM', type: 'INFO', message: 'Formulario de configuración inicializado desde localStorage.'});

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setValue, updateModelsForProvider, isDebugModeActive]); // isDebugModeActive is a dependency

  useEffect(() => {
    const newProvider = LLM_PROVIDERS.find(p => p.id === watchedProviderId);
    if (newProvider && newProvider.id !== currentProvider?.id) {
      addDebugLog({ source: 'SETTINGS_FORM', type: 'INFO', message: `Proveedor LLM cambiado a: ${newProvider.name}`});
      setCurrentProvider(newProvider);
      updateModelsForProvider(newProvider.id);

      const apiKeyFromStorage = localStorage.getItem(getLocalStorageApiKeyName(newProvider.id)) || '';
      setValue('apiKey', apiKeyFromStorage, { shouldDirty: dirtyFields.apiKey });

      const newProviderModels = MODELS_BY_PROVIDER[newProvider.id] || {};
      const newProviderModelKeys = Object.keys(newProviderModels);
      if (newProviderModelKeys.length > 0) {
         const sortedModels = Object.keys(newProviderModels).sort((a,b) => (newProviderModels[b].tpm || 0) - (newProviderModels[a].tpm || 0) || a.localeCompare(b) );
         setValue('llmModelName', sortedModels[0], { shouldDirty: dirtyFields.llmModelName });
      } else {
        setValue('llmModelName', '', { shouldDirty: dirtyFields.llmModelName });
      }
      
      const storedApiUrl = localStorage.getItem(`codealchemist_apiurl_${newProvider.id}`);
      setValue('apiUrl', storedApiUrl || newProvider.apiUrl, { shouldDirty: dirtyFields.apiUrl });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedProviderId, setValue, updateModelsForProvider, dirtyFields]);


  const onSubmit: SubmitHandler<SettingsFormData> = (data) => {
    addDebugLog({ source: 'SETTINGS_FORM', type: 'INFO', message: 'Intentando guardar configuración.', data });
    if (!currentProvider) {
        toast({title: "Error", description: "Proveedor LLM no seleccionado.", variant: "destructive"});
        addDebugLog({ source: 'SETTINGS_FORM', type: 'ERROR', message: 'Intento de guardado fallido: Proveedor LLM no seleccionado.'});
        return;
    }
    
    localStorage.setItem(LOCALSTORAGE_PROVIDER_ID_KEY, data.llmProviderId);
    if (data.apiKey) {
      localStorage.setItem(getLocalStorageApiKeyName(data.llmProviderId), data.apiKey);
    } else {
      localStorage.removeItem(getLocalStorageApiKeyName(data.llmProviderId));
    }
    localStorage.setItem(getLocalStorageModelName(data.llmProviderId), data.llmModelName);
    
    const providerConfig = LLM_PROVIDERS.find(p => p.id === data.llmProviderId);
    if (data.apiUrl && data.apiUrl !== providerConfig?.apiUrl) {
        localStorage.setItem(`codealchemist_apiurl_${data.llmProviderId}`, data.apiUrl);
    } else {
        localStorage.removeItem(`codealchemist_apiurl_${data.llmProviderId}`);
    }

    if (data.gitRepositoryUrl) localStorage.setItem(LOCALSTORAGE_GIT_REPO_URL_KEY, data.gitRepositoryUrl);
    else localStorage.removeItem(LOCALSTORAGE_GIT_REPO_URL_KEY);
    
    if (data.gitUsername) localStorage.setItem(LOCALSTORAGE_GIT_USERNAME_KEY, data.gitUsername);
    else localStorage.removeItem(LOCALSTORAGE_GIT_USERNAME_KEY);

    if (data.gitEmail) localStorage.setItem(LOCALSTORAGE_GIT_EMAIL_KEY, data.gitEmail);
    else localStorage.removeItem(LOCALSTORAGE_GIT_EMAIL_KEY);

    if (data.gitPat) localStorage.setItem(LOCALSTORAGE_GIT_PAT_KEY, data.gitPat);
    else localStorage.removeItem(LOCALSTORAGE_GIT_PAT_KEY);
    
    if (data.isDebugModeActive !== undefined) {
        setIsDebugModeActive(data.isDebugModeActive); // Update context and localStorage
    }

    toast({
      title: 'Configuración Guardada',
      description: 'Tus configuraciones han sido actualizadas.',
    });
    addDebugLog({ source: 'SETTINGS_FORM', type: 'INFO', message: 'Configuración guardada exitosamente.'});
    reset(data, { keepValues: true, keepDirty: false }); 
  };

  const onTestLLMConnection = async () => {
    addDebugLog({ source: 'SETTINGS_FORM', type: 'INFO', message: 'Iniciando prueba de conexión LLM.'});
    await trigger(["llmProviderId", "apiKey", "llmModelName", "apiUrl"]);
    const currentValues = getValues();
    const provider = LLM_PROVIDERS.find(p => p.id === currentValues.llmProviderId);

    if (!provider) {
      toast({ title: 'Error', description: 'Proveedor LLM no seleccionado.', variant: 'destructive' });
      addDebugLog({ source: 'SETTINGS_FORM', type: 'ERROR', message: 'Prueba de conexión LLM fallida: Proveedor no seleccionado.'});
      return;
    }
    if (provider.requiresApiKey && !currentValues.apiKey) {
      toast({ title: 'Campos incompletos', description: `Por favor, introduce la Clave API para ${provider.name}.`, variant: 'destructive' });
      addDebugLog({ source: 'SETTINGS_FORM', type: 'ERROR', message: `Prueba de conexión LLM fallida: Falta API Key para ${provider.name}.`});
      return;
    }
    if (!currentValues.llmModelName) {
      toast({ title: 'Campos incompletos', description: 'Por favor, selecciona un Modelo.', variant: 'destructive' });
      addDebugLog({ source: 'SETTINGS_FORM', type: 'ERROR', message: 'Prueba de conexión LLM fallida: Modelo no seleccionado.'});
      return;
    }
     if (!currentValues.apiUrl && (provider.id === 'lmstudio' || provider.id === 'ollama')) {
      toast({ title: 'Campos incompletos', description: `Por favor, introduce la URL de API para ${provider.name}.`, variant: 'destructive' });
      addDebugLog({ source: 'SETTINGS_FORM', type: 'ERROR', message: `Prueba de conexión LLM fallida: Falta API URL para ${provider.name}.`});
      return;
    }

    setIsTestingConnection(true);
    const result = await handleTestLLMConnection(
      provider.id,
      currentValues.apiKey || "",
      currentValues.llmModelName,
      currentValues.apiUrl || provider.apiUrl
    );
    setIsTestingConnection(false);

    if (result.success) {
      toast({
        title: `Conexión ${provider.name} Exitosa`,
        description: `Conectado correctamente con el modelo ${currentValues.llmModelName}. ${result.data ? "Respuesta: " + String(result.data).substring(0,50) + "..." : ""}`,
        action: <CheckCircle className="text-green-500" />,
      });
      addDebugLog({ source: 'SETTINGS_FORM', type: 'INFO', message: `Prueba de conexión LLM para ${provider.name} exitosa.`, data: { model: currentValues.llmModelName, response: result.data } });
    } else {
      toast({
        title: `Error de Conexión ${provider.name}`,
        description: result.message,
        variant: 'destructive',
        action: <XCircle className="text-white" />,
      });
      addDebugLog({ source: 'SETTINGS_FORM', type: 'ERROR', message: `Prueba de conexión LLM para ${provider.name} fallida: ${result.message}`, data: { model: currentValues.llmModelName, errorResponse: result.data } });
    }
  };

  const onTestGitConnection = async () => {
    addDebugLog({ source: 'SETTINGS_FORM', type: 'INFO', message: 'Iniciando prueba de conexión Git.'});
    await trigger(["gitRepositoryUrl", "gitUsername", "gitPat"]);
    const { gitRepositoryUrl, gitUsername, gitPat } = getValues();
     if (!gitRepositoryUrl || !gitUsername || !gitPat) {
      toast({
        title: 'Campos Git incompletos',
        description: 'Por favor, introduce la URL del Repositorio, Nombre de Usuario Git y Token de Acceso Personal (PAT) antes de probar la conexión Git.',
        variant: 'destructive',
      });
      addDebugLog({ source: 'SETTINGS_FORM', type: 'ERROR', message: 'Prueba de conexión Git fallida: Campos incompletos.'});
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
      addDebugLog({ source: 'SETTINGS_FORM', type: 'INFO', message: `Prueba de conexión Git exitosa para ${gitRepositoryUrl}.`, data: result });
    } else {
      toast({
        title: 'Error de Conexión Git',
        description: result.message,
        variant: 'destructive',
        duration: 7000,
        action: <XCircle className="text-white" />,
      });
      addDebugLog({ source: 'SETTINGS_FORM', type: 'ERROR', message: `Prueba de conexión Git fallida para ${gitRepositoryUrl}: ${result.message}`, data: result });
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
          Configura tu proveedor de LLM, claves API, modelo preferido y detalles de Git. Estos ajustes se guardan en el almacenamiento local de tu navegador.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-primary mb-2">Configuración del Proveedor LLM</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="llmProviderId" className="text-foreground">Proveedor LLM</Label>
                <Select
                  value={watchedProviderId}
                  onValueChange={(value) => setValue('llmProviderId', value as LLMProviderId, { shouldDirty: true, shouldValidate: true })}
                >
                  <SelectTrigger id="llmProviderId" className="w-full bg-card text-foreground">
                    <SelectValue placeholder="Selecciona un proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {LLM_PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.llmProviderId && (
                  <p className="text-sm text-destructive">{errors.llmProviderId.message}</p>
                )}
              </div>
              
              {currentProvider && (currentProvider.id === 'lmstudio' || currentProvider.id === 'ollama' || currentProvider.id === 'openai' || currentProvider.id === 'groq' || currentProvider.id === 'anthropic' || currentProvider.isGoogleGenerativeAICompatible) && (
                <div className="space-y-2">
                  <Label htmlFor="apiUrl" className="text-foreground">URL del Endpoint de API ({currentProvider.name})</Label>
                  <Input
                    id="apiUrl"
                    type="url"
                    {...register('apiUrl')}
                    placeholder={`Ej: ${currentProvider.apiUrl}`}
                    className="bg-card text-foreground"
                    defaultValue={currentProvider.apiUrl}
                  />
                   {errors.apiUrl && (
                    <p className="text-sm text-destructive">{errors.apiUrl.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Asegúrate de que este endpoint sea accesible. Para LM Studio/Ollama, incluye la versión, ej: /v1.
                  </p>
                </div>
              )}

              {currentProvider && currentProvider.requiresApiKey && (
                <div className="space-y-2">
                  <Label htmlFor="apiKey" className="text-foreground">Clave API de {currentProvider?.name || 'LLM'}</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    {...register('apiKey')}
                    placeholder={`Introduce tu clave API de ${currentProvider?.name || 'LLM'}`}
                    className="bg-card text-foreground"
                  />
                  {errors.apiKey && (
                    <p className="text-sm text-destructive">{errors.apiKey.message}</p>
                  )}
                </div>
              )}

              {currentProvider && (
                <div className="space-y-2">
                  <Label htmlFor="llmModelName" className="text-foreground">Nombre del Modelo ({currentProvider.name})</Label>
                  <Select
                    value={watchedModelName || ''}
                    onValueChange={(value) => setValue('llmModelName', value, { shouldDirty: true, shouldValidate: true })}
                  >
                    <SelectTrigger id="llmModelName" className="w-full bg-card text-foreground">
                      <SelectValue placeholder={availableModels.length > 0 ? "Selecciona un modelo" : "No hay modelos disponibles o carga de modelos"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.length > 0 ? (
                        availableModels.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model} 
                            {MODELS_BY_PROVIDER[currentProvider!.id]?.[model]?.tpm && ` (TPM: ${MODELS_BY_PROVIDER[currentProvider!.id]![model]!.tpm})`}
                            {MODELS_BY_PROVIDER[currentProvider!.id]?.[model]?.tokens && ` (CTX: ${(MODELS_BY_PROVIDER[currentProvider!.id]![model]!.tokens! / 1000).toFixed(0)}k)`}
                          </SelectItem>
                        ))
                      ) : (
                         <div className="p-2 text-sm text-muted-foreground text-center">
                           { currentProvider.requiresApiKey && !watchedApiKey 
                             ? "Introduce una clave API para ver modelos." 
                             : currentProvider.id === "ollama" || currentProvider.id === "lmstudio"
                             ? "Carga/selecciona modelos en tu instancia local."
                             : "No hay modelos configurados para este proveedor."
                           }
                         </div>
                      )}
                    </SelectContent>
                  </Select>
                  {errors.llmModelName && (
                    <p className="text-sm text-destructive">{errors.llmModelName.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    La disponibilidad de modelos depende del proveedor y de tu clave API.
                  </p>
                </div>
              )}
              <Button 
                type="button" 
                variant="outline" 
                onClick={onTestLLMConnection} 
                disabled={isTestingConnection || !watchedProviderId || (currentProvider?.requiresApiKey && !watchedApiKey) || !watchedModelName}
                className="w-full md:w-auto text-foreground"
              >
                {isTestingConnection ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                Probar Conexión ({currentProvider?.name || 'LLM'})
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

          <Separator />

          <div>
            <h3 className="text-lg font-medium text-primary mb-2 flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Modo Depuración
            </h3>
            <div className="flex items-center space-x-2">
                <Switch
                    id="debug-mode"
                    checked={watchedDebugMode}
                    onCheckedChange={(checked) => {
                        setValue('isDebugModeActive', checked, { shouldDirty: true });
                        // No es necesario llamar a setIsDebugModeActive aquí, se hará en el submit
                    }}
                />
                <Label htmlFor="debug-mode" className="text-foreground">Activar modo Debug</Label>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
                Muestra una ventana de logs detallados en la parte inferior de la pantalla.
            </p>
            {errors.isDebugModeActive && (
                <p className="text-sm text-destructive">{errors.isDebugModeActive.message}</p>
            )}
          </div>

        </CardContent>
        <CardFooter>
          <Button 
            type="submit" 
            disabled={!formIsDirty} 
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
