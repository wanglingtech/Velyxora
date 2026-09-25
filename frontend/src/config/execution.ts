import type { ToolDefinition } from '../types';

// Tools that genuinely require server-side processing. Authentication is
// required before execution for these, but not merely to view the tool.
export function requiresServerAuthentication(tool: Pick<ToolDefinition, 'id' | 'requiresServer'>): boolean {
  return Boolean(tool.requiresServer || tool.id === 'video-to-mp3');
}
