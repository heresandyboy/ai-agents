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

const execAsync = promisify(exec);

// ToolResult interface to match the Python ToolResult
interface ToolResult {
  output?: string;
  error?: string;
  base64_image?: string;
}

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
  private isWindows: boolean;
  private typingDelayMs = 12;
  private typingGroupSize = 50;

  constructor() {
    // Get display dimensions from env
    this.width = parseInt(process.env.WIDTH || "0", 10);
    this.height = parseInt(process.env.HEIGHT || "0", 10);

    // Validate dimensions
    if (!this.width || !this.height) {
      throw new Error("WIDTH and HEIGHT environment variables must be set");
    }
    console.log(
      `📐 Configured display dimensions: ${this.width}x${this.height}`
    );

    // Set up display
    const displayNum = process.env.DISPLAY_NUM;
    this.displayNum = displayNum ? parseInt(displayNum, 10) : null;
    this.displayPrefix =
      this.displayNum !== null ? `DISPLAY=:${this.displayNum} ` : "";
    console.log(`🖥️ Using display: ${this.displayPrefix || "default"}`);

    this.isWindows = os.platform() === "win32";
  }

  // Public method to execute commands
  async execute(
    command: ComputerCommand
  ): Promise<{ result: string; base64Image?: string }> {
    console.log("\n🖥️ ComputerTool: Executing command", command);
    const { action, text, coordinate } = command;

    console.log("🔍 Validating parameters...");
    this.validateParameters(action, text, coordinate);

    try {
      console.log(`⚡ Executing action: ${action}`);
      switch (action) {
        case "key":
          return await this.handleKeyAction(text!);

        case "type":
          return await this.handleTypeAction(text!);

        case "mouse_move":
          return await this.handleMouseMoveAction(coordinate!);

        case "left_click":
          return await this.handleMouseClickAction("left");

        case "right_click":
          return await this.handleMouseClickAction("right");

        case "middle_click":
          return await this.handleMouseClickAction("middle");

        case "double_click":
          return await this.handleDoubleClickAction();

        case "left_click_drag":
          return await this.handleLeftClickDragAction(coordinate!);

        case "screenshot":
          return await this.handleScreenshotAction();

        case "cursor_position":
          return await this.handleCursorPositionAction();

        default:
          throw new Error(`Unsupported action: ${action}`);
      }
    } catch (error) {
      console.error(`❌ Failed to execute ${action}:`, error);
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
      if (coordinate) {
        throw new Error(
          `'coordinate' parameter is not accepted for action '${action}'`
        );
      }
    } else if (["mouse_move", "left_click_drag"].includes(action)) {
      if (!coordinate) {
        throw new Error(
          `'coordinate' parameter is required for action '${action}'`
        );
      }
      if (text) {
        throw new Error(
          `'text' parameter is not accepted for action '${action}'`
        );
      }
    } else if (
      [
        "left_click",
        "right_click",
        "middle_click",
        "double_click",
        "screenshot",
        "cursor_position",
      ].includes(action)
    ) {
      if (coordinate) {
        throw new Error(
          `'coordinate' parameter is not accepted for action '${action}'`
        );
      }
      if (text) {
        throw new Error(
          `'text' parameter is not accepted for action '${action}'`
        );
      }
    } else {
      throw new Error(`Invalid action: ${action}`);
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
    console.log(`🖱️ Moving mouse to coordinates: ${coordinate}`);

    const [x, y] = this.scaleCoordinates(
      ScalingSource.API,
      coordinate[0],
      coordinate[1]
    );

    console.log(`📏 Scaled coordinates: ${x}, ${y}`);

    if (this.isWindows) {
      const command = `powershell -command "
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x},${y})
        $pos = [System.Windows.Forms.Cursor]::Position
        Write-Output \"Actual position: $($pos.X),$($pos.Y)\"
      "`;

      await this.executeShellCommand(command);
    } else {
      await this.executeShellCommand(this.getMouseMoveCommand(x, y));
    }

    const base64Image = await this.takeScreenshotWithDelay();
    return { result: `Moved mouse to coordinates (${x}, ${y})`, base64Image };
  }

  // Handle mouse click actions
  private async handleMouseClickAction(
    button: "left" | "right" | "middle"
  ): Promise<{ result: string }> {
    console.log(`🖱️ Executing ${button} click`);

    if (this.isWindows) {
      const buttonMap = {
        left: "mouse_event(0x2 | 0x4, 0, 0, 0, 0)", // MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_LEFTUP
        right: "mouse_event(0x8 | 0x10, 0, 0, 0, 0)", // MOUSEEVENTF_RIGHTDOWN | MOUSEEVENTF_RIGHTUP
        middle: "mouse_event(0x20 | 0x40, 0, 0, 0, 0)", // MOUSEEVENTF_MIDDLEDOWN | MOUSEEVENTF_MIDDLEUP
      };

      const command = `powershell -command "
        Add-Type -TypeDefinition @'
        using System;
        using System.Runtime.InteropServices;
        public class MouseOperations {
          [DllImport(\"user32.dll\")]
          public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
        }
      '@
        [MouseOperations]::${buttonMap[button]}
      "`;

      await this.executeShellCommand(command);
      return { result: `Performed ${button} click` };
    } else {
      // Linux/Mac implementation using displayPrefix directly
      const clickArg = {
        left: "1",
        right: "3",
        middle: "2",
      }[button];

      await this.executeShellCommand(
        `${this.displayPrefix}xdotool click ${clickArg}`
      );
      return { result: `Performed ${button} click` };
    }
  }

  // Handle 'double_click' action
  private async handleDoubleClickAction(): Promise<{
    result: string;
    base64Image?: string;
  }> {
    await this.executeShellCommand(this.getDoubleClickCommand());
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
    await this.executeShellCommand(this.getLeftClickDragCommand(x, y));
    const base64Image = await this.takeScreenshotWithDelay();
    return {
      result: `Performed left click drag to coordinates (${x}, ${y})`,
      base64Image,
    };
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
    await this.delay(this.screenshotDelay);
    return await this.takeScreenshot();
  }

  // Delay utility function
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Take a screenshot and return base64 encoded image
  private async takeScreenshot(): Promise<string> {
    console.log("📸 Taking screenshot...");
    const outputDir = path.join(os.tmpdir(), "outputs");
    const filename = `screenshot_${Date.now()}.png`;
    const filepath = path.join(outputDir, filename);

    try {
      await fs.mkdir(outputDir, { recursive: true });
      console.log("📁 Created output directory:", outputDir);

      const screenshotCommand = this.getScreenshotCommand(filepath);
      console.log("📷 Executing screenshot command:", screenshotCommand);

      const { stdout, stderr } = await execAsync(screenshotCommand);
      if (stderr) {
        console.error("⚠️ Screenshot command stderr:", stderr);
      }

      // Verify the file exists before proceeding
      await fs.access(filepath);
      console.log("✅ Screenshot file created successfully");

      if (this.scalingEnabled) {
        console.log("🔄 Scaling screenshot...");
        const [x, y] = this.scaleCoordinates(
          ScalingSource.COMPUTER,
          this.width,
          this.height
        );

        const resizeCommand = this.isWindows
          ? `magick "${filepath}" -resize ${x}x${y}! "${filepath}"`
          : `convert "${filepath}" -resize ${x}x${y}! "${filepath}"`;

        console.log("🖼️ Resizing image:", resizeCommand);
        await execAsync(resizeCommand);
      }

      const imageBuffer = await fs.readFile(filepath);
      console.log("✅ Screenshot taken and processed successfully");
      return imageBuffer.toString("base64");
    } catch (error) {
      console.error("❌ Failed to take screenshot:", error);
      throw new Error(`Failed to take screenshot: ${error}`);
    } finally {
      try {
        // await fs.unlink(filepath);
        console.log("🗑️ Cleaned up temporary screenshot file");
      } catch (error) {
        console.error(
          "❌ Failed to clean up temporary screenshot file:",
          error
        );
        // Ignore cleanup errors
      }
    }
  }

  // Execute a shell command
  private async executeShellCommand(command: string): Promise<void> {
    console.log("🔧 Executing shell command:", command);
    try {
      await execAsync(command);
      console.log("✅ Shell command completed successfully");
    } catch (error) {
      console.error("❌ Shell command failed:", error);
      throw error;
    }
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
    if (this.isWindows) {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $pos = [System.Windows.Forms.Cursor]::Position
        Write-Output "$($pos.X) $($pos.Y)"
      `;
      const { stdout } = await execAsync(`powershell -command "${script}"`);
      const [xStr, yStr] = stdout.trim().split(" ");
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);
      return this.scaleCoordinates(ScalingSource.COMPUTER, x, y);
    } else {
      const { stdout } = await execAsync(
        `${this.displayPrefix}xdotool getmouselocation --shell`
      );
      const xMatch = stdout.match(/X=(\d+)/);
      const yMatch = stdout.match(/Y=(\d+)/);
      const x = xMatch ? parseInt(xMatch[1], 10) : 0;
      const y = yMatch ? parseInt(yMatch[1], 10) : 0;
      return this.scaleCoordinates(ScalingSource.COMPUTER, x, y);
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

  // Build command for 'mouse_move' action
  private getMouseMoveCommand(x: number, y: number): string {
    if (this.isWindows) {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x},${y})
      `;
      return `powershell -command "${script}"`;
    } else {
      return `${this.displayPrefix}xdotool mousemove --sync ${x} ${y}`;
    }
  }

  // Build command for mouse click actions
  private getMouseClickCommand(button: "left" | "right" | "middle"): string {
    if (this.isWindows) {
      const buttonMapping: Record<string, string> = {
        left: "Left",
        right: "Right",
        middle: "Middle",
      };
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $pos = [System.Windows.Forms.Cursor]::Position
        [System.Windows.Forms.SendKeys]::SendWait("{${buttonMapping[button]} Click}")
      `;
      return `powershell -command "${script}"`;
    } else {
      const buttonCode: Record<string, number> = {
        left: 1,
        right: 3,
        middle: 2,
      };
      return `${this.displayPrefix}xdotool click ${buttonCode[button]}`;
    }
  }

  // Build command for 'double_click' action
  private getDoubleClickCommand(): string {
    if (this.isWindows) {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $pos = [System.Windows.Forms.Cursor]::Position
        [System.Windows.Forms.SendKeys]::SendWait("{LEFTCLICK}{LEFTCLICK}")
      `;
      return `powershell -command "${script}"`;
    } else {
      return `${this.displayPrefix}xdotool click --repeat 2 --delay 500 1`;
    }
  }

  // Build command for 'left_click_drag' action
  private getLeftClickDragCommand(x: number, y: number): string {
    if (this.isWindows) {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $startPos = [System.Windows.Forms.Cursor]::Position
        [System.Windows.Forms.Control]::MouseButtonsDown += [System.Windows.Forms.MouseButtons]::Left
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x},${y})
        [System.Windows.Forms.Control]::MouseButtonsDown -= [System.Windows.Forms.MouseButtons]::Left
      `;
      return `powershell -command "${script}"`;
    } else {
      return `${this.displayPrefix}xdotool mousedown 1 mousemove --sync ${x} ${y} mouseup 1`;
    }
  }

  // Build command for 'screenshot' action
  private getScreenshotCommand(filepath: string): string {
    if (this.isWindows) {
      // Updated Windows screenshot command with better error handling and file path escaping
      return `powershell -command "
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        
        try {
          $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
          $bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
          $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
          
          $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
          $bitmap.Save('${filepath.replace(/\\/g, "\\\\")}')
          
          $graphics.Dispose()
          $bitmap.Dispose()
          
          Write-Output 'Screenshot saved successfully'
        } catch {
          Write-Error $_.Exception.Message
          exit 1
        }
      "`;
    } else {
      // Linux implementation remains the same
      try {
        if (execSync("command -v maim", { encoding: "utf8" }).trim()) {
          return `${this.displayPrefix}maim -g ${this.width}x${this.height}+0+0 "${filepath}"`;
        } else if (
          execSync("command -v gnome-screenshot", { encoding: "utf8" }).trim()
        ) {
          return `${this.displayPrefix}gnome-screenshot -f "${filepath}"`;
        } else {
          return `${this.displayPrefix}scrot -a 0,0,${this.width},${this.height} "${filepath}"`;
        }
      } catch {
        return `${this.displayPrefix}scrot -a 0,0,${this.width},${this.height} "${filepath}"`;
      }
    }
  }
}

// Create the Vercel AI SDK compatible tool
export const computerTool = tool({
  // name: "computer",
  description:
    "Interact with the computer screen, keyboard, and mouse. The tool parameters are defined by Anthropic and are not editable.",
  parameters: computerCommandSchema,
  execute: async (params: ComputerCommand) => {
    const computerTool = new ComputerToolImplementation();
    return computerTool.execute(params);
  },
});
