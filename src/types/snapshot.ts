export interface CodeSnapshot {
  id: string;
  name: string;
  code: string;
  timestamp: string;
  analysis?: {
    suggestion: string;
    explanation: string;
  };
}
