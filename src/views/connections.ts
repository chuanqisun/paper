import { html, type TemplateResult } from "lit-html";
import { Subject } from "rxjs";
import type { ApiKeys } from "../lib/storage";

export interface ConnectionsViewProps {
  apiKeys: ApiKeys;
  onApiKeyChange: Subject<{ provider: keyof ApiKeys; value: string }>;
  onTestConnection: Subject<{ provider: "openai" | "blackforest"; testInput: string }>;
  testResult?: string;
  testLoading?: boolean;
}

export function connectionsView({
  apiKeys,
  onApiKeyChange,
  onTestConnection,
  testResult,
  testLoading,
}: ConnectionsViewProps): TemplateResult {
  const handleOpenAIChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    onApiKeyChange.next({ provider: "openai", value: input.value });
  };

  const handleBlackforestChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    onApiKeyChange.next({ provider: "blackforest", value: input.value });
  };

  const handleTestSubmit = (e: Event) => {
    e.preventDefault();
    const testInput = 'Please respond "OpenAI test success!"';

    // Test OpenAI first
    if (apiKeys.openai) {
      onTestConnection.next({ provider: "openai", testInput });
    }
    // Then test BlackForest (will be noop for now)
    if (apiKeys.blackforest) {
      onTestConnection.next({ provider: "blackforest", testInput });
    }
  };

  return html`
    <form class="connections-form" @submit=${handleTestSubmit}>
      <div class="form-field">
        <label for="openai-key">OpenAI API Key</label>
        <input
          id="openai-key"
          type="password"
          value=${apiKeys.openai || ""}
          placeholder="sk-..."
          @input=${handleOpenAIChange}
        />
      </div>

      <div class="form-field">
        <label for="blackforest-key">BlackForest Labs API Key</label>
        <input
          id="blackforest-key"
          type="password"
          value=${apiKeys.blackforest || ""}
          placeholder="API key for BFL"
          @input=${handleBlackforestChange}
        />
      </div>

      <button type="submit" ?disabled=${testLoading || (!apiKeys.openai && !apiKeys.blackforest)}>
        ${testLoading ? "Testing..." : "Test Connections"}
      </button>

      <div class="form-status">
        <small>
          OpenAI: ${apiKeys.openai ? "✓ Set" : "✗ Not set"} | BlackForest:
          ${apiKeys.blackforest ? "✓ Set" : "✗ Not set"}
        </small>
        ${testResult
          ? html`
              <div class="test-result">
                <strong>Test Result:</strong>
                <pre>${testResult}</pre>
              </div>
            `
          : ""}
      </div>
    </form>
  `;
}
