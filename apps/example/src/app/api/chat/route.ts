import { type Message as InternalMessage } from "@zen/ai-agent-sdk";
import { StreamData, type Message as AIMessage } from "ai";
import { type NextRequest } from "next/server";
import { createOrchestrator } from "./services/orchestrator";
import { generateUUID } from "./utils/generateUUID";
import { sanitizeForJSON } from "./utils/sanitizeForJSON";

export const runtime = "edge";

export async function POST(req: NextRequest): Promise<Response> {
  const { messages, lastMessage } = await parseIncomingMessages(req);
  const streamingData = new StreamData();
  const userMessageId = addUserMessageId(streamingData);
  notifyStatus(streamingData, "Selecting Agent");
  const stream = createReadableStream(streamingData);
  processInBackground(messages, lastMessage, streamingData);
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

function createReadableStream(streamingData: StreamData): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      await streamingData.stream.pipeTo(
        new WritableStream({ write: (chunk) => controller.enqueue(chunk) })
      );
    },
  });
}

function processInBackground(
  messages: InternalMessage[],
  lastMessage: InternalMessage,
  streamingData: StreamData
): void {
  (async () => {
    const orchestrator = createOrchestrator();
    try {
      const result = await orchestrator.process(lastMessage.content, messages.slice(0, -1), {
        stream: true,
        onUpdate: (status: string) => notifyStatus(streamingData, status),
      });
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
      streamingData.close();
    }
  })();
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

  const decoder = new TextDecoder("utf-8");
  let partialContent = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;
      const [type, data] = line.split(/:(.*)/s, 2);
      const messageType = parseInt(type, 10);
      if (isNaN(messageType)) continue;

      const sanitizedData = sanitizeForJSON(JSON.parse(data));
      switch (messageType) {
        case 0:
          partialContent += sanitizedData;
          streamingData.append({
            type: "text-delta",
            content: { textDelta: sanitizedData },
            id: agentMessageId,
            timestamp: Date.now(),
          });
          break;
        case 1:
          streamingData.append({
            type: "function-call",
            content: sanitizedData,
            id: agentMessageId,
            timestamp: Date.now(),
          });
          break;
        case 2:
          streamingData.append({
            type: "function-result",
            content: sanitizedData,
            id: agentMessageId,
            timestamp: Date.now(),
          });
          break;
      }
    }
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
