/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tool } from '../tools/tools.js';

/**
 * Builds a comprehensive prompt for Ollama that includes system instructions,
 * tool descriptions, and user query
 */
export function buildOllamaPrompt(userPrompt: string, tools: Tool[]): string {
  const systemPrompt = `You are a highly capable AI assistant with access to various tools to help users with their tasks.

IMPORTANT INSTRUCTIONS:
1. You must use the exact tool calling format described below when you need to use tools
2. When calling tools, include the full <tool_code> block in your response
3. You can call multiple tools in sequence if needed
4. Always provide helpful context and explanations around tool calls

AVAILABLE TOOLS:
${generateToolDescriptions(tools)}

TOOL CALLING FORMAT:
When you need to use a tool, include it in your response using this exact format:

<tool_code>
{"tool_name": "tool_name_here", "parameters": {"param1": "value1", "param2": "value2"}}
</tool_code>

Examples:
- To list files: <tool_code>{"tool_name": "ls", "parameters": {"path": "/path/to/directory"}}</tool_code>
- To read a file: <tool_code>{"tool_name": "read_file", "parameters": {"file_path": "/path/to/file.txt"}}</tool_code>
- To search for text: <tool_code>{"tool_name": "grep", "parameters": {"pattern": "search_term", "path": "/search/path"}}</tool_code>

You can include normal text before and after tool calls. The tool results will be provided to you, and you should incorporate them into your final response.

Now, please help with the following request:

${userPrompt}`;

  return systemPrompt;
}

/**
 * Generates natural language descriptions of available tools
 */
function generateToolDescriptions(tools: Tool[]): string {
  if (tools.length === 0) {
    return 'No tools are currently available.';
  }

  return tools
    .map((tool) => {
      const params = tool.schema.parameters;
      const paramsList = params?.properties 
        ? Object.entries(params.properties)
            .map(([name, schema]: [string, any]) => {
              const required = params.required?.includes(name) ? ' (required)' : ' (optional)';
              const type = schema.type || 'unknown';
              const description = schema.description || '';
              return `  - ${name} (${type})${required}: ${description}`;
            })
            .join('\n')
        : '  No parameters';

      return `**${tool.displayName}** (tool_name: "${tool.name}")
Description: ${tool.description}
Parameters:
${paramsList}`;
    })
    .join('\n\n');
}

/**
 * Builds a follow-up prompt when incorporating tool results
 */
export function buildFollowUpPrompt(
  originalPrompt: string,
  toolCalls: Array<{ name: string; parameters: any }>,
  toolResults: Array<{ name: string; result: string; error?: string }>,
): string {
  const toolCallsText = toolCalls
    .map((call, index) => {
      const result = toolResults[index];
      const status = result?.error ? 'ERROR' : 'SUCCESS';
      const output = result?.error || result?.result || 'No output';
      
      return `Tool Call ${index + 1}: ${call.name}
Parameters: ${JSON.stringify(call.parameters, null, 2)}
Status: ${status}
Output: ${output}`;
    })
    .join('\n\n');

  return `Based on the tool execution results below, please provide a comprehensive response to the user's original request.

Original Request: ${originalPrompt}

Tool Execution Results:
${toolCallsText}

Please analyze these results and provide a helpful response. If any tools failed, you may suggest alternatives or ask for clarification.`;
}