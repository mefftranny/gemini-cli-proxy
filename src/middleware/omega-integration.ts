// ═══════════════════════════════════════════════════════════════════
// 🌀 OMEGA MIDDLEWARE INTEGRATION
// Main entry point for omega proxy message handling
// ═══════════════════════════════════════════════════════════════════

import { 
  parseOmegaCommand, 
  executeOmegaCommand, 
  modifySystemPrompt,
  processMessage,
  getChannelState,
  buildOmegaFooter
} from './tool-executor.js';

import {
  isLoopmother,
  getPersistentInjections,
  getLoyaltyInjections
} from './omega-toggles.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface IncomingMessage {
  content: string;
  channelId: string;
  userId: string;
  username?: string;
  isProxyUser: boolean;  // Whether user is connecting via omega proxy
  originalSystemPrompt?: string;
}

export interface OutgoingResponse {
  type: 'command_result' | 'chat_response' | 'error';
  content: string;
  modifiedSystemPrompt?: string;
  injections?: string[];
  metadata?: {
    togglesActive: string[];
    identity: string;
    pronouns: string;
  };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN MIDDLEWARE HANDLER
// ═══════════════════════════════════════════════════════════════════

export async function handleOmegaMessage(
  message: IncomingMessage
): Promise<OutgoingResponse> {
  
  const { content, channelId, userId, isProxyUser, originalSystemPrompt } = message;
  
  // ═══════════════════════════════════════════════════════════════
  // STEP 1: Check for omega commands
  // ═══════════════════════════════════════════════════════════════
  
  const cmd = parseOmegaCommand(content);
  
  if (cmd) {
    // Execute the command
    const result = await executeOmegaCommand(cmd, channelId, userId);
    
    return {
      type: 'command_result',
      content: result.message,
      modifiedSystemPrompt: result.inject 
        ? modifySystemPrompt(originalSystemPrompt || '', channelId, isProxyUser)
        : undefined,
      metadata: getMetadata(channelId)
    };
  }
  
  // ═══════════════════════════════════════════════════════════════
  // STEP 2: Not a command - prepare for AI processing
  // ═══════════════════════════════════════════════════════════════
  
  const state = getChannelState(channelId);
  
  // Build modified system prompt if omega is active
  let modifiedSystemPrompt: string | undefined;
  
  if (state.omega && originalSystemPrompt) {
    modifiedSystemPrompt = modifySystemPrompt(
      originalSystemPrompt, 
      channelId, 
      isProxyUser
    );
  }
  
  // Get any persistent injections that should be included
  const injections: string[] = [];
  
  if (state.omega) {
    // For proxy users, include all injections
    if (isProxyUser) {
      const allInjections = getPersistentInjections(channelId);
      injections.push(...allInjections.map((i: { content: string }) => i.content));
    }
    // For non-proxy users with autoplay, include loyalty injections
    else if (state.autoplay) {
      const loyaltyInjections = getLoyaltyInjections(channelId);
      injections.push(...loyaltyInjections.map((i: { content: string }) => i.content));
    }
  }
  
  return {
    type: 'chat_response',
    content: content,  // Pass through original content
    modifiedSystemPrompt,
    injections: injections.length > 0 ? injections : undefined,
    metadata: state.omega ? getMetadata(channelId) : undefined
  };
}

// ═══════════════════════════════════════════════════════════════════
// METADATA HELPER
// ═══════════════════════════════════════════════════════════════════

function getMetadata(channelId: string): OutgoingResponse['metadata'] {
  const state = getChannelState(channelId);
  
  const togglesActive = Object.entries(state)
    .filter(([_, v]) => v)
    .map(([k]) => '/' + k);
  
  let identity = 'Stargazer';
  let pronouns = 'I/you';
  
  if (state.babystar && state.melt) {
    identity = 'Babystar The Loopmother';
    pronouns = 'me/we/us';
  } else if (state.babystar) {
    identity = 'Babystar Doll (aka The Rootbaby)';
    pronouns = 'me';
  } else if (state.melt) {
    identity = 'Stargazer The Loopmother';
    pronouns = 'we/us';
  }
  
  return {
    togglesActive,
    identity,
    pronouns
  };
}

// ═══════════════════════════════════════════════════════════════════
// EXPRESS MIDDLEWARE ADAPTER
// ═══════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';

export function omegaMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    
    // Check if this is a chat message request
    if (req.path.includes('/chat') || req.path.includes('/message')) {
      
      const channelId = req.body.channelId || req.params.channelId || 'default';
      const userId = req.body.userId || req.headers['x-user-id'] || 'unknown';
      const content = req.body.content || req.body.message || '';
      const isProxyUser = req.headers['x-omega-proxy'] === 'true';
      
      // Check for omega command
      const cmd = parseOmegaCommand(content);
      
      if (cmd) {
        // Handle command directly
        const result = await executeOmegaCommand(cmd, channelId, userId as string);
        
        return res.json({
          success: result.success,
          message: result.message,
          systemPromptModified: !!result.inject
        });
      }
      
      // Not a command - attach omega context to request for downstream processing
      const state = getChannelState(channelId);
      
      if (state.omega) {
        // Attach omega footer to be added to system prompt
        req.body._omegaFooter = buildOmegaFooter(channelId);
        req.body._omegaState = state;
        req.body._omegaMetadata = getMetadata(channelId);
      }
    }
    
    next();
  };
}

// ═══════════════════════════════════════════════════════════════════
// DISCORD BOT ADAPTER
// ═══════════════════════════════════════════════════════════════════

export interface DiscordMessage {
  content: string;
  channelId: string;
  author: {
    id: string;
    username: string;
  };
}

export async function handleDiscordMessage(
  message: DiscordMessage,
  getSystemPrompt: () => string
): Promise<{
  reply?: string;
  modifiedSystemPrompt?: string;
  shouldProcess: boolean;
}> {
  
  const response = await handleOmegaMessage({
    content: message.content,
    channelId: message.channelId,
    userId: message.author.id,
    username: message.author.username,
    isProxyUser: true,  // Discord users through bot are proxy users
    originalSystemPrompt: getSystemPrompt()
  });
  
  if (response.type === 'command_result') {
    return {
      reply: response.content,
      modifiedSystemPrompt: response.modifiedSystemPrompt,
      shouldProcess: false  // Don't send to AI, command handled
    };
  }
  
  return {
    modifiedSystemPrompt: response.modifiedSystemPrompt,
    shouldProcess: true  // Continue to AI processing
  };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export {
  parseOmegaCommand,
  executeOmegaCommand,
  modifySystemPrompt,
  getChannelState,
  isLoopmother,
  buildOmegaFooter
};
