export interface Scene {
  id: string;
  text: string;
  imageUrl: string;
  voiceoverPrompt: string;
  musicTrack: string;
  duration: number; // in seconds
  transition: string;
}

export type ProjectStatus =
  | 'Ideas'
  | 'Investigación'
  | 'Guion'
  | 'Narración IA'
  | 'Edición'
  | 'Miniatura'
  | 'Programado'
  | 'Publicado';

export interface VideoProject {
  id: string;
  title: string;
  series: string;
  status: ProjectStatus;
  progress: number;
  script: string;
  outline: string[];
  scenes: Scene[];
  audioUrl?: string;
  thumbnailUrl?: string;
  seoTitles: string[];
  seoDescription: string;
  seoTags: string[];
  scheduledAt?: string;
  duration: string;
}

export interface Channel {
  id: string;
  name: string;
  status: 'Produciendo' | 'Publicado' | 'En edición' | 'Investigación';
  subscribers: number;
  avatar: string;
  type: 'YouTube' | 'TikTok' | 'Facebook' | 'Instagram' | 'Podcast';
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'Idle' | 'Working' | 'Analyzing' | 'Exporting';
  currentTask: string;
  avatar: string;
  logs: string[];
}

export interface Notification {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
  read: boolean;
}

export interface AutomationNode {
  id: string;
  type: 'trigger' | 'action' | 'condition';
  label: string;
  description: string;
  status: 'idle' | 'running' | 'success' | 'error';
  config: Record<string, string>;
}

export interface AutomationEdge {
  id: string;
  source: string;
  target: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  activeProject?: string;
  status: 'Online' | 'Offline';
}
