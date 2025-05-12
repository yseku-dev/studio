
'use client';

import { useState, useCallback, useEffect } from 'react'; 
import { CodeAnalysisSection } from '@/components/code-analysis-section';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Settings2 } from 'lucide-react';


export default function AnalyzePage() {
  const { toast } = useToast();
  const router = useRouter();


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
        action: (<Button onClick={() => router.push('/versions')} variant="outline" size="sm">Ver Versiones</Button>),
      });
    } catch (error) {
      toast({ title: 'Error al Guardar', description: 'No se pudo guardar la versión.', variant: 'destructive' });
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

