import { z } from "zod";

export const editorCommandSchema = z.object({
  command: z
    .enum(["replace", "insert", "view"])
    .describe("The editor command to execute"),
  path: z.string().describe("File path to edit"),
  file_text: z
    .string()
    .optional()
    .describe("Text content to insert or replace"),
  view_range: z
    .tuple([z.number(), z.number()])
    .optional()
    .describe("Range of lines to view"),
  old_str: z.string().optional().describe("String to replace"),
  new_str: z.string().optional().describe("New string to insert"),
  insert_line: z.number().optional().describe("Line number to insert at"),
});

export type EditorCommand = z.infer<typeof editorCommandSchema>;
