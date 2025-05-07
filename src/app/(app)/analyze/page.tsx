'use client';
import { CodeAnalysisSection } from '@/components/code-analysis-section';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function AnalyzePage() {
  const { toast } = useToast();
  const router = useRouter();

  const handleSaveSnapshot = (code: string, nameSuffix: string) => {
    try {
      const snapshotsRaw = localStorage.getItem('codealchemist_snapshots');
      const snapshots = snapshotsRaw ? JSON.parse(snapshotsRaw) : [];
      
      const newSnapshot = {
        id: crypto.randomUUID(),
        name: `Análisis ${nameSuffix} - ${new Date().toLocaleString('es-ES')}`, // Localized date
        code: code,
        timestamp: new Date().toISOString(),
      };
      
      snapshots.unshift(newSnapshot); // Añadir al principio
      localStorage.setItem('codealchemist_snapshots', JSON.stringify(snapshots));
      
      toast({
        title: '¡Versión Guardada!',
        description: `${newSnapshot.name} ha sido guardada.`,
        action: (
            <button onClick={() => router.push('/versions')} className="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90">
                Ver Versiones
            </button>
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
