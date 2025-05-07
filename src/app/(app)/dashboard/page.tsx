import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ScanLine, GitCompareArrows, Settings as SettingsIcon } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary">Welcome to CodeAlchemist</CardTitle>
          <CardDescription className="text-lg">
            Your AI-powered assistant for code analysis, refactoring, and version management.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-6">
            Navigate through the sections using the sidebar to analyze your code, manage snapshots, or configure your settings.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/analyze" passHref>
              <Button variant="outline" className="w-full h-24 text-lg flex flex-col items-center justify-center gap-2 hover:bg-accent/10">
                <ScanLine className="h-8 w-8 text-accent" />
                Analyze Code
              </Button>
            </Link>
            <Link href="/versions" passHref>
              <Button variant="outline" className="w-full h-24 text-lg flex flex-col items-center justify-center gap-2 hover:bg-accent/10">
                <GitCompareArrows className="h-8 w-8 text-accent" />
                View Snapshots
              </Button>
            </Link>
            <Link href="/settings" passHref>
              <Button variant="outline" className="w-full h-24 text-lg flex flex-col items-center justify-center gap-2 hover:bg-accent/10">
                <SettingsIcon className="h-8 w-8 text-accent" />
                Configure Settings
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p><strong>1. Configure Settings:</strong> Go to the <Link href="/settings" className="text-accent hover:underline">Settings</Link> page to add your Groq API key and select a model.</p>
          <p><strong>2. Analyze Code:</strong> Navigate to the <Link href="/analyze" className="text-accent hover:underline">Analyze Code</Link> page, paste your code, and get AI-powered suggestions.</p>
          <p><strong>3. Manage Snapshots:</strong> Use the <Link href="/versions" className="text-accent hover:underline">Version Snapshots</Link> page to save and compare different versions of your code.</p>
        </CardContent>
      </Card>
    </div>
  );
}
