import { z } from "zod";

// Define the possible actions as an enum
export const ComputerAction = z.enum([
  "key", // For keyboard key presses
  "type", // For typing text
  "mouse_move", // Move mouse to coordinates
  "left_click", // Single left click
  "left_click_drag", // Click and drag
  "right_click", // Single right click
  "middle_click", // Single middle click
  "double_click", // Double left click
  "screenshot", // Take screenshot
  "cursor_position", // Get current cursor position
]);
export type ComputerAction = z.infer<typeof ComputerAction>;

// Define the command schema with all possible parameters
export const computerCommandSchema = z.object({
  action: ComputerAction,
  text: z
    .string()
    .optional()
    .describe("Text to type or key command to execute"),
  coordinate: z
    .tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])
    .optional()
    .describe("X,Y coordinates for mouse operations"),
});
export type ComputerCommand = z.infer<typeof computerCommandSchema>;

// Define the resolution interface
export interface Resolution {
  width: number;
  height: number;
}

// Predefined maximum scaling targets
export const MAX_SCALING_TARGETS: Record<string, Resolution> = {
  XGA: { width: 1024, height: 768 }, // 4:3
  WXGA: { width: 1280, height: 800 }, // 16:10
  FWXGA: { width: 1366, height: 768 }, // ~16:9
};

// Scaling source enum
export enum ScalingSource {
  COMPUTER = "computer",
  API = "api",
}
