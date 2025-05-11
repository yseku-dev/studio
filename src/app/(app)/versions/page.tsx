
'use client';

import { useState, useEffect } from 'react';
import type { CodeSnapshot } from '@/types/snapshot';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Eye, GitCompareArrows, Info, Download, FileText, Archive } from 'lucide-react'; // Added Archive
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
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getApplicationSourceBundle, type AppSourceFile } from '@/app/(app)/autoupdate/actions'; // Import action
import { Loader2 } from 'lucide-react'; // For loading state
import Link from 'next/link';

export default function VersionSnapshotsPage() {
  const [snapshots, setSnapshots] = useState<CodeSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<CodeSnapshot | null>(null);
  const [compareSnapshotA, setCompareSnapshotA] = useState<CodeSnapshot | null>(null);
  const [compareSnapshotB, setCompareSnapshotB] = useState<CodeSnapshot | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isSavingCurrentCode, setIsSavingCurrentCode] = useState(false); // New state for saving current app code

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
    toast({ title: 'Versión Eliminada', description: 'La versión ha sido eliminada.' });
    if (selectedSnapshot?.id === id) setSelectedSnapshot(null);
    if (compareSnapshotA?.id === id) setCompareSnapshotA(null);
    if (compareSnapshotB?.id === id) setCompareSnapshotB(null);
  };
  
  const deleteAllSnapshots = () => {
    setSnapshots([]);
    localStorage.removeItem('codealchemist_snapshots');
    toast({ title: 'Todas las Versiones Eliminadas', description: 'Todas las versiones han sido eliminadas.' });
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
      toast({ title: 'Versión A Seleccionada', description: `"${snapshot.name}" seleccionada para comparar.`});
    } else if (!compareSnapshotB && snapshot.id !== compareSnapshotA.id) {
      setCompareSnapshotB(snapshot);
      setIsCompareModalOpen(true);
      toast({ title: 'Versión B Seleccionada', description: `"${snapshot.name}" seleccionada para comparar. Mostrando diferencias.`});
    } else if (snapshot.id === compareSnapshotA.id) {
      setCompareSnapshotA(null);
       toast({ title: 'Versión A Deseleccionada'});
    } else if (compareSnapshotB && snapshot.id === compareSnapshotB.id) {
       setCompareSnapshotB(null);
       toast({ title: 'Versión B Deseleccionada'});
    } else {
      // A y B están seleccionadas, la nueva selección reemplaza a B
      setCompareSnapshotB(snapshot);
      setIsCompareModalOpen(true);
      toast({ title: 'Versión B Reemplazada', description: `"${snapshot.name}" seleccionada para comparar. Mostrando diferencias.`});
    }
  };

  const downloadSnapshot = (snapshot: CodeSnapshot) => {
    const blob = new Blob([snapshot.code], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fileName = snapshot.name.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase() + '.txt'; // Default to .txt for concatenated code
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast({ title: 'Versión Descargada', description: `${fileName} ha sido descargada.` });
  };
  
  const handleSaveCurrentCodeAlchemistSource = async () => {
    setIsSavingCurrentCode(true);
    toast({ title: 'Guardando Código Actual...', description: 'Recopilando y guardando el código fuente de CodeAlchemist.' });
    try {
      const bundleResult = await getApplicationSourceBundle(true); // Concatenate files

      if (bundleResult.success && bundleResult.concatenatedSource) {
        const newSnapshot: CodeSnapshot = {
          id: crypto.randomUUID(),
          name: `CodeAlchemist - Estado Actual - ${new Date().toLocaleString('es-ES')}`,
          code: bundleResult.concatenatedSource,
          timestamp: new Date().toISOString(),
        };
        
        const currentSnapshots = snapshots;
        const updatedSnapshots = [newSnapshot, ...currentSnapshots];
        setSnapshots(updatedSnapshots);
        localStorage.setItem('codealchemist_snapshots', JSON.stringify(updatedSnapshots));
        
        toast({
          title: '¡Código Actual Guardado!',
          description: `"${newSnapshot.name}" ha sido guardada como una nueva versión.`,
        });
      } else {
        console.error("Error al obtener el paquete fuente:", bundleResult.error, bundleResult.logsBuilt);
        toast({
          title: 'Error al Guardar Código Actual',
          description: bundleResult.error || 'No se pudo obtener el código fuente de la aplicación.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error("Excepción al guardar código actual:", error);
      toast({
        title: 'Error Crítico al Guardar',
        description: 'Ocurrió un error inesperado al intentar guardar el código de la aplicación.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingCurrentCode(false);
    }
  };

  const getDiff = (textA: string, textB: string) => {
    // Diff básico línea por línea, puede reemplazarse con una biblioteca más sofisticada
    const linesA = textA.split('\n');
    const linesB = textB.split('\n');
    const maxLen = Math.max(linesA.length, linesB.length);
    let diffHtml = '';

    for (let i = 0; i < maxLen; i++) {
      const lineA = linesA[i];
      const lineB = linesB[i];

      if (lineA !== undefined && lineB !== undefined) {
        if (lineA === lineB) {
          diffHtml += `<div class="diff-line same"><span class="line-num">${i+1}</span>${lineA.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
        } else {
          diffHtml += `<div class="diff-line removed"><span class="line-num">${i+1}</span>- ${lineA.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
          diffHtml += `<div class="diff-line added"><span class="line-num">${i+1}</span>+ ${lineB.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
        }
      } else if (lineA !== undefined) {
        diffHtml += `<div class="diff-line removed"><span class="line-num">${i+1}</span>- ${lineA.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
      } else if (lineB !== undefined) {
        diffHtml += `<div class="diff-line added"><span class="line-num">${i+1}</span>+ ${lineB.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
      }
    }
    return diffHtml;
  };


  return (
    <>
      <style jsx global>{`
        .diff-line { white-space: pre-wrap; font-family: monospace; font-size: 0.875rem; padding: 0.125rem 0.5rem; display: flex;}
        .diff-line .line-num { display: inline-block; width: 3em; color: hsl(var(--muted-foreground)); text-align: right; margin-right: 1em; user-select: none; }
        .diff-line.same { /* Sin fondo específico para líneas iguales */ }
        .diff-line.added { background-color: hsla(var(--accent)/0.1); color: hsl(var(--accent-foreground) / 0.9); }
        .diff-line.removed { background-color: hsla(var(--destructive)/0.1); color: hsl(var(--destructive-foreground) / 0.9); }
        .diff-line.added .line-num { color: hsl(var(--accent-foreground)/0.7); }
        .diff-line.removed .line-num { color: hsl(var(--destructive-foreground)/0.7); }
      `}</style>
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <GitCompareArrows className="h-6 w-6 text-primary" />
              Versiones Guardadas
            </CardTitle>
            <CardDescription>
              Gestiona y compara tus versiones de código guardadas. Selecciona dos versiones para comparar.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button onClick={handleSaveCurrentCodeAlchemistSource} disabled={isSavingCurrentCode} variant="outline" size="sm" className="w-full sm:w-auto">
              {isSavingCurrentCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
              Guardar Código Actual de la App
            </Button>
            {snapshots.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="w-full sm:w-auto">
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar Todas
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Esto eliminará permanentemente todas tus versiones.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteAllSnapshots}>
                      Sí, eliminar todas
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg">No se encontraron versiones.</p>
              <p className="text-sm text-muted-foreground">Guarda versiones desde la página <Link href="/analyze" className="text-accent hover:underline">Analizar Código</Link> o guarda el estado actual de la app.</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-20rem)]"> {/* Adjusted height */}
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
                            {new Date(snap.timestamp).toLocaleString('es-ES')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap"> {/* Added flex-wrap */}
                          <Button
                            variant={compareSnapshotA?.id === snap.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSelectForCompare(snap)}
                            className={cn("text-xs px-2 h-7", compareSnapshotA?.id === snap.id && "bg-primary text-primary-foreground")} // Smaller button
                            title="Seleccionar como Versión A"
                          >
                            A
                          </Button>
                          <Button
                            variant={compareSnapshotB?.id === snap.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSelectForCompare(snap)}
                            disabled={!compareSnapshotA || compareSnapshotA.id === snap.id}
                            className={cn("text-xs px-2 h-7", compareSnapshotB?.id === snap.id && "bg-primary text-primary-foreground")} // Smaller button
                            title="Seleccionar como Versión B"
                          >
                            B
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleViewSnapshot(snap)} title="Ver Código" className="h-7 w-7"> {/* Smaller icon button */}
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => downloadSnapshot(snap)} title="Descargar Código" className="h-7 w-7"> {/* Smaller icon button */}
                            <Download className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7" title="Eliminar Versión"> {/* Smaller icon button */}
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar Versión?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  ¿Estás seguro de que quieres eliminar &quot;{snap.name}&quot;? Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteSnapshot(snap.id)}>
                                  Eliminar
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
            <Info className="h-4 w-4"/> Selecciona dos versiones (A y B) para comparar sus diferencias.
          </CardFooter>
        )}
      </Card>

      {selectedSnapshot && (
        <Dialog open={!!selectedSnapshot} onOpenChange={(isOpen) => !isOpen && setSelectedSnapshot(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedSnapshot.name}</DialogTitle>
              <DialogDescription>
                Guardado el: {new Date(selectedSnapshot.timestamp).toLocaleString('es-ES')}
              </DialogDescription>
            </DialogHeader>
            <Separator className="my-4" />
            <ScrollArea className="h-[60vh] rounded-md border bg-card">
              <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-all">{selectedSnapshot.code}</pre>
            </ScrollArea>
             <DialogClose asChild>
                <Button type="button" variant="outline" className="mt-4">Cerrar</Button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      )}

      {compareSnapshotA && compareSnapshotB && (
         <Dialog open={isCompareModalOpen} onOpenChange={(isOpen) => {
             if(!isOpen) {
                 setIsCompareModalOpen(false);
             } else {
                 setIsCompareModalOpen(true);
             }
         }}>
          <DialogContent className="max-w-5xl w-[90vw] h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Comparando Versiones</DialogTitle>
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
                    <Button type="button" variant="outline">Cerrar</Button>
                </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

