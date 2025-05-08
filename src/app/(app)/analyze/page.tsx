
'use client';
import { useState, useEffect, useCallback } from 'react';
import { CodeAnalysisSection } from '@/components/code-analysis-section';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_LLM_PROVIDER,
  LLM_PROVIDERS,
  type LLMProviderId,
  getLocalStorageApiKeyName,
  getLocalStorageModelName,
  LOCALSTORAGE_PROVIDER_ID_KEY
} from '@/config/llm-config';

export default function AnalyzePage() {
  const { toast } = useToast();
  const router = useRouter();

  // State for LLM settings - needed for handleAnalyzeCode if it's called from here eventually
  const [llmProviderId, setLlmProviderId] = useState<LLMProviderId>(DEFAULT_LLM_PROVIDER);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState<string | undefined>(undefined);


  const loadLLMSettings = useCallback(() => {
    const storedProviderId = localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null;
    const provider = LLM_PROVIDERS.find(p => p.id === (storedProviderId || DEFAULT_LLM_PROVIDER)) || LLM_PROVIDERS.find(p => p.id === DEFAULT_LLM_PROVIDER)!;
    setLlmProviderId(provider.id);
    
    setApiKey(localStorage.getItem(getLocalStorageApiKeyName(provider.id)));
    setModelName(localStorage.getItem(getLocalStorageModelName(provider.id)));
    setApiUrl(localStorage.getItem(`codealchemist_apiurl_${provider.id}`) || provider.apiUrl);
  }, []);


  useEffect(() => {
    loadLLMSettings();
    // Listen for storage changes
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key?.startsWith('codealchemist_')) {
        loadLLMSettings();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadLLMSettings]);

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
  
  // Pass LLM config down to the analysis section
  return <CodeAnalysisSection 
            onSaveSnapshot={handleSaveSnapshot} 
            llmProviderId={llmProviderId}
            apiKey={apiKey}
            modelName={modelName}
            apiUrl={apiUrl}
          />;
}
