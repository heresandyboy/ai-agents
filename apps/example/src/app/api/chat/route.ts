import { type Message as InternalMessage } from "@zen/ai-agent-sdk";
import { StreamData, type Message as AIMessage } from "ai";
import { type NextRequest } from "next/server";
import { createOrchestrator } from "./services/orchestrator";
import { generateUUID } from "./utils/generateUUID";
import { sanitizeForJSON } from "./utils/sanitizeForJSON";

export const runtime = "edge";

// Use Web API performance
const debug = {
  log: (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] ${message}`, data || '');
  },
  time: (label: string) => {
    debug.log(`⏱️ Starting: ${label}`);
    return performance.now(); // Web API performance
  },
  timeEnd: (label: string, startTime: number) => {
    const duration = performance.now() - startTime;
    debug.log(`⏱️ Completed: ${label} (${duration.toFixed(2)}ms)`);
  }
};

export async function POST(req: NextRequest): Promise<Response> {
  const startTime = debug.time('POST request');

  const { messages, lastMessage } = await parseIncomingMessages(req);
  debug.timeEnd('Message parsing', startTime);

  const streamingData = new StreamData();
  const userMessageId = addUserMessageId(streamingData);
  notifyStatus(streamingData, "Selecting Agent");

  // Create and return the stream immediately
  const stream = new ReadableStream({
    async start(controller) {
      streamingData.stream.pipeTo(
        new WritableStream({
          write(chunk) {
            controller.enqueue(chunk);
          },
        })
      );
    },
  });

  // Process in background without blocking the response
  (async () => {
    const processStart = debug.time('Background processing');
    const orchestrator = createOrchestrator();
    debug.timeEnd('Orchestrator creation', processStart);

    try {
      const orchestratorStart = debug.time('Orchestrator processing');
      const result = await orchestrator.process(lastMessage.content, messages.slice(0, -1), {
        stream: true,
        onUpdate: (statusMessage: string) => {
          notifyStatus(streamingData, statusMessage);
        },
      });
      debug.timeEnd('Orchestrator processing', orchestratorStart);

      const agentMessageId = makeAgentMessageId(streamingData);

      if (result instanceof Response) {
        await handleOpenAIResponse(result, agentMessageId, streamingData);
      } else if ("textStream" in result) {
        await handlePortkeyResponse(result, agentMessageId, streamingData);
      }

      finishStream(streamingData);
    } catch (error) {
      handleProcessingError(error, streamingData);
    } finally {
      // Ensure we always close the stream
      streamingData.close();
    }
  })();

  debug.log('Initial response sent, background processing started');
  return new Response(stream);
}

async function parseIncomingMessages(
  req: NextRequest
): Promise<{ messages: InternalMessage[]; lastMessage: InternalMessage }> {
  const { messages: rawMessages } = await req.json();
  const aiMessages = rawMessages as AIMessage[];

  // Convert Vercel AI SDK messages to internal format with proper typing
  const internalMessages: InternalMessage[] = aiMessages.map((msg): InternalMessage => ({
    role: msg.role,
    content: msg.content,
    name: msg.name,
    function_call: msg.toolInvocations?.[0]
  }));

  return {
    messages: internalMessages,
    lastMessage: internalMessages[internalMessages.length - 1],
  };
}

function addUserMessageId(streamingData: StreamData): string {
  const id = generateUUID();
  streamingData.append({
    type: "user-message-id",
    content: id,
    timestamp: Date.now(),
  });
  return id;
}

function notifyStatus(streamingData: StreamData, status: string): void {
  streamingData.append({ type: "status", status, timestamp: Date.now() });
}

function makeAgentMessageId(streamingData: StreamData): string {
  const id = generateUUID();
  streamingData.append({
    type: "agent-message-id",
    content: id,
    timestamp: Date.now(),
  });
  return id;
}

async function handleOpenAIResponse(
  response: Response,
  agentMessageId: string,
  streamingData: StreamData
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let partialContent = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        const [type, data] = line.split(/:(.*)/s, 2);
        if (!data) continue;

        const messageType = parseInt(type, 10);
        if (isNaN(messageType)) continue;

        try {
          const sanitizedData = sanitizeForJSON(JSON.parse(data));

          switch (messageType) {
            case 0: // Text content
              partialContent += sanitizedData;
              streamingData.append({
                type: 'text-delta',
                content: { textDelta: sanitizedData },
                id: agentMessageId,
                timestamp: Date.now()
              });
              break;
            case 1: // Function calls
              streamingData.append({
                type: 'function-call',
                content: sanitizedData,
                id: agentMessageId,
                timestamp: Date.now()
              });
              break;
            case 2: // Function results
              streamingData.append({
                type: 'function-result',
                content: sanitizedData,
                id: agentMessageId,
                timestamp: Date.now()
              });
              break;
          }
        } catch (parseError) {
          console.error('Error parsing message data:', parseError);
          continue; // Skip this message but continue processing
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function handlePortkeyResponse(
  result: { fullStream: AsyncIterable<any>; textStream: AsyncIterable<any> },
  agentMessageId: string,
  streamingData: StreamData
): Promise<void> {
  for await (const part of result.fullStream) {
    const sanitizedPart = sanitizeForJSON(part);
    streamingData.append({
      type: part.type,
      content: sanitizedPart,
      id: agentMessageId,
      timestamp: Date.now(),
    });
  }
}

function finishStream(streamingData: StreamData): void {
  streamingData.append({ type: "finish", timestamp: Date.now() });
}

function handleProcessingError(error: unknown, streamingData: StreamData): void {
  console.error("Error processing request:", error);
  streamingData.append({
    type: "error",
    error: "An error occurred processing your request",
  });
}
