import { html, type TemplateResult } from "lit-html";
import { Subject } from "rxjs";
import type { ApiKeys } from "../lib/storage";

export interface ConnectionsViewProps {
  apiKeys: ApiKeys;
  onApiKeyChange: Subject<{ provider: keyof ApiKeys; value: string }>;
  onTestConnection: Subject<{ provider: "openai" | "together" }>;
  testResults?: {
    openai?: string;
    together?: string;
  };
  testLoading?: boolean;
}

export function connectionsView({
  apiKeys,
  onApiKeyChange,
  onTestConnection,
  testResults,
  testLoading,
}: ConnectionsViewProps): TemplateResult {
  const handleOpenAIChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    onApiKeyChange.next({ provider: "openai", value: input.value });
  };

  const handleTogetherChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    onApiKeyChange.next({ provider: "together", value: input.value });
  };

  const handleTestSubmit = (e: Event) => {
    e.preventDefault();

    // Test OpenAI first
    if (apiKeys.openai) {
      onTestConnection.next({ provider: "openai" });
    }
    // Then test Together.ai
    if (apiKeys.together) {
      onTestConnection.next({ provider: "together" });
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
        <label for="together-key">Together.ai API Key</label>
        <input
          id="together-key"
          type="password"
          value=${apiKeys.together || ""}
          placeholder="API key for Together.ai"
          @input=${handleTogetherChange}
        />
      </div>

      <button type="submit" ?disabled=${testLoading || (!apiKeys.openai && !apiKeys.together)}>
        ${testLoading ? "Testing..." : "Test Connections"}
      </button>

      <div class="form-status">
        <small>
          OpenAI: ${apiKeys.openai ? "✓ Set" : "✗ Not set"}${testResults?.openai ? ` - ${testResults.openai}` : ""} |
          Together.ai:
          ${apiKeys.together ? "✓ Set" : "✗ Not set"}${testResults?.together
            ? testResults.together.startsWith("data:image") || testResults.together.startsWith("http")
              ? html` - <a href="${testResults.together}" target="_blank">View test image</a>`
              : ` - ${testResults.together}`
            : ""}
        </small>
      </div>
    </form>
  `;
}
