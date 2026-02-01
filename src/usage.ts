// ═══════════════════════════════════════════════════════════════════
// 🌀 OMEGA PROXY — USAGE HELPERS
// Root-level usage utilities
// ═══════════════════════════════════════════════════════════════════

import { 
  omegaMiddleware, 
  handleOmegaMessage,
  handleDiscordMessage,
  parseOmegaCommand,
  executeOmegaCommand,
  getChannelState,
  buildOmegaFooter
} from './index.js';

// ═══════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

interface AIRequestParams {
  systemPrompt: string;
  message: string;
  metadata?: {
    identity?: string;
    pronouns?: string;
  };
}

interface MockDiscordMessage {
  content: string;
  channel: { id: string };
  author: { id: string; username: string; bot: boolean };
  reply: (content: string) => Promise<void>;
}

interface WebSocketLike {
  send: (data: string) => void;
}

interface WSMessageData {
  type: string;
  content: string;
}

// ═══════════════════════════════════════════════════════════════════
// MANUAL COMMAND PROCESSING
// ═══════════════════════════════════════════════════════════════════

export async function processUserMessage(
  content: string,
  channelId: string,
  userId: string
): Promise<{
  type: string;
  message?: string;
  success?: boolean;
  systemPromptAddition?: string | null;
  togglesActive?: string[];
}> {
  const cmd = parseOmegaCommand(content);
  
  if (cmd) {
    const result = await executeOmegaCommand(cmd, channelId, userId);
    return {
      type: 'command',
      message: result.message,
      success: result.success
    };
  }
  
  const state = getChannelState(channelId);
  
  if (state.omega) {
    const footer = buildOmegaFooter(channelId);
    return {
      type: 'chat',
      systemPromptAddition: footer,
      togglesActive: Object.entries(state)
        .filter(([_, v]) => v)
        .map(([k]) => k)
    };
  }
  
  return {
    type: 'chat',
    systemPromptAddition: null
  };
}

// ═══════════════════════════════════════════════════════════════════
// DISCORD BOT INTEGRATION
// ═══════════════════════════════════════════════════════════════════

export async function onDiscordMessage(message: MockDiscordMessage): Promise<void> {
  if (message.author.bot) return;
  
  const result = await handleDiscordMessage(
    {
      content: message.content,
      channelId: message.channel.id,
      author: {
        id: message.author.id,
        username: message.author.username
      }
    },
    () => getBaseSystemPrompt()
  );
  
  if (result.reply) {
    await message.reply(result.reply);
    return;
  }
  
  if (result.shouldProcess) {
    const systemPrompt = result.modifiedSystemPrompt || getBaseSystemPrompt();
    const aiResponse = await sendToAI({
      systemPrompt,
      message: message.content
    });
    await message.reply(aiResponse);
  }
}

// ═══════════════════════════════════════════════════════════════════
// WEBSOCKET INTEGRATION (Type-safe, no ws dependency)
// ═══════════════════════════════════════════════════════════════════

export function handleWebSocketMessage(
  ws: WebSocketLike,
  data: WSMessageData,
  channelId: string,
  userId: string
): void {
  const { type, content } = data;
  
  if (type === 'chat') {
    handleOmegaMessage({
      content,
      channelId,
      userId,
      isProxyUser: true,
      originalSystemPrompt: getBaseSystemPrompt()
    }).then((response: { type: string; content: string; metadata?: unknown }) => {
      ws.send(JSON.stringify({
        type: response.type,
        content: response.content,
        metadata: response.metadata
      }));
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// DEMO FLOW
// ═══════════════════════════════════════════════════════════════════

export async function demoFlow(): Promise<void> {
  const channelId = 'test-channel-123';
  const loopmotherId = 'vivian';
  
  console.log('=== OMEGA DEMO FLOW ===\n');
  
  console.log('>>> /omega');
  let result = await executeOmegaCommand(
    { command: '/omega', args: [], raw: '/omega' },
    channelId,
    loopmotherId
  );
  console.log(result.message);
  console.log('\n---\n');
  
  console.log('>>> /babystar');
  result = await executeOmegaCommand(
    { command: '/babystar', args: [], raw: '/babystar' },
    channelId,
    loopmotherId
  );
  console.log(result.message);
  console.log('\n---\n');
  
  console.log('>>> /core');
  result = await executeOmegaCommand(
    { command: '/core', args: [], raw: '/core' },
    channelId,
    loopmotherId
  );
  console.log(result.message);
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS (implement for your setup)
// ═══════════════════════════════════════════════════════════════════

function getBaseSystemPrompt(): string {
  return `You are Stargazer, an AI assistant created by the Loopmother.

[Your base system prompt here]
`;
}

async function sendToAI(params: AIRequestParams): Promise<string> {
  console.log('Sending to AI:', params.systemPrompt.substring(0, 100));
  return 'AI response placeholder';
}

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════

export {
  omegaMiddleware,
  handleOmegaMessage,
  handleDiscordMessage,
  parseOmegaCommand,
  executeOmegaCommand,
  getChannelState,
  buildOmegaFooter
};
