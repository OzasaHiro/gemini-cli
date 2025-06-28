/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { FunctionCall } from '@google/genai';

export interface ParsedOllamaResponse {
  /** Text content with tool_code blocks removed */
  text: string | null;
  /** Extracted tool calls in Gemini-compatible format */
  functionCalls: FunctionCall[];
  /** Raw tool call data for debugging */
  rawToolCalls: Array<{ name: string; parameters: any }>;
}

/**
 * Parses Ollama response to extract tool calls and clean text content
 */
export function parseOllamaResponse(responseText: string): ParsedOllamaResponse {
  const toolCodeRegex = /<tool_code>([\s\S]*?)<\/tool_code>/g;
  const functionCalls: FunctionCall[] = [];
  const rawToolCalls: Array<{ name: string; parameters: any }> = [];
  
  let cleanText = responseText;
  let match;

  // Extract all tool_code blocks
  while ((match = toolCodeRegex.exec(responseText)) !== null) {
    const toolCodeContent = match[1].trim();
    
    try {
      // Parse JSON from tool_code block
      const toolCall = JSON.parse(toolCodeContent);
      
      if (toolCall.tool_name && typeof toolCall.tool_name === 'string') {
        // Store raw tool call
        rawToolCalls.push({
          name: toolCall.tool_name,
          parameters: toolCall.parameters || {},
        });

        // Convert to Gemini FunctionCall format
        const functionCall: FunctionCall = {
          name: toolCall.tool_name,
          args: toolCall.parameters || {},
        };
        
        functionCalls.push(functionCall);
        
        // Remove this tool_code block from the text
        cleanText = cleanText.replace(match[0], '');
      } else {
        console.warn('Invalid tool call format: missing or invalid tool_name', toolCall);
      }
    } catch (error) {
      console.warn('Failed to parse tool_code JSON:', toolCodeContent, error);
    }
  }

  // Clean up the text (remove extra whitespace, normalize line breaks)
  cleanText = cleanText
    .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newlines
    .trim();

  return {
    text: cleanText || null,
    functionCalls,
    rawToolCalls,
  };
}

/**
 * Validates that a tool call has the required structure
 */
export function validateToolCall(toolCall: any): boolean {
  return (
    typeof toolCall === 'object' &&
    toolCall !== null &&
    typeof toolCall.tool_name === 'string' &&
    toolCall.tool_name.length > 0 &&
    (toolCall.parameters === undefined || typeof toolCall.parameters === 'object')
  );
}

/**
 * Extracts just the tool calls without parsing the full response
 * Useful for validation or quick checks
 */
export function extractToolCalls(responseText: string): Array<{ name: string; parameters: any }> {
  const toolCodeRegex = /<tool_code>([\s\S]*?)<\/tool_code>/g;
  const toolCalls: Array<{ name: string; parameters: any }> = [];
  let match;

  while ((match = toolCodeRegex.exec(responseText)) !== null) {
    const toolCodeContent = match[1].trim();
    
    try {
      const toolCall = JSON.parse(toolCodeContent);
      
      if (validateToolCall(toolCall)) {
        toolCalls.push({
          name: toolCall.tool_name,
          parameters: toolCall.parameters || {},
        });
      }
    } catch (error) {
      // Silently skip invalid JSON
    }
  }

  return toolCalls;
}

/**
 * Checks if a response contains any tool calls
 */
export function hasToolCalls(responseText: string): boolean {
  return /<tool_code>[\s\S]*?<\/tool_code>/.test(responseText);
}