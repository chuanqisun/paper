import { html, type TemplateResult } from "lit-html";
import { Subject } from "rxjs";
import type { ApiKeys } from "../lib/storage";

export interface ConnectionsViewProps {
  apiKeys: ApiKeys;
  onApiKeyChange: Subject<{ provider: keyof ApiKeys; value: string }>;
}

export function connectionsView({ apiKeys, onApiKeyChange }: ConnectionsViewProps): TemplateResult {
  const handleOpenAIChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    onApiKeyChange.next({ provider: "openai", value: input.value });
  };

  const handleBlackforestChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    onApiKeyChange.next({ provider: "blackforest", value: input.value });
  };

  return html`
    <div class="connections-form">
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

      <div class="form-status">
        <small>
          OpenAI: ${apiKeys.openai ? "✓ Set" : "✗ Not set"} | BlackForest:
          ${apiKeys.blackforest ? "✓ Set" : "✗ Not set"}
        </small>
      </div>
    </div>
  `;
}
