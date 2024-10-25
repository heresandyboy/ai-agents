import { z } from "zod";

export const bashCommandSchema = z.object({
  command: z.string().describe("The bash command to execute"),
});

export type BashCommand = z.infer<typeof bashCommandSchema>;
