### **改修計画：ローカルLLM (Ollama/Gemma 3) 対応 - 詳細版**

このドキュメントは、`gemini-cli`がGoogleのGemini APIの代わりに、Ollama経由でローカルのGemma 3モデルを利用し、かつツール連携（Function Calling）も可能にするための詳細な改修計画です。

#### **全体方針**

*   **設定による切り替え**: `~/.gemini/ollama_config.json` ファイルの有無で、Gemini APIを利用する通常モードと、Ollamaを利用するローカルLLMモードを切り替える。
*   **Function Callingの再現**: Gemma 3のテキスト生成能力を活用し、特定のフォーマット（`<tool_code>`ブロックとJSON）でツール呼び出しを指示させる。クライアント側でその応答を解析し、既存のツール実行エンジンに接続することで、擬似的なFunction Callingを実現する。
*   **段階的な実装とテスト**: 各ステップで明確な目標を設定し、単体テストと結合テスト（手動含む）を行いながら、安全かつ確実に改修を進める。

---

### **ステップ1：設定ファイルの導入と読み込み**

**目的:** Ollamaモードの有効化と、モデル名・ホスト・ポートなどの設定を外部ファイルから読み込めるようにする。

**具体的な改修内容:**

1.  **型定義の追加:**
    *   **対象ファイル:** `packages/core/src/config/config.ts` (または関連する `types.ts`)
    *   **内容:** Ollamaの設定情報を格納するための`OllamaConfig`インターフェースを定義する。
        ```typescript
        export interface OllamaConfig {
          model: string;
          host: string;
          port: number;
        }
        ```

2.  **設定読み込み関数の実装:**
    *   **対象ファイル:** `packages/core/src/config/config.ts`
    *   **内容:** `~/.gemini/ollama_config.json`を非同期で読み込む`loadOllamaConfig(): Promise<OllamaConfig | null>`関数を実装する。
        *   Node.jsの`os.homedir()`と`path.join`で設定ファイルの絶対パスを構築する。
        *   `fs/promises.readFile`でファイルを読み込む。ファイルが存在しない場合は`null`を返す。
        *   読み込んだ内容を`JSON.parse`でパースし、`OllamaConfig`オブジェクトとして返す。

3.  **グローバル設定への統合:**
    *   **対象ファイル:** `packages/core/src/config/config.ts`
    *   **内容:** 既存の設定管理オブジェクトに、読み込んだOllama設定を格納するプロパティ（例: `ollama?: OllamaConfig`）を追加する。

**テスト計画:**

*   **単体テスト (`packages/core/src/config/config.test.ts`):**
    *   **ケース1:** `~/.gemini/ollama_config.json` が存在し、内容が正しい場合に、`OllamaConfig`オブジェクトが正しく返されることを確認する。
    *   **ケース2:** ファイルが存在しない場合に、`null`が返されることを確認する。
    *   **ケース3:** ファイルは存在するがJSONの形式が不正な場合に、エラーが適切に処理されることを確認する。
    *   **手法:** `vi.mock('fs/promises')`や`memfs`ライブラリを用いてファイルシステムをモックする。

---

### **ステップ2：Ollama APIクライアントと応答パーサーの実装**

**目的:** Ollamaサーバーと通信し、Gemma 3から返されるテキスト応答（ツール呼び出しを含む）を解析するためのコアロジックを実装する。

**具体的な改修内容:**

1.  **新規ファイルの作成:**
    *   **対象ファイル:** `packages/core/src/code_assist/ollama_client.ts` (新規作成)
    *   **内容:** Ollama連携に関するロジックをこのファイルに集約する。

2.  **プロンプト生成関数の実装:**
    *   **関数:** `buildOllamaPrompt(userPrompt: string, tools: Tool[]): string`
    *   **内容:**
        *   Gemma 3に役割、能力、そして厳密な出力形式を指示する「システムプロンプト」を定義する。
        *   指示内容：「あなたは高機能なAIアシスタントです。以下のツールが利用可能です...。ツールを呼び出す際は、必ず応答に`<tool_code>{"tool_name": "...", "parameters": {...}}</tool_code>`というブロックを含めてください。」
        *   `tools`配列を元に、利用可能なツールの一覧を自然言語で生成し、プロンプトに含める。

