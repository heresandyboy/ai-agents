import { Tool } from "./base/Tool";
import { z } from "zod";

const ClassificationSchema = z.object({
  user_input: z.string().describe("The original user input"),
  selectedAgent: z
    .string()
    .nullable()
    .describe("The name of the selected agent"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence level between 0 and 1"),
  reasoning: z.string().describe("The reasoning for the selected agent"),
});

type ClassificationOutput = z.infer<typeof ClassificationSchema>;

export class ClassificationTool extends Tool<
  typeof ClassificationSchema,
  ClassificationOutput
> {
  constructor() {
    super(
      {
        name: "analyzePrompt",
        description: "Analyze the user input and provide structured output",
        version: "1.0.0",
        categories: ["classification"],
        requiresAuth: false,
      },
      ClassificationSchema
    );
  }

  protected async executeValidated(
    params: ClassificationOutput
  ): Promise<ClassificationOutput> {
    // For this tool, just return the params as the result
    return params;
  }
}
