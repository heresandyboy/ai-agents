import { ComputerToolImplementation } from "../computer.tool";
import { ComputerCommand } from "../computer.schema";

// Set a higher default timeout
jest.setTimeout(60000);

describe("ComputerTool Tests", () => {
  let computerTool: ComputerToolImplementation;
  const SCREEN_WIDTH = 2560;
  const SCREEN_HEIGHT = 1440;
  const CENTER_X = SCREEN_WIDTH / 2; // 1280
  const CENTER_Y = SCREEN_HEIGHT / 2; // 720

  beforeEach(() => {
    process.env.WIDTH = "2560";
    process.env.HEIGHT = "1440";
    process.env.DISPLAY_NUM = "0";
    process.env.NODE_ENV = "test"; // Indicate that we're in a test environment
    computerTool = new ComputerToolImplementation(0);
  });

  afterEach(async () => {
    // Wait for any remaining operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe("Safe Mouse Movement Tests", () => {
    it("should move mouse to center of screen", async () => {
      const command: ComputerCommand = {
        action: "mouse_move",
        coordinate: [CENTER_X, CENTER_Y],
      };

      const result = await computerTool.execute(command);
      expect(result.result).toContain("Moved mouse to coordinates");
      expect(result.base64Image).toBeDefined();
    }, 15000); // Increase timeout for this test

    it("should move mouse to each corner safely", async () => {
      const safeOffset = 100; // Stay away from screen edges
      const corners: [number, number][] = [
        [safeOffset, safeOffset], // Top-left
        [SCREEN_WIDTH - safeOffset, safeOffset], // Top-right
        [safeOffset, SCREEN_HEIGHT - safeOffset], // Bottom-left
        [SCREEN_WIDTH - safeOffset, SCREEN_HEIGHT - safeOffset], // Bottom-right
      ];

      for (const corner of corners) {
        const command: ComputerCommand = {
          action: "mouse_move",
          coordinate: corner,
        };

        const result = await computerTool.execute(command);
        expect(result.result).toContain("Moved mouse to coordinates");
        // Reduce delay between movements
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }, 30000); // Increase timeout for this test
  });

  describe("Screenshot Tests", () => {
    it("should take a screenshot", async () => {
      const command: ComputerCommand = {
        action: "screenshot",
      };

      const result = await computerTool.execute(command);
      expect(result.result).toBe("Screenshot taken");
      expect(result.base64Image).toBeDefined();
    });
  });

  describe("Cursor Position Tests", () => {
    it("should get cursor position", async () => {
      // First move to center
      await computerTool.execute({
        action: "mouse_move",
        coordinate: [CENTER_X, CENTER_Y],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const command: ComputerCommand = {
        action: "cursor_position",
      };

      const result = await computerTool.execute(command);
      console.log(`Cursor position result: "${result.result}"`); // For debugging
      expect(result.result).toMatch(/X=\d+,Y=\d+/);
    });
  });

  describe("Safe Click Tests", () => {
    // First move to a safe area, then perform clicks
    const safeMoveAndClick = async (clickAction: ComputerCommand["action"]) => {
      // Move to a safe area first (center of screen)
      await computerTool.execute({
        action: "mouse_move",
        coordinate: [CENTER_X, CENTER_Y],
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Perform the click action
      const command: ComputerCommand = {
        action: clickAction,
      };

      const result = await computerTool.execute(command);
      expect(result.result).toContain("click");
      expect(result.base64Image).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 500));
    };

    it("should perform a safe left click", async () => {
      await safeMoveAndClick("left_click");
    });

    it("should perform a safe right click", async () => {
      await safeMoveAndClick("right_click");
    });

    it("should perform a safe middle click", async () => {
      await safeMoveAndClick("middle_click");
    });

    it("should perform a safe double click", async () => {
      await safeMoveAndClick("double_click");
    });
  });

  describe("Safe Drag Tests", () => {
    it("should perform a small drag operation", async () => {
      // Start from center
      await computerTool.execute({
        action: "mouse_move",
        coordinate: [CENTER_X, CENTER_Y],
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Drag just a small amount (20 pixels in each direction)
      const command: ComputerCommand = {
        action: "left_click_drag",
        coordinate: [CENTER_X + 20, CENTER_Y + 20],
      };

      const result = await computerTool.execute(command);
      expect(result.result).toContain("Dragged to coordinates");
      expect(result.base64Image).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 500));
    });
  });

  // Keyboard command tests modified to avoid actual key presses
  describe("Keyboard Command Construction", () => {
    it("should construct safe key commands", () => {
      const command: ComputerCommand = {
        action: "key",
        text: "{TAB}",
      };

      const keyCommand = (computerTool as any).getKeyCommand(command.text);
      if (computerTool.isWindows) {
        expect(keyCommand).toContain("powershell -command");
      } else {
        expect(keyCommand).toContain("xdotool key -- {TAB}");
      }
    });

    it("should construct safe type commands", () => {
      const command: ComputerCommand = {
        action: "type",
        text: "test",
      };

      const typeCommand = (computerTool as any).getTypeCommand(command.text);
      if (computerTool.isWindows) {
        expect(typeCommand).toContain("powershell -command");
      } else {
        expect(typeCommand).toContain("xdotool type --delay");
      }
    });
  });
});
