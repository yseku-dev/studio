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
        name: `Analysis ${nameSuffix} - ${new Date().toLocaleString()}`,
        code: code,
        timestamp: new Date().toISOString(),
      };
      
      snapshots.unshift(newSnapshot); // Add to the beginning
      localStorage.setItem('codealchemist_snapshots', JSON.stringify(snapshots));
      
      toast({
        title: 'Snapshot Saved!',
        description: `${newSnapshot.name} has been saved.`,
        action: (
            <button onClick={() => router.push('/versions')} className="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90">
                View Snapshots
            </button>
        ),
      });
    } catch (error) {
      console.error("Failed to save snapshot:", error);
      toast({
        title: 'Error Saving Snapshot',
        description: 'Could not save the snapshot to local storage.',
        variant: 'destructive',
      });
    }
  };

  return <CodeAnalysisSection onSaveSnapshot={handleSaveSnapshot} />;
}
