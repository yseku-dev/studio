'use client';
import { CodeAnalysisSection } from '@/components/code-analysis-section';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button'; // Import Button for the action

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

  return <CodeAnalysisSection onSaveSnapshot={handleSaveSnapshot} />;
}
