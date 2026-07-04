export type AIProviderName = 'gemini' | 'openai' | 'claude' | 'demo';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ScriptOptions {
  theme?: string;
  style?: string;
  emotion?: string;
  audience?: string;
  duration?: string;
  objective?: string;
}

export interface ImageOptions {
  aspectRatio?: string;
  imageSize?: string;
  style?: string;
}

export interface SEOResult {
  titles: string[];
  description: string;
  tags: string[];
}

export interface TTSResult {
  audio?: string;
  isDemo?: boolean;
}

export interface AIProvider {
  readonly name: AIProviderName;
  chat(messages: ChatMessage[]): Promise<string>;
  generateScript(prompt: string, options?: ScriptOptions): Promise<string>;
  rewrite(script: string, instruction: string): Promise<string>;
  generateImage(prompt: string, options?: ImageOptions): Promise<string>;
  textToSpeech(text: string, voice: string): Promise<TTSResult>;
  optimizeSEO(title: string, script: string): Promise<SEOResult>;
}

export interface AIUsageLog {
  provider: AIProviderName;
  operation: string;
  latencyMs: number;
  timestamp: string;
  success?: boolean;
}
