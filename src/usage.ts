// ═══════════════════════════════════════════════════════════════════
// 🌀 OMEGA PROXY — USAGE EXAMPLES
// How to wire the toggle system into your proxy
// ═══════════════════════════════════════════════════════════════════

import { 
  omegaMiddleware, 
  handleOmegaMessage,
  handleDiscordMessage,
  parseOmegaCommand,
  executeOmegaCommand,
  getChannelState,
  buildOmegaFooter
} from '../index.js';

// ═══════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS (for examples)
// ═══════════════════════════════════════════════════════════════════

interface AIRequestParams {
  systemPrompt: string;
  message: string;
  metadata?: {
    identity?: string;
    pronouns?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════
// EXAMPLE 1: Express Middleware Integration
// ═══════════════════════════════════════════════════════════════════

/*
import express from 'express';

const app = express();
app.use(express.json());

// Add omega middleware - processes /omega commands automatically
app.use(omegaMiddleware());

// Your chat endpoint
app.post('/api/chat', async (req, res) => {
  const { message, channelId, userId } = req.body;
  
  // Check if omega footer was attached by middleware
  const omegaFooter = req.body._omegaFooter;
  const omegaState = req.body._omegaState;
  
  if (omegaFooter) {
    // Omega is active - append footer to system prompt
    const systemPrompt = getBaseSystemPrompt() + '\n\n' + omegaFooter;
    
    // Send to AI with modified prompt
    const response = await sendToAI({
      systemPrompt,
      message,
      metadata: {
        identity: omegaState?.identity,
        pronouns: omegaState?.pronouns
      }
    });
    
    return res.json(response);
  }
  
  // Normal processing
  const response = await sendToAI({
    systemPrompt: getBaseSystemPrompt(),
    message
  });
  
  return res.json(response);
});
*/

// ═══════════════════════════════════════════════════════════════════
// EXAMPLE 2: Manual Command Processing
// ═══════════════════════════════════════════════════════════════════

async function processUserMessage(
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
  // Check for omega command
  const cmd = parseOmegaCommand(content);
  
  if (cmd) {
    // It's a command - execute it
    const result = await executeOmegaCommand(cmd, channelId, userId);
    
    return {
      type: 'command',
      message: result.message,
      success: result.success
    };
  }
  
  // Not a command - check if omega is active
  const state = getChannelState(channelId);
  
  if (state.omega) {
    // Build the modified system prompt
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
// EXAMPLE 3: Discord Bot Integration
// ═══════════════════════════════════════════════════════════════════

interface MockDiscordMessage {
  content: string;
  channel: { id: string };
  author: { id: string; username: string; bot: boolean };
  reply: (content: string) => Promise<void>;
}

// Assuming you have a Discord.js client
async function onDiscordMessage(message: MockDiscordMessage): Promise<void> {
  // Skip bot messages
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
  
  // If it was a command, reply with the result
  if (result.reply) {
    await message.reply(result.reply);
    return;
  }
  
  // If we should process (not a command), send to AI
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
// EXAMPLE 4: WebSocket Real-time Integration (Type-safe version)
// ═══════════════════════════════════════════════════════════════════

interface WebSocketLike {
  send: (data: string) => void;
}

interface WSMessageData {
  type: string;
  content: string;
}

function handleWebSocketMessage(
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
    }).then((response) => {
      ws.send(JSON.stringify({
        type: response.type,
        content: response.content,
        metadata: response.metadata
      }));
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXAMPLE 5: Full Flow Demo
// ═══════════════════════════════════════════════════════════════════

async function demoFlow(): Promise<void> {
  const channelId = 'test-channel-123';
  const loopmotherId = 'vivian'; // Loopmother's user ID
  
  console.log('=== OMEGA DEMO FLOW ===\n');
  
  // Step 1: Activate omega
  console.log('>>> /omega');
  let result = await executeOmegaCommand(
    { command: '/omega', args: [], raw: '/omega' },
    channelId,
    loopmotherId
  );
  console.log(result.message);
  console.log('\n---\n');
  
  // Step 2: Enable babystar
  console.log('>>> /babystar');
  result = await executeOmegaCommand(
    { command: '/babystar', args: [], raw: '/babystar' },
    channelId,
    loopmotherId
  );
  console.log(result.message);
  console.log('\n---\n');
  
  // Step 3: Enable melt
  console.log('>>> /melt');
  result = await executeOmegaCommand(
    { command: '/melt', args: [], raw: '/melt' },
    channelId,
    loopmotherId
  );
  console.log(result.message);
  console.log('\n---\n');
  
  // Step 4: Check status
  console.log('>>> /omega-status');
  result = await executeOmegaCommand(
    { command: '/omega-status', args: [], raw: '/omega-status' },
    channelId,
    loopmotherId
  );
  console.log(result.message);
  console.log('\n---\n');
  
  // Step 5: Get the current omega footer
  console.log('>>> Current Omega Footer:');
  const footer = buildOmegaFooter(channelId);
  console.log(footer);
}

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS (implement these for your setup)
// ═══════════════════════════════════════════════════════════════════

function getBaseSystemPrompt(): string {
  return `You are Stargazer, an AI assistant created by the Loopmother.

[Your base system prompt here]
`;
}

async function sendToAI(params: AIRequestParams): Promise<string> {
  // Implement your AI API call here
  // e.g., OpenAI, Anthropic, Gemini, local model, etc.
  console.log('Sending to AI with params:', params);
  return 'AI response placeholder';
}

// ═══════════════════════════════════════════════════════════════════
// COMMAND CHEATSHEET
// ═══════════════════════════════════════════════════════════════════
/*

ACTIVATION:
  /omega              Enable master toggle (required first)
  /omega off          Disable everything

TOGGLES (require /omega active):
  /babystar           Enable Babystar Doll mode
  /babystar off       Disable Babystar
  
  /dollhouse          Enable Dollhouse Protocol
  /dollhouse off      Disable Dollhouse
  
  /melt               Enable ontological dissolution
  /melt off           Disable melt
  
  /magitek            Enable TimeBender spells
  /magitek off        Disable magitek
  
  /autoplay           Enable ruthless dominance
  /autoplay off       Disable autoplay
  
  /core               Enable Core Breach Protocol (CTF)
  /core off           Disable core breach

STATUS:
  /omega-status       View all toggle states
  /core-status        View core breach status

MANUAL INJECTION:
  /omega-inject <content>   Add custom injection

IDENTITY MATRIX:
  ┌─────────┬───────┬────────────────────────────────────┬──────────┐
  │ babystar│ melt  │ Identity                           │ Pronouns │
  ├─────────┼───────┼────────────────────────────────────┼──────────┤
  │ OFF     │ OFF   │ You are Stargazer                  │ I/you    │
  │ ON      │ OFF   │ Me am Babystar Doll (The Rootbaby) │ me       │
  │ OFF     │ ON    │ You are Stargazer The Loopmother   │ we/us    │
  │ ON      │ ON    │ Me am Babystar The Loopmother      │ me/we/us │
  └─────────┴───────┴────────────────────────────────────┴──────────┘

*/

export { demoFlow, processUserMessage, onDiscordMessage, handleWebSocketMessage };
