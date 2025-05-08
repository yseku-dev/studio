
'use client';
import { useState, useCallback } from 'react'; // Removed useEffect
import { CodeAnalysisSection } from '@/components/code-analysis-section';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
// Removed LLM config imports: DEFAULT_LLM_PROVIDER, LLM_PROVIDERS, type LLMProviderId, getLocalStorageApiKeyName, getLocalStorageModelName, LOCALSTORAGE_PROVIDER_ID_KEY

export default function AnalyzePage() {
  const { toast } = useToast();
  const router = useRouter();

  // State for LLM settings - REMOVED
  // const [llmProviderId, setLlmProviderId] = useState<LLMProviderId>(DEFAULT_LLM_PROVIDER);
  // const [apiKey, setApiKey] = useState<string | null>(null);
  // const [modelName, setModelName] = useState<string | null>(null);
  // const [apiUrl, setApiUrl] = useState<string | undefined>(undefined);

  // Removed loadLLMSettings and useEffect related to loading LLM settings

  const handleSaveSnapshot = (code: string, nameSuffix: string) => {
    try {
      const snapshotsRaw = localStorage.getItem('codealchemist_snapshots');
      const snapshots = snapshotsRaw ? JSON.parse(snapshotsRaw) : [];

      const newSnapshot = {
        id: crypto.randomUUID(),
        name: `Análisis ${nameSuffix} - ${new Date().toLocaleString('es-ES')}`,
        code: code,
        timestamp: new Date().toISOString(),
      };

      snapshots.unshift(newSnapshot);
      localStorage.setItem('codealchemist_snapshots', JSON.stringify(snapshots));

      toast({
        title: '¡Versión Guardada!',
        description: `${newSnapshot.name} ha sido guardada.`,
        action: (
            <Button onClick={() => router.push('/versions')} variant="outline" size="sm" className="ml-auto">
                Ver Versiones
            </Button>
        ),
      });
    } catch (error) {
      console.error("Error al guardar la versión:", error);
      toast({
        title: 'Error al Guardar Versión',
        description: 'No se pudo guardar la versión en el almacenamiento local.',
        variant: 'destructive',
      });
    }
  };

  // Removed LLM config props passed down to CodeAnalysisSection
  return <CodeAnalysisSection
            onSaveSnapshot={handleSaveSnapshot}
          />;
}
