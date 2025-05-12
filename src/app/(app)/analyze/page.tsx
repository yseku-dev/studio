
'use client';

import { useState, useCallback, useEffect } from 'react'; 
import { CodeAnalysisSection } from '@/components/code-analysis-section';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useDebug } from '@/contexts/DebugContext';


export default function AnalyzePage() {
  const { toast } = useToast();
  const router = useRouter();
  const { addDebugLog } = useDebug();

  useEffect(() => {
    addDebugLog({ source: 'ANALYZE_PAGE', type: 'INFO', message: 'Componente AnalyzePage montado.' });
    return () => {
      addDebugLog({ source: 'ANALYZE_PAGE', type: 'INFO', message: 'Componente AnalyzePage desmontado.' });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleSaveSnapshot = (code: string, nameSuffix: string) => {
    addDebugLog({ source: 'ANALYZE_PAGE', type: 'INFO', message: `Intentando guardar snapshot: ${nameSuffix}`, data: { codeLength: code.length } });
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
        action: (<Button onClick={() => router.push('/versions')} variant="outline" size="sm">Ver Versiones</Button>),
      });
      addDebugLog({ source: 'ANALYZE_PAGE', type: 'INFO', message: 'Snapshot guardado exitosamente.', data: newSnapshot });
    } catch (error) {
      toast({ title: 'Error al Guardar', description: 'No se pudo guardar la versión.', variant: 'destructive' });
      addDebugLog({ source: 'ANALYZE_PAGE', type: 'ERROR', message: 'Error al guardar snapshot.', data: error });
    }
  };
  

  return (
     <div className="space-y-6">
        <CodeAnalysisSection
            onSaveSnapshot={handleSaveSnapshot}
        />
    </div>
  );
}
