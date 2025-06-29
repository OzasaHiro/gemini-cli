/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContentGenerator } from '../core/contentGenerator.js';
import {
  GenerateContentParameters,
  GenerateContentResponse,
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  FinishReason,
  Content,
} from '@google/genai';
import { buildOllamaPrompt, buildFollowUpPrompt } from './promptBuilder.js';
import { parseOllamaResponse } from './responseParser.js';
import { ToolRegistry } from '../tools/tool-registry.js';

export interface OllamaApiConfig {
  host: string;
  port: number;
  model: string;
}

export interface OllamaApiResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Content generator that uses Ollama API for local LLM inference
 */
export class OllamaClient implements ContentGenerator {
  constructor(
    private readonly config: OllamaApiConfig,
    private readonly toolRegistry?: ToolRegistry,
  ) {}

  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    const generator = await this.generateContentStream(request);
    const responses: GenerateContentResponse[] = [];
    
    for await (const response of generator) {
      responses.push(response);
    }
    
    // Return the last response which should contain the complete content
    return responses[responses.length - 1] || { candidates: [] };
  }

  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    return this.generateContentStreamInternal(request);
  }

  private async *generateContentStreamInternal(
    request: GenerateContentParameters,
  ): AsyncGenerator<GenerateContentResponse> {
    try {
      // Extract user prompt from request
      const userPrompt = this.extractUserPrompt(request);
      if (!userPrompt) {
        throw new Error('No user prompt found in request');
      }

      // Get available tools
      const tools = this.toolRegistry ? this.toolRegistry.getAllTools() : [];
      
      // Build the Ollama prompt with tool instructions
      const prompt = buildOllamaPrompt(userPrompt, tools);
      
      // Call Ollama API
      const responseText = await this.callOllamaApi(prompt);
      
      // Parse the response for tool calls
      const parsed = parseOllamaResponse(responseText);
      
      // If there are tool calls, execute them and get follow-up response
      if (parsed.functionCalls.length > 0 && this.toolRegistry) {
        yield* this.handleToolCalls(userPrompt, parsed, tools);
      } else {
        // No tool calls, return the parsed text response
        yield {
          candidates: [
            {
              content: {
                parts: [{ text: parsed.text || responseText }],
                role: 'model',
              },
              finishReason: FinishReason.STOP,
            },
          ],
          text: parsed.text || responseText,
          data: undefined,
          functionCalls: parsed.functionCalls,
          executableCode: undefined,
          codeExecutionResult: undefined,
        };
      }
    } catch (error) {
      console.error('Ollama API error:', error);
      const errorText = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      yield {
        candidates: [
          {
            content: {
              parts: [{ text: errorText }],
              role: 'model',
            },
            finishReason: FinishReason.OTHER,
          },
        ],
        text: errorText,
        data: undefined,
        functionCalls: [],
        executableCode: undefined,
        codeExecutionResult: undefined,
      };
    }
  }

  async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    // Ollama doesn't have a direct token counting API
    // We'll provide an approximation based on text length
    const text = JSON.stringify(request);
    const approximateTokens = Math.ceil(text.length / 4); // Rough estimate: 4 chars per token
    
    return {
      totalTokens: approximateTokens,
    };
  }

  async embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse> {
    // Ollama embedding API is different from generation API
    // For now, we'll throw an error as embeddings need separate implementation
    throw new Error('Embedding not yet implemented for Ollama');
  }

  private extractUserPrompt(request: GenerateContentParameters): string | null {
    if (!request.contents) {
      return null;
    }

    // Normalize contents to array
    const contentsArray = Array.isArray(request.contents) ? request.contents : [request.contents];
    
    if (contentsArray.length === 0) {
      return null;
    }

    // Find the last user message
    for (let i = contentsArray.length - 1; i >= 0; i--) {
      const content = contentsArray[i] as Content;
      if (content.role === 'user' && content.parts) {
        const textParts = content.parts
          .filter((part: any): part is { text: string } => 'text' in part)
          .map((part: { text: string }) => part.text);
        
        if (textParts.length > 0) {
          return textParts.join('\n');
        }
      }
    }

    return null;
  }

  private async callOllamaApi(prompt: string): Promise<string> {
    const url = `http://${this.config.host}:${this.config.port}/api/generate`;
    console.log(`[Ollama] Calling API: ${url} with model: ${this.config.model}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt: prompt,
        stream: false, // For simplicity, using non-streaming mode
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as OllamaApiResponse;
    return data.response;
  }

  private async *handleToolCalls(
    originalPrompt: string,
    parsed: any,
    tools: any[],
  ): AsyncGenerator<GenerateContentResponse> {
    const toolResults: Array<{ name: string; result: string; error?: string }> = [];

    // Execute each tool call
    for (const toolCall of parsed.rawToolCalls) {
      try {
        const tool = tools.find(t => t.name === toolCall.name);
        if (!tool) {
          toolResults.push({
            name: toolCall.name,
            result: '',
            error: `Tool '${toolCall.name}' not found`,
          });
          continue;
        }

        // Create an abort signal (not used in this implementation)
        const controller = new AbortController();
        const result = await tool.execute(toolCall.parameters, controller.signal);
        
        toolResults.push({
          name: toolCall.name,
          result: typeof result === 'string' ? result : JSON.stringify(result),
        });
      } catch (error) {
        toolResults.push({
          name: toolCall.name,
          result: '',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Build follow-up prompt with tool results
    const followUpPrompt = buildFollowUpPrompt(
      originalPrompt,
      parsed.rawToolCalls,
      toolResults,
    );

    // Get final response from Ollama
    const finalResponseText = await this.callOllamaApi(followUpPrompt);
    const finalParsed = parseOllamaResponse(finalResponseText);

    // Return the final response
    const finalText = finalParsed.text || finalResponseText;
    
    yield {
      candidates: [
        {
          content: {
            parts: [{ text: finalText }],
            role: 'model',
          },
          finishReason: FinishReason.STOP,
        },
      ],
      text: finalText,
      data: undefined,
      functionCalls: parsed.functionCalls,
      executableCode: undefined,
      codeExecutionResult: undefined,
    };
  }
}