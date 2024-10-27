import { tool } from "ai";
import {
  computerCommandSchema,
  ComputerCommand,
  ComputerAction,
  MAX_SCALING_TARGETS,
  Resolution,
  ScalingSource,
} from "./computer.schema";
import { exec, execSync } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import screenshot from "screenshot-desktop";
import { Hardware } from "keysender";

const execAsync = promisify(exec);

// Helper function to split strings into chunks
function chunks(s: string, chunkSize: number): string[] {
  return s.match(new RegExp(`.{1,${chunkSize}}`, "g")) || [];
}

class ComputerToolImplementation {
  private width: number;
  private height: number;
  private displayNum: number | null;
  private scalingEnabled = true;
  private screenshotDelay = 2000; // In milliseconds
  private displayPrefix: string;
  public isWindows: boolean;
  private typingDelayMs = 12;
  private typingGroupSize = 50;
  private useNodeScreenshot = true; // New flag to toggle screenshot library
  private hardware = new Hardware(0);

  constructor(screenshotDelay?: number) {
    this.width = parseInt(process.env.WIDTH || "0", 10);
    this.height = parseInt(process.env.HEIGHT || "0", 10);

    if (!this.width || !this.height) {
      throw new Error("WIDTH and HEIGHT environment variables must be set");
    }

    const displayNum = process.env.DISPLAY_NUM;
    this.displayNum = displayNum ? parseInt(displayNum, 10) : null;
    this.displayPrefix =
      this.displayNum !== null ? `DISPLAY=:${this.displayNum} ` : "";

    this.isWindows = os.platform() === "win32";

    // Initialize Hardware with window handle 0 for global control
    this.hardware = new Hardware(0);

    this.screenshotDelay = screenshotDelay || 2000;
  }

  // Public method to execute commands
  async execute(
    command: ComputerCommand
  ): Promise<{ result: string; base64Image?: string }> {
    const { action, text, coordinate } = command;
    console.log(`Executing action: ${action}`);

    // Validate parameters based on action
    this.validateParameters(action, text, coordinate);

    try {
      switch (action) {
        case "key":
          return await this.handleKeyAction(text!);

        case "type":
          return await this.handleTypeAction(text!);

        case "mouse_move":
          return await this.handleMouseMoveAction(coordinate!);

        case "left_click":
        case "right_click":
        case "middle_click":
          // Match Python's click handling
          const clickMap = {
            left_click: "left",
            right_click: "right",
            middle_click: "middle",
          } as const;
          // If coordinates are provided, move first then click
          if (coordinate) {
            await this.handleMouseMoveAction(coordinate);
          }
          return await this.handleMouseClickAction(clickMap[action]);

        case "double_click":
          if (coordinate) {
            await this.handleMouseMoveAction(coordinate);
          }
          return await this.handleDoubleClickAction();

        case "left_click_drag":
          return await this.handleLeftClickDragAction(coordinate!);

        case "screenshot":
          return await this.handleScreenshotAction();

        case "cursor_position":
          return await this.handleCursorPositionAction();

        default:
          throw new Error(`Invalid action: ${action}`);
      }
    } catch (error) {
      throw new Error(`Failed to execute ${action}: ${error}`);
    }
  }

  // Validate input parameters
  private validateParameters(
    action: ComputerAction,
    text?: string,
    coordinate?: [number, number]
  ): void {
    if (["key", "type"].includes(action)) {
      if (!text) {
        throw new Error(`'text' parameter is required for action '${action}'`);
      }
    } else if (["mouse_move", "left_click_drag"].includes(action)) {
      if (!coordinate) {
        throw new Error(
          `'coordinate' parameter is required for action '${action}'`
        );
      }
    }

    // Allow coordinates for click actions, but they're optional
    if (
      ["left_click", "right_click", "middle_click", "double_click"].includes(
        action
      )
    ) {
      // Coordinates are optional for these actions
      if (text) {
        throw new Error(
          `'text' parameter is not accepted for action '${action}'`
        );
      }
    } else if (["screenshot", "cursor_position"].includes(action)) {
      if (coordinate || text) {
        throw new Error(
          `'coordinate' and 'text' parameters are not accepted for action '${action}'`
        );
      }
    }
  }

  // Handle 'key' action
  private async handleKeyAction(
    text: string
  ): Promise<{ result: string; base64Image?: string }> {
    await this.executeShellCommand(this.getKeyCommand(text));
    const base64Image = await this.takeScreenshotWithDelay();
    return { result: `Executed key action with text: ${text}`, base64Image };
  }

  // Handle 'type' action
  private async handleTypeAction(
    text: string
  ): Promise<{ result: string; base64Image?: string }> {
    const textChunks = chunks(text, this.typingGroupSize);

    for (const chunk of textChunks) {
      await this.executeShellCommand(this.getTypeCommand(chunk));
    }

    const base64Image = await this.takeScreenshotWithDelay();
    return { result: `Typed text: ${text}`, base64Image };
  }

