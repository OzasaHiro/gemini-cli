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
 * Load Ollama configuration from ~/.gemini/ollama_config.json
 * @returns OllamaConfig if file exists and is valid, null otherwise
 */
export async function loadOllamaConfig(): Promise<OllamaConfig | null> {
  try {
    const configPath = path.join(os.homedir(), GEMINI_DIR, OLLAMA_CONFIG_FILE);
    
    // Check if file exists
    await fs.access(configPath);
    
    // Read and parse the config file
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent) as OllamaConfig;
    
    // Validate required fields
    if (!config.model || !config.host || typeof config.port !== 'number') {
      console.warn('Invalid Ollama configuration: missing required fields');
      return null;
    }
    
    // Set default enabled state if not specified
    if (config.enabled === undefined) {
      config.enabled = true;
    }
    
    return config;
  } catch (error) {
    // File doesn't exist or is invalid - this is normal for non-Ollama mode
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.debug('Failed to load Ollama config:', error);
    }
    return null;
  }
}