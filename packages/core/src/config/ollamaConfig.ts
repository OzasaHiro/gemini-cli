/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { OllamaConfig } from './config.js';

const OLLAMA_CONFIG_FILE = 'ollama_config.json';
const GEMINI_DIR = '.gemini';

/**
 * Load Ollama configuration from multiple locations in priority order:
 * 1. ./ollama_config.json (current working directory)
 * 2. ./.gemini/ollama_config.json (project-local config)
 * 3. ~/.gemini/ollama_config.json (user-global config)
 * @returns OllamaConfig if file exists and is valid, null otherwise
 */
export async function loadOllamaConfig(): Promise<OllamaConfig | null> {
  const configPaths = [
    // 1. Current working directory (highest priority)
    path.join(process.cwd(), OLLAMA_CONFIG_FILE),
    // 2. Project-local .gemini directory
    path.join(process.cwd(), GEMINI_DIR, OLLAMA_CONFIG_FILE),
    // 3. User home directory (lowest priority)
    path.join(os.homedir(), GEMINI_DIR, OLLAMA_CONFIG_FILE),
  ];

  for (const configPath of configPaths) {
    try {
      // Check if file exists
      await fs.access(configPath);
      
      // Read and parse the config file
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent) as OllamaConfig;
      
      // Validate required fields
      if (!config.model || !config.host || typeof config.port !== 'number') {
        console.warn(`Invalid Ollama configuration in ${configPath}: missing required fields`);
        continue; // Try next location
      }
      
      // Set default enabled state if not specified
      if (config.enabled === undefined) {
        config.enabled = true;
      }
      
      console.log(`[Ollama] Using config from: ${configPath}`);
      return config;
    } catch (error) {
      // File doesn't exist at this location - try next one
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.debug(`Failed to load Ollama config from ${configPath}:`, error);
      }
    }
  }
  
  // No valid config found in any location
  return null;
}