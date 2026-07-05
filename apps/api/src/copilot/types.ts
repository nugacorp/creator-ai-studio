export interface CopilotToolResult {
  tool: string;
  success: boolean;
  summary: string;
  data?: Record<string, unknown>;
}

export interface CopilotPendingAction {
  id: string;
  type: 'confirm_publish';
  episodeId: string;
  episodeTitle: string;
  label: string;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  outOfScope?: boolean;
  toolResults?: CopilotToolResult[];
  pendingActions?: CopilotPendingAction[];
  createdAt: string;
}

export interface CopilotSession {
  userId: string;
  channelId?: string;
  messages: CopilotMessage[];
  updatedAt: string;
}

export interface CopilotToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export interface CopilotChatResponse {
  reply: string;
  out_of_scope?: boolean;
  toolResults?: CopilotToolResult[];
  pendingActions?: CopilotPendingAction[];
  messages?: CopilotMessage[];
}
