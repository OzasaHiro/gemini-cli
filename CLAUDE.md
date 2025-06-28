# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview
Gemini CLI is Google's command-line AI workflow tool that connects to various tools and can query/edit large codebases beyond Gemini's 1M token context window. It features a React-based interactive CLI interface with multimodal capabilities.

## Essential Commands

### Development
- `npm install` - Install dependencies (requires Node.js 18+)
- `npm start` - Start the CLI
- `npm run debug` - Run in debug mode
- `npm run build` - Build the project
- `npm run dev` - Development mode with hot reload

### Testing
- `npm test` - Run all tests (uses Vitest)
- `npm run test:ci` - CI-specific tests
- `npm run test:e2e` - End-to-end tests
- `npm run test:integration:all` - All integration tests with different sandbox modes
- Run single test: `npm test -- path/to/test.ts`

### Code Quality
- `npm run lint` - Lint code (ESLint with TypeScript)
- `npm run format` - Format code (Prettier)
- `npm run typecheck` - TypeScript type checking
- `npm run preflight` - Complete validation (clean, install, format, lint, build, test)

### Git Operations
- `git add <files>` - Stage files for commit
- `git commit -m "message"` - Commit changes with message
- `git push origin <branch>` - Push changes to GitHub
- `git status` - Check current git status
- `git diff` - Show unstaged changes
- `git log --oneline -n 10` - Show recent commits

## Architecture

### Monorepo Structure
- **packages/cli/** - CLI interface and React-based UI components
  - `src/ui/` - React components for interactive CLI
  - `src/config/` - Configuration management
  - `src/utils/` - CLI-specific utilities
  
- **packages/core/** - Core functionality
  - `src/core/` - Core logic (client, chat, prompts)
  - `src/tools/` - Tool implementations (edit, grep, glob, shell, MCP)
  - `src/services/` - File discovery, Git integration
  - `src/code_assist/` - Code assistance features

### Key Architectural Patterns
1. **Tool System**: Extensible tool architecture in `packages/core/src/tools/`
2. **React CLI**: Interactive UI built with React and Ink framework
3. **MCP Integration**: Model Context Protocol server support
4. **Sandbox Execution**: Secure code execution environment
5. **Streaming Architecture**: Real-time response streaming with proper error handling

### Testing Strategy
- Unit tests colocated with source files (`*.test.ts`)
- Integration tests in `/integration-tests/`
- E2E tests with sandbox environments
- Mock-based testing for external dependencies

### Configuration
- TypeScript with strict mode (ES2023, NodeNext modules)
- ESLint with custom rules for React and imports
- Prettier formatting (80 chars, single quotes, semicolons)
- Apache-2.0 license with mandatory headers

## Local LLM Mode (Ollama/Gemma 3)
The codebase is being modified to support local LLM via Ollama:
- **Config File**: `~/.gemini/ollama_config.json` enables Ollama mode
- **Implementation**: 
  - Step 1: OllamaConfig type and config loader in `packages/core/src/config/`
  - Step 2: Ollama client with pseudo function calling in `packages/core/src/code_assist/ollama_client.ts`
  - Step 3: Integration in `packages/core/src/code_assist/server.ts`
- **Function Calling**: Uses `<tool_code>` blocks with JSON for tool invocation