import { tool } from "ai";
import { computerCommandSchema, type ComputerCommand, MAX_SCALING_TARGETS } from "./computer.schema";
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

class ComputerToolImplementation {
  private width: number;
  private height: number;
  private displayNum: number | null;
  private scalingEnabled = true;
  private screenshotDelay = 2000; // 2 seconds in milliseconds
  private displayPrefix: string;

  constructor() {
    this.width = parseInt(process.env.WIDTH || '0', 10);
    this.height = parseInt(process.env.HEIGHT || '0', 10);
    
    if (!this.width || !this.height) {
      throw new Error('WIDTH and HEIGHT environment variables must be set');
    }

    const displayNum = process.env.DISPLAY_NUM;
    this.displayNum = displayNum ? parseInt(displayNum, 10) : null;
    this.displayPrefix = this.displayNum !== null ? `DISPLAY=:${this.displayNum} ` : '';
  }

  private async takeScreenshot(): Promise<string> {
    const outputDir = '/tmp/outputs';
    const filename = `screenshot_${Date.now()}.png`;
    const filepath = path.join(outputDir, filename);

    try {
      await fs.mkdir(outputDir, { recursive: true });
      
      // Try gnome-screenshot first, fall back to scrot
      try {
        await execAsync(`${this.displayPrefix}gnome-screenshot -f ${filepath} -p`);
      } catch {
        await execAsync(`${this.displayPrefix}scrot -p ${filepath}`);
      }

      if (this.scalingEnabled) {
        const [x, y] = this.scaleCoordinates('computer', this.width, this.height);
        await execAsync(`convert ${filepath} -resize ${x}x${y}! ${filepath}`);
      }

      const imageBuffer = await fs.readFile(filepath);
      return imageBuffer.toString('base64');
    } catch (error) {
      throw new Error(`Failed to take screenshot: ${error}`);
    } finally {
      try {
        await fs.unlink(filepath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private scaleCoordinates(source: 'api' | 'computer', x: number, y: number): [number, number] {
    if (!this.scalingEnabled) return [x, y];

    const ratio = this.width / this.height;
    let targetDimension = null;

    for (const dimension of Object.values(MAX_SCALING_TARGETS)) {
      if (Math.abs(dimension.width / dimension.height - ratio) < 0.02) {
        if (dimension.width < this.width) {
          targetDimension = dimension;
          break;
        }
      }
    }

    if (!targetDimension) return [x, y];

    const xScalingFactor = targetDimension.width / this.width;
    const yScalingFactor = targetDimension.height / this.height;

    if (source === 'api') {
      if (x > this.width || y > this.height) {
        throw new Error(`Coordinates ${x}, ${y} are out of bounds`);
      }
      return [Math.round(x / xScalingFactor), Math.round(y / yScalingFactor)];
    }
    
    return [Math.round(x * xScalingFactor), Math.round(y * yScalingFactor)];
  }

  async execute(command: ComputerCommand): Promise<{ result: string }> {
    const { action, text, coordinate } = command;

    try {
      switch (action) {
        case 'screenshot':
          const base64Image = await this.takeScreenshot();
          return { result: `Screenshot taken: ${base64Image}` };

        case 'mouse_move':
        case 'left_click_drag':
          if (!coordinate) {
            throw new Error(`coordinate is required for ${action}`);
          }
          const [x, y] = this.scaleCoordinates('api', coordinate[0], coordinate[1]);
          const cmd = action === 'mouse_move' 
            ? `${this.displayPrefix}xdotool mousemove --sync ${x} ${y}`
            : `${this.displayPrefix}xdotool mousedown 1 mousemove --sync ${x} ${y} mouseup 1`;
          await execAsync(cmd);
          return { result: `Executed ${action} at coordinates ${x},${y}` };

        // Implement other actions similarly...
        default:
          throw new Error(`Unsupported action: ${action}`);
      }
    } catch (error) {
      throw new Error(`Failed to execute ${action}: ${error}`);
    }
  }
}

// Create the Vercel AI SDK compatible tool
export const computerTool = tool({
  description: 'Interact with the computer screen, keyboard, and mouse',
  parameters: computerCommandSchema,
  execute: async (params: ComputerCommand) => {
    const computerTool = new ComputerToolImplementation();
    return computerTool.execute(params);
  },
});
