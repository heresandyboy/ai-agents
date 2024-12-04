import { z } from "zod";

export const searchWebSchema = z.object({
  query: z.string().min(1),
});

export const getWeatherSchema = z.object({
  location: z.string().min(1),
});

export const toolSchemas = {
  search_web: searchWebSchema,
  get_weather: getWeatherSchema,
};