3.  **API通信関数の実装:**
    *   **関数:** `callOllamaApi(prompt: string, config: OllamaConfig): Promise<string>`
    *   **内容:**
        *   Node.jsの`fetch` APIを使用し、`http://${config.host}:${config.port}/api/generate`にPOSTリクエストを送信する。
        *   リクエストボディに`{ model: config.model, prompt: prompt }`を含める。
        *   Ollamaからのレスポンスボディ（JSON）から、生成されたテキスト部分を抽出して返す。

4.  **応答解析関数の実装:**
    *   **関数:** `parseOllamaResponse(responseText: string): { text: string | null, tool_calls: any[] }`
    *   **内容:**
        *   正規表現 `/<tool_code>([\s\S]*?)<\/tool_code>/g` を用いて、応答テキストから全ての`<tool_code>`ブロックを抽出する。
        *   抽出した各ブロック内のJSON文字列をパースし、`tool_calls`配列に追加する。
        *   `<tool_code>`ブロックを除いた残りのテキストを`text`として返す。

**テスト計画:**

*   **単体テスト (`packages/core/src/code_assist/ollama_client.test.ts`):**
    *   **`buildOllamaPrompt`:** ツール定義が、期待通りの自然言語説明と出力形式指示を含むプロンプトに変換されることを確認する。
    *   **`callOllamaApi`:** `fetch`をモックし、正しいエンドポイントとリクエストボディでAPIが呼び出されることを確認する。
    *   **`parseOllamaResponse`:**
        *   ツール呼び出しがない純粋なテキスト応答を正しく処理できることを確認する。
        *   単一および複数の`<tool_code>`ブロックを正しく抽出し、JSONをパースできることを確認する。
        *   テキストと`<tool_code>`ブロックが混在する応答を正しく分離できることを確認する。

---

### **ステップ3：既存ロジックへの統合とAPI呼び出しの切り替え**

**目的:** アプリケーションのメインロジックにOllamaフローを組み込み、設定に応じてGemini APIフローとシームレスに切り替えられるようにする。

**具体的な改修内容:**

1.  **API呼び出しロジックの改修:**
    *   **対象ファイル:** `packages/core/src/code_assist/server.ts` (主に`generateContent`やそれに類する関数)
    *   **内容:**
        *   関数の冒頭で`loadOllamaConfig()`を呼び出し、動作モードを決定する。
        *   **If (Ollamaモード):**
            1.  `buildOllamaPrompt`でプロンプトを構築。
            2.  `callOllamaApi`でOllamaにリクエスト。
            3.  `parseOllamaResponse`で応答を解析。
            4.  解析結果を、既存の`GenerateContentResponse`型（または内部で使われている同等の型）に変換する。特に、`tool_calls`を`response.functionCalls`のようなフィールドにマッピングする。
        *   **Else (Geminiモード):**
            *   従来のGemini API呼び出しロジックをそのまま実行する。

**テスト計画:**

*   **結合テスト (`packages/core/src/code_assist/server.test.ts`):**
    *   **ケース1 (Ollamaモード):** `loadOllamaConfig`がOllama設定を返すようにモックした場合、`ollama_client.ts`内の各関数が正しい順序で呼び出されることを`vi.spyOn`で検証する。
    *   **ケース2 (Geminiモード):** `loadOllamaConfig`が`null`を返すようにモックした場合、従来のGemini APIクライアントが呼び出されることを検証する。

*   **手動E2E（End-to-End）テスト:**
    *   **準備:** `ollama serve`を実行し、`gemma3:27b`モデルを準備しておく。
    *   **テスト1 (単純対話):** `~/.gemini/ollama_config.json`を作成し、CLIを起動。「1+1は？」のような簡単な質問をして、Gemma 3からの応答が表示されること、Ollamaサーバーにリクエストログが残ることを確認する。
    *   **テスト2 (ツール利用):** 「カレントディレクトリのファイルをリストして」と質問する。CLIがツール（`list_directory`）を実行し、その結果を基にした応答がGemma 3から生成され、表示されることを確認する。
    *   **テスト3 (フォールバック):** `ollama_config.json`を削除（またはリネーム）し、CLIを再起動。同じ質問をして、今度はGoogleのGemini API経由で応答が返ってくることを確認する。