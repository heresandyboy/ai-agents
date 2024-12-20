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
  console.log('Received chat request');

  try {
    const startTime = debug.time('POST request');

    const { messages, lastMessage } = await parseIncomingMessages(req);
    debug.timeEnd('Message parsing', startTime);

    console.log('Chat request payload:', messages);

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

        console.log('Orchestrator response received', { responseType: typeof result });

        const agentMessageId = makeAgentMessageId(streamingData);

        if (result instanceof Response) {
          await handleOpenAIResponse(result, agentMessageId, streamingData);
        } else if ("textStream" in result) {
          await handlePortkeyResponse(result, agentMessageId, streamingData);
        }

        finishStream(streamingData);
      } catch (error) {
        console.error('Error in chat route:', error);
        handleProcessingError(error, streamingData);
      } finally {
        // Ensure we always close the stream
        streamingData.close();
      }
    })();

    debug.log('Initial response sent, background processing started');
    return new Response(stream);
  } catch (error) {
    console.error('Error in chat route:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500 }
    );
  }
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
  console.log('Handling OpenAI response:', {
    type: typeof response,
    isResponse: response instanceof Response,
    hasBody: !!response.body,
    headers: Object.fromEntries(response.headers.entries())
  });

  const reader = response.body?.getReader();
  if (!reader) {
    console.error('No reader available in response body');
    return;
  }

  const decoder = new TextDecoder();
  let partialContent = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        console.log('Stream reading completed');
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      console.log('Received chunk:', { chunk, length: chunk.length });

      const lines = chunk.split('\n');
      console.log('Split into lines:', { lineCount: lines.length });

      for (const line of lines) {
        if (!line.trim()) continue;

        const [type, data] = line.split(/:(.*)/s, 2);
        if (!data) continue;

        const messageType = parseInt(type, 10);
        if (isNaN(messageType)) {
          console.log('Invalid message type:', { type, line });
          continue;
        }

        try {
          const sanitizedData = sanitizeForJSON(JSON.parse(data));
          console.log('Processing message:', {
            type: messageType,
            dataLength: data.length,
            sanitizedData
          });

          // Handle different message types
          switch (messageType) {
            case 5: // Assistant metadata
              streamingData.append({
                type: 'assistant-control',
                id: agentMessageId,
                content: sanitizedData,
                timestamp: Date.now()
              });
              break;
            case 6: // Assistant data messages
              if (sanitizedData.role === 'data') {
                const { type, content } = sanitizedData.data;
                switch (type) {
                  case 'status':
                    streamingData.append({
                      type: 'status',
                      id: agentMessageId,
                      content: { status: sanitizedData.data.status },
                      timestamp: sanitizedData.data.timestamp
                    });
                    break;
                  case 'tool-call':
                    streamingData.append({
                      type: 'tool-call',
                      id: agentMessageId,
                      content: content,
                      timestamp: sanitizedData.data.timestamp
                    });
                    break;
                  case 'tool-result':
                    streamingData.append({
                      type: 'tool-result',
                      id: agentMessageId,
                      content: content,
                      timestamp: sanitizedData.data.timestamp
                    });
                    break;
                  case 'text-delta':
                    streamingData.append({
                      type: 'text-delta',
                      id: agentMessageId,
                      content: { textDelta: content },
                      timestamp: sanitizedData.data.timestamp
                    });
                    break;
                }
              }
              break;
          }
        } catch (parseError) {
          console.error('Error parsing message data:', parseError);
          continue;
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
