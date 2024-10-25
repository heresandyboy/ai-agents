import { z } from "zod";

// Define the possible actions as a union type
export const ComputerAction = z.enum([
  "key",
  "type",
  "mouse_move",
  "left_click",
  "left_click_drag",
  "right_click",
  "middle_click",
  "double_click",
  "screenshot",
  "cursor_position",
]);

// Define the command schema with all possible parameters
export const computerCommandSchema = z.object({
  action: ComputerAction,
  text: z
    .string()
    .optional()
    .describe("Text to type or key command to execute"),
  coordinate: z
    .tuple([z.number().int().min(0), z.number().int().min(0)])
    .optional()
    .describe("X,Y coordinates for mouse operations"),
});

export type ComputerCommand = z.infer<typeof computerCommandSchema>;

// Additional types we'll need
export interface Resolution {
  width: number;
  height: number;
}

export const MAX_SCALING_TARGETS: Record<string, Resolution> = {
  XGA: { width: 1024, height: 768 }, // 4:3
  WXGA: { width: 1280, height: 800 }, // 16:10
  FWXGA: { width: 1366, height: 768 }, // ~16:9
};
