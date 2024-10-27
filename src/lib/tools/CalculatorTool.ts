import { z } from "zod";
import { BaseTool } from "./base/BaseTool";

const CalculatorSchema = z.object({
  operation: z.enum(["add", "subtract", "multiply", "divide"]),
  a: z.number(),
  b: z.number(),
});

export class CalculatorTool extends BaseTool<typeof CalculatorSchema> {
  constructor() {
    super(
      {
        name: "calculator",
        description: "Perform basic mathematical operations",
        categories: ["math"],
        version: "1.0.0",
        requiresAuth: false,
      },
      CalculatorSchema
    );
  }

  protected async execute(
    params: z.infer<typeof CalculatorSchema>
  ): Promise<number> {
    const { operation, a, b } = params;

    switch (operation) {
      case "add":
        return a + b;
      case "subtract":
        return a - b;
      case "multiply":
        return a * b;
      case "divide":
        if (b === 0) throw new Error("Division by zero");
        return a / b;
    }
  }
}
