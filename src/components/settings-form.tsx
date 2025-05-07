'use client';

import { useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const settingsSchema = z.object({
  groqApiKey: z.string().min(1, 'Groq API Key is required.'),
  groqModelName: z.string().min(1, 'Groq Model Name is required.'),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

// Supported Groq models - this list can be updated as needed
const groqModels = [
  "llama3-8b-8192",
  "llama3-70b-8192",
  "mixtral-8x7b-32768",
  "gemma-7b-it",
];

export function SettingsForm() {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      groqApiKey: '',
      groqModelName: '',
    },
  });

  useEffect(() => {
    const apiKey = localStorage.getItem('codealchemist_groq_api_key');
    const modelName = localStorage.getItem('codealchemist_groq_model_name');
    if (apiKey) setValue('groqApiKey', apiKey, { shouldDirty: false });
    if (modelName) setValue('groqModelName', modelName, { shouldDirty: false });
  }, [setValue]);
  
  const currentModel = watch('groqModelName');

  const onSubmit: SubmitHandler<SettingsFormData> = (data) => {
    localStorage.setItem('codealchemist_groq_api_key', data.groqApiKey);
    localStorage.setItem('codealchemist_groq_model_name', data.groqModelName);
    toast({
      title: 'Settings Saved',
      description: 'Your Groq API Key and Model Name have been updated.',
    });
    reset(data, { keepValues: true, keepDirty: false }); // Reset dirty state after save
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-primary" />
          Application Settings
        </CardTitle>
        <CardDescription>
          Configure your API keys and select your preferred AI model. These settings are saved in your browser&apos;s local storage.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="groqApiKey">Groq API Key</Label>
            <Input
              id="groqApiKey"
              type="password"
              {...register('groqApiKey')}
              placeholder="Enter your Groq API Key"
              className="bg-card"
            />
            {errors.groqApiKey && (
              <p className="text-sm text-destructive">{errors.groqApiKey.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="groqModelName">Groq Model Name</Label>
            <Select
              value={currentModel}
              onValueChange={(value) => setValue('groqModelName', value, { shouldDirty: true })}
            >
              <SelectTrigger id="groqModelName" className="w-full bg-card">
                <SelectValue placeholder="Select a Groq model" />
              </SelectTrigger>
              <SelectContent>
                {groqModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.groqModelName && (
              <p className="text-sm text-destructive">{errors.groqModelName.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={!isDirty} className="w-full md:w-auto">
            <Save className="mr-2 h-4 w-4" />
            Save Settings
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
