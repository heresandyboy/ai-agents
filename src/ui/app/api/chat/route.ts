import { NextRequest } from "next/server";
import { streamText, convertToCoreMessages } from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const coreMessages = convertToCoreMessages(messages);

  const response = await streamText({
    model: openai("gpt-4"),
    messages: coreMessages,
    tools: {
      getWeather: {
        description: "Get the current weather at a location",
        parameters: z.object({
          latitude: z.number(),
          longitude: z.number(),
        }),
        execute: async ({ latitude, longitude }) => {
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`
          );

          const weatherData = await response.json();
          return weatherData;
        },
      },
      // Add other tools if needed
    },
    maxSteps: 5,
  });

  return response.toDataStreamResponse();
}
