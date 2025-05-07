'use client';

import { useState, useEffect } from 'react';
import type { CodeSnapshot } from '@/types/snapshot';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Eye, GitCompareArrows, Info, Download, FileText } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';

export function VersionSnapshots() {
  const [snapshots, setSnapshots] = useState<CodeSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<CodeSnapshot | null>(null);
  const [compareSnapshotA, setCompareSnapshotA] = useState<CodeSnapshot | null>(null);
  const [compareSnapshotB, setCompareSnapshotB] = useState<CodeSnapshot | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadSnapshots();
  }, []);

  const loadSnapshots = () => {
    const storedSnapshots = localStorage.getItem('codealchemist_snapshots');
    if (storedSnapshots) {
      setSnapshots(JSON.parse(storedSnapshots));
    }
  };

  const deleteSnapshot = (id: string) => {
    const updatedSnapshots = snapshots.filter(snap => snap.id !== id);
    setSnapshots(updatedSnapshots);
    localStorage.setItem('codealchemist_snapshots', JSON.stringify(updatedSnapshots));
    toast({ title: 'Snapshot Deleted', description: 'The snapshot has been removed.' });
    if (selectedSnapshot?.id === id) setSelectedSnapshot(null);
    if (compareSnapshotA?.id === id) setCompareSnapshotA(null);
    if (compareSnapshotB?.id === id) setCompareSnapshotB(null);
  };
  
  const deleteAllSnapshots = () => {
    setSnapshots([]);
    localStorage.removeItem('codealchemist_snapshots');
    toast({ title: 'All Snapshots Deleted', description: 'All snapshots have been removed.' });
    setSelectedSnapshot(null);
    setCompareSnapshotA(null);
    setCompareSnapshotB(null);
  };

  const handleViewSnapshot = (snapshot: CodeSnapshot) => {
    setSelectedSnapshot(snapshot);
  };

  const handleSelectForCompare = (snapshot: CodeSnapshot) => {
    if (!compareSnapshotA) {
      setCompareSnapshotA(snapshot);
      toast({ title: 'Snapshot A Selected', description: `Selected "${snapshot.name}" for comparison.`});
    } else if (!compareSnapshotB && snapshot.id !== compareSnapshotA.id) {
      setCompareSnapshotB(snapshot);
      setIsCompareModalOpen(true);
      toast({ title: 'Snapshot B Selected', description: `Selected "${snapshot.name}" for comparison. Showing diff.`});
    } else if (snapshot.id === compareSnapshotA.id) {
      setCompareSnapshotA(null);
       toast({ title: 'Snapshot A Deselected'});
    } else if (compareSnapshotB && snapshot.id === compareSnapshotB.id) {
       setCompareSnapshotB(null);
       toast({ title: 'Snapshot B Deselected'});
    } else {
      // Both A and B are selected, new selection replaces B
      setCompareSnapshotB(snapshot);
      setIsCompareModalOpen(true);
      toast({ title: 'Snapshot B Replaced', description: `Selected "${snapshot.name}" for comparison. Showing diff.`});
    }
  };

  const downloadSnapshot = (snapshot: CodeSnapshot) => {
    const blob = new Blob([snapshot.code], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fileName = snapshot.name.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase() + '.py'; // Assuming Python for now
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast({ title: 'Snapshot Downloaded', description: `${fileName} has been downloaded.` });
  };
  
  const getDiff = (textA: string, textB: string) => {
    // Basic line-by-line diff, can be replaced with a more sophisticated library
    const linesA = textA.split('\n');
    const linesB = textB.split('\n');
    const maxLen = Math.max(linesA.length, linesB.length);
    let diffHtml = '';

    for (let i = 0; i < maxLen; i++) {
      const lineA = linesA[i];
      const lineB = linesB[i];

      if (lineA !== undefined && lineB !== undefined) {
        if (lineA === lineB) {
          diffHtml += `<div class="diff-line same"><span class="line-num">${i+1}</span>${lineA}</div>`;
        } else {
          diffHtml += `<div class="diff-line removed"><span class="line-num">${i+1}</span>- ${lineA}</div>`;
          diffHtml += `<div class="diff-line added"><span class="line-num">${i+1}</span>+ ${lineB}</div>`;
        }
      } else if (lineA !== undefined) {
        diffHtml += `<div class="diff-line removed"><span class="line-num">${i+1}</span>- ${lineA}</div>`;
      } else if (lineB !== undefined) {
        diffHtml += `<div class="diff-line added"><span class="line-num">${i+1}</span>+ ${lineB}</div>`;
      }
    }
    return diffHtml;
  };


  return (
    <>
      <style jsx global>{`
        .diff-line { white-space: pre-wrap; font-family: monospace; font-size: 0.875rem; padding: 0.125rem 0.5rem; display: flex;}
        .diff-line .line-num { display: inline-block; width: 3em; color: hsl(var(--muted-foreground)); text-align: right; margin-right: 1em; user-select: none; }
        .diff-line.same { /* No specific background for same lines */ }
        .diff-line.added { background-color: hsla(var(--accent)/0.1); color: hsl(var(--accent-foreground) / 0.9); }
        .diff-line.removed { background-color: hsla(var(--destructive)/0.1); color: hsl(var(--destructive-foreground) / 0.9); }
        .diff-line.added .line-num { color: hsl(var(--accent-foreground)/0.7); }
        .diff-line.removed .line-num { color: hsl(var(--destructive-foreground)/0.7); }
      `}</style>
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <GitCompareArrows className="h-6 w-6 text-primary" />
              Version Snapshots
            </CardTitle>
            <CardDescription>
              Manage and compare your saved code snapshots. Select two snapshots to compare.
            </CardDescription>
          </div>
          {snapshots.length > 0 && (
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all your snapshots.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteAllSnapshots}>
                    Yes, delete all
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg">No snapshots found.</p>
              <p className="text-sm text-muted-foreground">Save snapshots from the <a href="/analyze" className="text-accent hover:underline">Analyze Code</a> page.</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <ul className="space-y-3">
                {snapshots.map((snap) => (
                  <li key={snap.id}>
                    <Card className={cn(
                        "hover:shadow-md transition-shadow",
                        (compareSnapshotA?.id === snap.id || compareSnapshotB?.id === snap.id) && "border-accent ring-2 ring-accent"
                      )}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{snap.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {new Date(snap.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant={compareSnapshotA?.id === snap.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSelectForCompare(snap)}
                            className={cn(compareSnapshotA?.id === snap.id && "bg-primary text-primary-foreground")}
                          >
                            A
                          </Button>
                          <Button
                            variant={compareSnapshotB?.id === snap.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSelectForCompare(snap)}
                            disabled={!compareSnapshotA || compareSnapshotA.id === snap.id}
                            className={cn(compareSnapshotB?.id === snap.id && "bg-primary text-primary-foreground")}
                          >
                            B
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleViewSnapshot(snap)} title="View Code">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => downloadSnapshot(snap)} title="Download Code">
                            <Download className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Delete Snapshot">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Snapshot?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete &quot;{snap.name}&quot;? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteSnapshot(snap.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
         {snapshots.length > 0 && (
          <CardFooter className="text-sm text-muted-foreground flex items-center gap-1">
            <Info className="h-4 w-4"/> Select two snapshots (A and B) to compare their differences.
          </CardFooter>
        )}
      </Card>

      {selectedSnapshot && (
        <Dialog open={!!selectedSnapshot} onOpenChange={(isOpen) => !isOpen && setSelectedSnapshot(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedSnapshot.name}</DialogTitle>
              <DialogDescription>
                Saved on: {new Date(selectedSnapshot.timestamp).toLocaleString()}
              </DialogDescription>
            </DialogHeader>
            <Separator className="my-4" />
            <ScrollArea className="h-[60vh] rounded-md border bg-card">
              <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-all">{selectedSnapshot.code}</pre>
            </ScrollArea>
             <DialogClose asChild>
                <Button type="button" variant="outline" className="mt-4">Close</Button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      )}

      {compareSnapshotA && compareSnapshotB && (
         <Dialog open={isCompareModalOpen} onOpenChange={(isOpen) => {
             if(!isOpen) {
                 setIsCompareModalOpen(false);
                 // Optionally clear selections when closing compare dialog, or keep them for re-opening.
                 // setCompareSnapshotA(null); 
                 // setCompareSnapshotB(null);
             } else {
                 setIsCompareModalOpen(true);
             }
         }}>
          <DialogContent className="max-w-5xl w-[90vw] h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Comparing Snapshots</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">A: {compareSnapshotA.name}</Badge>
                <Badge variant="outline">B: {compareSnapshotB.name}</Badge>
              </DialogDescription>
            </DialogHeader>
            <Separator className="my-2" />
            <div className="grid grid-cols-2 gap-0 flex-1 min-h-0">
                <ScrollArea className="h-full rounded-l-md border bg-card">
                    <div className="p-1">
                        <div dangerouslySetInnerHTML={{ __html: getDiff(compareSnapshotA.code, compareSnapshotB.code).split('\n').filter(line => line.includes('removed') || line.includes('same')).join('\n') }} />
                    </div>
                </ScrollArea>
                 <ScrollArea className="h-full rounded-r-md border-l-0 border bg-card">
                    <div className="p-1">
                         <div dangerouslySetInnerHTML={{ __html: getDiff(compareSnapshotA.code, compareSnapshotB.code).split('\n').filter(line => line.includes('added') || line.includes('same')).join('\n') }} />
                    </div>
                </ScrollArea>
            </div>
            <div className="mt-4 flex justify-end">
                <DialogClose asChild>
                    <Button type="button" variant="outline">Close</Button>
                </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
