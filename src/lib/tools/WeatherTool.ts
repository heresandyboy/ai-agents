import { Tool } from "./base/Tool";
import { z } from "zod";
// import fetch from "node-fetch"; // Ensure you have node-fetch installed or use the appropriate fetch method
import debug from "debug";

const log = debug("tools:weather");

const WeatherSchema = z.object({
  latitude: z.number().describe("The latitude of the location"),
  longitude: z.number().describe("The longitude of the location"),
});

type WeatherParams = z.infer<typeof WeatherSchema>;

export class WeatherTool extends Tool<typeof WeatherSchema, any> {
  constructor() {
    super(
      {
        name: "getWeather",
        description: "Get the current weather at a location",
        categories: ["weather"],
        version: "1.0.0",
        requiresAuth: false,
      },
      WeatherSchema
    );
  }

  protected async executeValidated(params: WeatherParams): Promise<any> {
    const { latitude, longitude } = params;
    log(`Fetching weather information for: ${latitude}, ${longitude}`);

    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.statusText}`);
      }

      const weatherData = await response.json();

      return weatherData;
    } catch (error) {
      log(`Error fetching weather data: ${error}`);
      throw new Error(
        `Failed to get weather data for location: ${latitude}, ${longitude}`
      );
    }
  }
}
