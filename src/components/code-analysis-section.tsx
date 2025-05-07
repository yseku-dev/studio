'use client';

import { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { handleAnalyzeCode } from '@/app/(app)/analyze/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2, Save } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

const formSchema = z.object({
  code: z.string().min(10, 'Code must be at least 10 characters long.'),
});

type FormData = z.infer<typeof formSchema>;

interface AnalysisResult {
  codeSuggestion: string;
  explanation: string;
}

interface CodeAnalysisSectionProps {
  onSaveSnapshot: (code: string, nameSuffix: string) => void;
}

export function CodeAnalysisSection({ onSaveSnapshot }: CodeAnalysisSectionProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [originalCode, setOriginalCode] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    setApiKey(localStorage.getItem('codealchemist_groq_api_key'));
    setModelName(localStorage.getItem('codealchemist_groq_model_name'));
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    if (!apiKey || !modelName) {
      toast({
        title: 'Configuration Missing',
        description: 'Please set your Groq API Key and Model Name in Settings.',
        variant: 'destructive',
      });
      return;
    }
    setIsLoading(true);
    setAnalysisResult(null);
    setOriginalCode(data.code);

    const result = await handleAnalyzeCode(data.code, apiKey, modelName);

    if (result.success && result.data) {
      setAnalysisResult(result.data);
      toast({
        title: 'Analysis Complete',
        description: 'Suggestions generated successfully.',
      });
    } else {
      toast({
        title: 'Analysis Failed',
        description: result.error || 'An unknown error occurred.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };
  
  const handleSaveOriginal = () => {
    if (originalCode) {
      onSaveSnapshot(originalCode, "original");
    } else {
      toast({ title: "Nothing to save", description: "Original code is empty.", variant: "destructive" });
    }
  };

  const handleSaveSuggestion = () => {
    if (analysisResult?.codeSuggestion) {
      onSaveSnapshot(analysisResult.codeSuggestion, "suggested");
    } else {
      toast({ title: "Nothing to save", description: "No code suggestion available.", variant: "destructive" });
    }
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-primary" />
            Analyze Your Code
          </CardTitle>
          <CardDescription>
            Paste your code below to get AI-powered improvement suggestions.
            {!apiKey || !modelName ? (
                <span className="text-destructive block mt-1"> (API Key or Model not set in Settings)</span>
            ) : <span className="text-muted-foreground block mt-1">(Using model: {modelName})</span>}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="code">Code Input (Python recommended)</Label>
              <Textarea
                id="code"
                {...register('code')}
                rows={15}
                className="font-mono text-sm bg-card mt-1"
                placeholder="Paste your code here..."
              />
              {errors.code && (
                <p className="text-sm text-destructive mt-1">{errors.code.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Analyze Code
            </Button>
          </CardFooter>
        </form>
      </Card>

      {analysisResult && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Analysis Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Explanation</h3>
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-sm">{analysisResult.explanation}</p>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-semibold">Original Code</h3>
                    <Button variant="outline" size="sm" onClick={handleSaveOriginal} disabled={!originalCode}>
                        <Save className="mr-2 h-4 w-4" /> Save Snapshot
                    </Button>
                </div>
                <ScrollArea className="h-[400px] rounded-md border bg-card p-1">
                  <pre className="p-3 text-sm font-mono whitespace-pre-wrap break-all">{originalCode}</pre>
                </ScrollArea>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-semibold">Suggested Code</h3>
                    <Button variant="outline" size="sm" onClick={handleSaveSuggestion} disabled={!analysisResult.codeSuggestion}>
                        <Save className="mr-2 h-4 w-4" /> Save Snapshot
                    </Button>
                </div>
                <ScrollArea className="h-[400px] rounded-md border bg-card p-1">
                  <pre className="p-3 text-sm font-mono whitespace-pre-wrap break-all">{analysisResult.codeSuggestion}</pre>
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
