import { toolSchemas } from "@/schemas/tools";

export const tools = {
  searchWeb: {
    description: "Search the web for current information",
    parameters: toolSchemas.search_web,
    execute: async ({ query }: { query: string }) => {
      // This is a mock implementation
      return `Results for "${query}" on the web.`;
    },
  },
  getWeather: {
    description: "Get current weather for a location",
    parameters: toolSchemas.get_weather,
    execute: async ({ location }: { location: string }) => {
      const weatherOptions = ["sunny", "cloudy", "rainy"];
      const randomWeather =
        weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
      return `The weather in ${location} is currently ${randomWeather}.`;
    },
  },
};
