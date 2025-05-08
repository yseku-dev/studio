
'use client';

import { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CodeXml, Wand2, AlertTriangle, Copy, CheckCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { handleGenerateCode } from './actions';
import type { GeneratedCodeResponse } from './actions';
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

const formSchema = z.object({
  prompt: z.string().min(10, 'El prompt debe tener al menos 10 caracteres.'),
});

type FormData = z.infer<typeof formSchema>;

export default function GenerateCodePage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generationResult, setGenerationResult] = useState<GeneratedCodeResponse['data'] | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [promptToConfirm, setPromptToConfirm] = useState<string>("");

  const { toast } = useToast();

  useEffect(() => {
    setApiKey(localStorage.getItem('codealchemist_groq_api_key'));
    setModelName(localStorage.getItem('codealchemist_groq_model_name'));
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: '',
    }
  });

  const currentPrompt = watch('prompt');

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setPromptToConfirm(data.prompt);
    setIsConfirming(true);
  };

  const proceedWithGeneration = async () => {
    setIsConfirming(false);
    if (!promptToConfirm) return;

    if (!apiKey || !modelName) {
      toast({
        title: 'Configuración Faltante',
        description: 'Por favor, establece tu Clave API de Groq y Nombre de Modelo en Configuración.',
        variant: 'destructive',
      });
      return;
    }
    setIsLoading(true);
    setGenerationResult(null);
    setGenerationError(null);

    const result = await handleGenerateCode(promptToConfirm, apiKey, modelName);

    if (result.success && result.data) {
      setGenerationResult(result.data);
      toast({
        title: 'Generación Completa',
        description: 'Código generado exitosamente.',
        action: <CheckCircle className="text-green-500" />
      });
    } else {
      setGenerationError(result.error || 'Ocurrió un error desconocido durante la generación.');
      toast({
        title: 'Generación Fallida',
        description: result.error || 'No se pudo generar el código. Revisa el mensaje de error.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  const handleCopyCode = (code: string | undefined) => {
    if (!code) return;
    navigator.clipboard.writeText(code)
      .then(() => {
        toast({ title: 'Código Copiado', description: 'El código generado ha sido copiado al portapapeles.' });
      })
      .catch(err => {
        console.error('Error al copiar el código:', err);
        toast({ title: 'Fallo al Copiar', description: 'No se pudo copiar el código.', variant: 'destructive' });
      });
  };
  
  const handleCopyError = (errorText: string | undefined) => {
    if (!errorText) return;
    navigator.clipboard.writeText(errorText)
      .then(() => {
        toast({ title: 'Error Copiado', description: 'El mensaje de error ha sido copiado al portapapeles.' });
      })
      .catch(err => {
        console.error('Error al copiar el error:', err);
        toast({ title: 'Fallo al Copiar', description: 'No se pudo copiar el error al portapapeles.', variant: 'destructive' });
      });
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <CodeXml className="h-6 w-6 text-primary" />
            Generar Código
          </CardTitle>
          <CardDescription>
            Describe el código que necesitas y la IA lo generará por ti. 
            {!apiKey || !modelName ? (
                <span className="text-destructive block mt-1"> (Clave API o Modelo no configurado en Ajustes)</span>
            ) : <span className="text-foreground block mt-1">(Usando modelo: {modelName})</span>}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt" className="text-base">Describe tu necesidad:</Label>
              <Textarea
                id="prompt"
                {...register('prompt')}
                rows={8}
                className="font-mono text-sm bg-card"
                placeholder="Ej: 'Una función en Python que reciba una lista de números y devuelva la suma de los pares.'"
              />
              {errors.prompt && (
                <p className="text-sm text-destructive mt-1">{errors.prompt.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
              <AlertDialogTrigger asChild>
                 <Button type="submit" disabled={isLoading || !currentPrompt} className="w-full md:w-auto">
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  Generar Código
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Generación</AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿Estás seguro de que deseas generar código basado en el siguiente prompt?
                    <ScrollArea className="h-[150px] mt-2 p-2 border rounded bg-muted/30">
                        <pre className="text-xs text-foreground whitespace-pre-wrap">{promptToConfirm}</pre>
                    </ScrollArea>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setPromptToConfirm("")}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={proceedWithGeneration}>
                    Sí, Generar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </form>
      </Card>

      {isLoading && (
        <div 
          data-ai-hint="code generation loading"
          className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-8 min-h-[200px] mt-6"
        >
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-foreground">Generando código...</p>
          <p className="text-sm text-muted-foreground">Esto podría tomar unos momentos.</p>
        </div>
      )}

      {generationError && !isLoading && (
        <Card className="shadow-lg border-destructive bg-destructive/10 mt-6">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-6 w-6" />
              Error en la Generación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-destructive">No se pudo completar la generación del código:</p>
            <ScrollArea className="h-[100px] p-2 border border-destructive/30 rounded bg-background/50">
                <pre className="text-xs text-foreground whitespace-pre-wrap">{generationError}</pre>
            </ScrollArea>
             <Button variant="outline" size="sm" onClick={() => handleCopyError(generationError)} className="mt-2 text-destructive border-destructive/50 hover:bg-destructive/20 hover:text-destructive-foreground">
                <Copy className="mr-2 h-4 w-4"/> Copiar Mensaje de Error
            </Button>
          </CardContent>
        </Card>
      )}

      {generationResult && !isLoading && !generationError && (
        <Card className="shadow-lg mt-6">
          <CardHeader>
            <CardTitle className="text-2xl">Código Generado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {generationResult.explanation && (
              <div>
                <h3 className="text-lg font-semibold mb-1">Explicación:</h3>
                <Card className="bg-muted/50 p-3">
                  <p className="text-sm text-foreground">{generationResult.explanation}</p>
                </Card>
              </div>
            )}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Fragmento de Código:</h3>
                <Button variant="outline" size="sm" onClick={() => handleCopyCode(generationResult.generatedCode)}>
                  <Copy className="mr-2 h-4 w-4" /> Copiar Código
                </Button>
              </div>
              <ScrollArea className="h-[400px] rounded-md border bg-card p-1">
                <pre className="p-3 text-sm font-mono whitespace-pre-wrap break-all text-foreground">{generationResult.generatedCode}</pre>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
