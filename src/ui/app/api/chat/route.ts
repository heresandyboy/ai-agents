import { NextRequest } from "next/server";
import { streamText } from "ai";
import { tools } from "@/lib/tools";
import { openai } from "@ai-sdk/openai";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const response = await streamText({
    model: openai("gpt-4o-mini"),
    messages,
    tools,
    maxSteps: 5,
  });

  return response.toDataStreamResponse();
}