  // Handle 'mouse_move' action
  private async handleMouseMoveAction(
    coordinate: [number, number]
  ): Promise<{ result: string; base64Image?: string }> {
    const [x, y] = this.scaleCoordinates(
      ScalingSource.API,
      coordinate[0],
      coordinate[1]
    );

    try {
      await this.hardware.mouse.moveTo(x, y);
    } catch (error) {
      throw new Error(`Failed to move mouse: ${error}`);
    }

    const base64Image = await this.takeScreenshotWithDelay();
    return { result: `Moved mouse to coordinates (${x}, ${y})`, base64Image };
  }

  // Handle mouse click actions
  private async handleMouseClickAction(
    button: "left" | "right" | "middle"
  ): Promise<{ result: string; base64Image?: string }> {
    console.log(`🖱️ Executing ${button} click`);

    try {
      await this.hardware.mouse.click(button);
    } catch (error) {
      throw new Error(`Failed to perform mouse click: ${error}`);
    }

    const base64Image = await this.takeScreenshotWithDelay();
    return { result: `Performed ${button} click`, base64Image };
  }

  // Handle 'double_click' action
  private async handleDoubleClickAction(): Promise<{
    result: string;
    base64Image?: string;
  }> {
    try {
      await this.hardware.mouse.click("left", 2); // Second parameter specifies click count
    } catch (error) {
      throw new Error(`Failed to perform double click: ${error}`);
    }

    const base64Image = await this.takeScreenshotWithDelay();
    return { result: "Performed double click", base64Image };
  }

  // Handle 'left_click_drag' action
  private async handleLeftClickDragAction(
    coordinate: [number, number]
  ): Promise<{ result: string; base64Image?: string }> {
    const [x, y] = this.scaleCoordinates(
      ScalingSource.API,
      coordinate[0],
      coordinate[1]
    );

    try {
      await this.hardware.mouse.toggle("left", true); // Press left button
      await this.hardware.mouse.moveTo(x, y); // Move to target
      await this.hardware.mouse.toggle("left", false); // Release left button
    } catch (error) {
      throw new Error(`Failed to perform drag action: ${error}`);
    }

    const base64Image = await this.takeScreenshotWithDelay();
    return { result: `Dragged to coordinates (${x}, ${y})`, base64Image };
  }

  // Handle 'screenshot' action
  private async handleScreenshotAction(): Promise<{
    result: string;
    base64Image?: string;
  }> {
    const base64Image = await this.takeScreenshot();
    return { result: "Screenshot taken", base64Image };
  }

  // Handle 'cursor_position' action
  private async handleCursorPositionAction(): Promise<{ result: string }> {
    const [x, y] = await this.getCursorPosition();
    return { result: `X=${x},Y=${y}` };
  }

  // Take screenshot with delay
  private async takeScreenshotWithDelay(): Promise<string> {
    // Avoid delay during testing
    const delay = process.env.NODE_ENV === "test" ? 0 : this.screenshotDelay;
    await new Promise((resolve) => setTimeout(resolve, delay));
    const screenshotResult = await this.handleScreenshotAction();
    return screenshotResult.base64Image!;
  }

