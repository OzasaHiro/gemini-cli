# Gemini CLI with Local LLM Support (Ollama/Gemma 3)

[![Gemini CLI CI](https://github.com/google-gemini/gemini-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/google-gemini/gemini-cli/actions/workflows/ci.yml)

![Gemini CLI Screenshot](./docs/assets/gemini-screenshot.png)

This repository contains the Gemini CLI, a command-line AI workflow tool that connects to your
tools, understands your code and accelerates your workflows. **This fork adds support for local LLM inference using Ollama.**

With the Gemini CLI you can:

- Query and edit large codebases in and beyond Gemini's 1M token context window.
- Generate new apps from PDFs or sketches, using Gemini's multimodal capabilities.
- Automate operational tasks, like querying pull requests or handling complex rebases.
- Use tools and MCP servers to connect new capabilities, including [media generation with Imagen,
  Veo or Lyria](https://github.com/GoogleCloudPlatform/vertex-ai-creative-studio/tree/main/experiments/mcp-genmedia)
- Ground your queries with the [Google Search](https://ai.google.dev/gemini-api/docs/grounding)
  tool, built in to Gemini.
- **NEW: Run locally with Ollama and models like Gemma 3, Llama 3, Mistral, etc.**

## Quickstart

### Option 1: Use Google's Gemini API (Original Method)

1. **Prerequisites:** Ensure you have [Node.js version 18](https://nodejs.org/en/download) or higher installed.
2. **Run the CLI:** Execute the following command in your terminal:

   ```bash
   npx https://github.com/google-gemini/gemini-cli
   ```

   Or install it with:

   ```bash
   npm install -g @google/gemini-cli
   gemini
   ```

3. **Pick a color theme**
4. **Authenticate:** When prompted, sign in with your personal Google account. This will grant you up to 60 model requests per minute and 1,000 model requests per day using Gemini.

### Option 2: Use Local LLM with Ollama (NEW!)

1. **Prerequisites:** 
   - [Node.js version 18](https://nodejs.org/en/download) or higher
   - [Ollama](https://ollama.ai/) installed and running

2. **Install and setup Ollama:**
   ```bash
   # Install Ollama (macOS/Linux)
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Start Ollama server
   ollama serve
   
   # Pull your preferred model (e.g., Gemma 3)
   ollama pull gemma3:27b
   # Or try other models:
   # ollama pull llama3.3:70b
   # ollama pull mistral:latest
   # ollama pull qwen2.5:32b
   ```

3. **Clone and build this fork:**
   ```bash
   git clone https://github.com/OzasaHiro/gemini-cli
   cd gemini-cli
   npm install
   npm run build
   ```

4. **Create Ollama configuration:**
   ```bash
   mkdir -p ~/.gemini
   cat > ~/.gemini/ollama_config.json << EOF
   {
     "enabled": true,
     "model": "gemma3:27b",
     "host": "localhost",
     "port": 11434
   }
   EOF
   ```

5. **Run the CLI:**
   ```bash
   npm start
   # Or if installed globally:
   gemini
   ```

The CLI will automatically detect the Ollama configuration and use your local LLM instead of Google's API!

## Configuration

### Ollama Configuration File

Create `~/.gemini/ollama_config.json` to enable local LLM mode:

```json
{
  "enabled": true,
  "model": "gemma3:27b",    // Your Ollama model name
  "host": "localhost",       // Ollama server host
  "port": 11434             // Ollama server port (default: 11434)
}
```

To switch back to Google's Gemini API, simply rename or delete this file:
```bash
mv ~/.gemini/ollama_config.json ~/.gemini/ollama_config.json.bak
```

### Supported Models

Any model available in Ollama can be used. Popular choices include:

- **Gemma 3**: `ollama pull gemma3:27b` - Google's open model, excellent for code
- **Llama 3.3**: `ollama pull llama3.3:70b` - Meta's latest model
- **Mistral**: `ollama pull mistral:latest` - Fast and efficient
- **Qwen 2.5**: `ollama pull qwen2.5:32b` - Strong multilingual support
- **DeepSeek Coder**: `ollama pull deepseek-coder:33b` - Specialized for coding

## Features

### Full Tool Support with Local LLMs

All Gemini CLI tools work with local LLMs through a pseudo function-calling mechanism:

- **File Operations**: Read, write, edit files
- **Shell Commands**: Execute bash commands
- **Web Search**: Search and fetch web content
- **Code Analysis**: Grep, glob, and analyze codebases
- **MCP Servers**: Connect to Model Context Protocol servers

The implementation uses structured `<tool_code>` blocks to enable tool calling with models that don't natively support function calling:

```xml
<tool_code>
{"tool_name": "read_file", "parameters": {"file_path": "/path/to/file.ts"}}
</tool_code>
```

### Performance Considerations

- **Response Time**: Local models may be slower than cloud APIs depending on your hardware
- **GPU Acceleration**: Ollama automatically uses GPU if available (NVIDIA, AMD, Apple Silicon)
- **Memory Usage**: Larger models require more RAM/VRAM:
  - 7B models: ~8GB
  - 13B models: ~16GB
  - 27B models: ~32GB
  - 70B models: ~64GB+

## Examples

Once the CLI is running, you can start interacting with your local LLM:

```sh
cd new-project/
gemini
> Write me a Discord bot that uses environment variables for configuration
```

Or work with an existing project:

```sh
cd my-typescript-project
gemini
> Find all the places where we're using deprecated APIs and suggest modern alternatives
```

### Tool Usage Examples

```text
> List all TypeScript files in the src directory
> Read the package.json and tell me what dependencies are outdated
> Search for all TODO comments in the codebase
> Create a new test file for the UserService class
```

## Troubleshooting

### Ollama Connection Issues

If the CLI can't connect to Ollama:

1. Ensure Ollama is running: `ollama serve`
2. Check the port is correct in your config (default: 11434)
3. Verify the model is installed: `ollama list`

### Switching Between Modes

- **To use Ollama**: Ensure `~/.gemini/ollama_config.json` exists
- **To use Gemini API**: Rename/delete the Ollama config file
- The CLI will indicate which mode it's using at startup

### Performance Issues

If responses are slow:

1. Try a smaller model (e.g., `gemma2:9b` instead of `gemma3:27b`)
2. Ensure Ollama is using GPU: `ollama ps` (should show GPU usage)
3. Close other applications to free up memory

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

### Key Implementation Details

- **Architecture**: Ollama support is implemented via the `ContentGenerator` interface
- **Tool Calling**: Uses text-based `<tool_code>` blocks parsed from model responses
- **Configuration**: Auto-detects Ollama mode via `~/.gemini/ollama_config.json`
- **Compatibility**: Maintains full backward compatibility with Google's Gemini API

## License

This project is licensed under the Apache License 2.0 - see the LICENSE file for details.

## Acknowledgments

- Original Gemini CLI by Google
- [Ollama](https://ollama.ai/) for local LLM inference
- The open-source community for various LLM models