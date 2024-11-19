import { z } from "zod";
import { Tool } from "./base/Tool";
import debug from "debug";
import { ToolError } from "./errors/ToolError";

const log = debug("tools:calculator");

const CalculatorSchema = z.object({
  operation: z
    .enum(["add", "subtract", "multiply", "divide"])
    .describe("The mathematical operation to perform"),
  a: z.number().describe("The first number in the operation"),
  b: z.number().describe("The second number in the operation"),
});

type CalculatorParams = z.infer<typeof CalculatorSchema>;

export class CalculatorTool extends Tool<typeof CalculatorSchema, number> {
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

  protected async executeValidated(params: CalculatorParams): Promise<number> {
    const { operation, a, b } = params;
    log(`Executing ${operation} operation with a=${a}, b=${b}`);

    switch (operation) {
      case "add":
        return a + b;
      case "subtract":
        return a - b;
      case "multiply":
        return a * b;
      case "divide":
        if (b === 0) {
          throw new ToolError("Division by zero");
        }
        return a / b;
    }
  }
}