  // Delay utility function
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Take a screenshot and return base64 encoded image
  private async takeScreenshot(): Promise<string> {
    const outputDir = path.join(os.tmpdir(), "outputs");
    const filename = `screenshot_${Date.now()}.png`;
    const filepath = path.join(outputDir, filename);

    // Add new path for original screenshot
    const originalFilepath = path.join(outputDir, `original_${filename}`);

    try {
      await fs.mkdir(outputDir, { recursive: true });

      // Take full resolution screenshot first
      const screenshotCommand = await this.getScreenshotCommand(filepath);
      if (screenshotCommand) {
        await execAsync(screenshotCommand);
      } else if (this.useNodeScreenshot) {
        // If no command was returned, it means we used the screenshot library
        // Copy the original file before resizing
        await fs.copyFile(filepath, originalFilepath);
        console.log(`Original screenshot saved to: ${originalFilepath}`);
      }

      // Add a longer delay to ensure the file is written
      // await this.delay(1000);

      if (this.scalingEnabled) {
        const [targetWidth, targetHeight] = this.scaleCoordinates(
          ScalingSource.COMPUTER,
          this.width,
          this.height
        );

        // Updated ImageMagick command to match Python version's behavior
        const resizeCommand = this.isWindows
          ? `magick "${filepath}" -resize ${targetWidth}x${targetHeight} -gravity center -extent ${targetWidth}x${targetHeight} "${filepath}"`
          : `convert "${filepath}" -resize ${targetWidth}x${targetHeight}! "${filepath}"`;

        await execAsync(resizeCommand);
        // Add a small delay after resize
        await this.delay(500);
      }

      const imageBuffer = await fs.readFile(filepath);
      return imageBuffer.toString("base64");
    } catch (error) {
      console.error("Screenshot error details:", error);
      throw new Error(`Failed to take screenshot: ${error}`);
    } finally {
      try {
        // await fs.unlink(filepath);
        // await fs.unlink(originalFilepath);  // Uncomment if you want to clean up original files too
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  // Execute a shell command
  private async executeShellCommand(command: string): Promise<void> {
    await execAsync(command);
  }

  // Scale coordinates based on scaling settings
  private scaleCoordinates(
    source: ScalingSource,
    x: number,
    y: number
  ): [number, number] {
    if (!this.scalingEnabled) {
      return [x, y];
    }

    const ratio = this.width / this.height;
    let targetDimension: Resolution | null = null;

    for (const dimension of Object.values(MAX_SCALING_TARGETS)) {
      if (Math.abs(dimension.width / dimension.height - ratio) < 0.02) {
        if (dimension.width < this.width) {
          targetDimension = dimension;
          break;
        }
      }
    }

    if (!targetDimension) {
      return [x, y];
    }

    const xScalingFactor = targetDimension.width / this.width;
    const yScalingFactor = targetDimension.height / this.height;

    if (source === ScalingSource.API) {
      if (x > this.width || y > this.height) {
        throw new Error(`Coordinates ${x}, ${y} are out of bounds`);
      }
      // Scale up
      return [Math.round(x / xScalingFactor), Math.round(y / yScalingFactor)];
    }

    // Scale down
    return [Math.round(x * xScalingFactor), Math.round(y * yScalingFactor)];
  }

  // Get cursor position
  private async getCursorPosition(): Promise<[number, number]> {
    try {
      // Get cursor position using keysender's Hardware class
      const position = this.hardware.mouse.getPos();
      const x = position.x;
      const y = position.y;

      // Only scale if we got valid numbers
      if (!isNaN(x) && !isNaN(y)) {
        return this.scaleCoordinates(ScalingSource.COMPUTER, x, y);
      }

      throw new Error(`Invalid cursor position: x=${x}, y=${y}`);
    } catch (error) {
      console.error("Error getting cursor position:", error);
      throw error;
    }
  }

  // Command builders for different actions

  // Build command for 'key' action
  private getKeyCommand(text: string): string {
    if (this.isWindows) {
      const script = `
        $shell = New-Object -ComObject WScript.Shell
        $shell.SendKeys("${text}")
      `;
      return `powershell -command "${script}"`;
    } else {
      return `${this.displayPrefix}xdotool key -- ${text}`;
    }
  }

  // Build command for 'type' action
  private getTypeCommand(textChunk: string): string {
    if (this.isWindows) {
      const script = `
        $shell = New-Object -ComObject WScript.Shell
        $shell.SendKeys("${textChunk}")
      `;
      return `powershell -command "${script}"`;
    } else {
      return `${this.displayPrefix}xdotool type --delay ${this.typingDelayMs} -- ${textChunk}`;
    }
  }

  // Build command for 'screenshot' action
  private async getScreenshotCommand(filepath: string): Promise<string | void> {
    if (this.useNodeScreenshot) {
      try {
        await screenshot({ filename: filepath });
        return;
      } catch (error) {
        console.error("Failed to take screenshot with node-screenshot:", error);
        // Fall back to original methods if node-screenshot fails
        return this.getLegacyScreenshotCommand(filepath);
      }
    }
    return this.getLegacyScreenshotCommand(filepath);
  }

  // Renamed original screenshot method
  private getLegacyScreenshotCommand(filepath: string): string {
    if (this.isWindows) {
      return `powershell -command "Add-Type -AssemblyName System.Drawing; Add-Type -AssemblyName System.Windows.Forms; $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height); $graphics = [System.Drawing.Graphics]::FromImage($bitmap); $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size); $bitmap.Save('${filepath}'); $graphics.Dispose(); $bitmap.Dispose();"`;
    } else {
      // Try gnome-screenshot first
      const gnomeScreenshotAvailable = !!execSync(
        "command -v gnome-screenshot",
        { encoding: "utf8" }
      ).trim();
      if (gnomeScreenshotAvailable) {
        return `${this.displayPrefix}gnome-screenshot -f ${filepath} -p`;
      } else {
        // Fall back to scrot
        return `${this.displayPrefix}scrot -p ${filepath}`;
      }
    }
  }
}

// Create the Vercel AI SDK compatible tool
export const computerTool = tool({
  // toolName: "computer",
  description:
    "Interact with the computer screen, keyboard, and mouse. The tool parameters are defined by Anthropic and are not editable.",
  parameters: computerCommandSchema,
  execute: async (params: ComputerCommand) => {
    const computerTool = new ComputerToolImplementation();
    return computerTool.execute(params);
  },
});

export { ComputerToolImplementation };
