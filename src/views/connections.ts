import { html, type TemplateResult } from "lit-html";
import { BehaviorSubject, Subject, map, of } from "rxjs";
import { catchError, mergeMap, tap } from "rxjs/operators";
import { observe } from "../lib/observe-directive";
import type { ApiKeys } from "../lib/storage";
import { testConnection } from "../lib/test-connections";

export interface ConnectionsViewProps {
  apiKeys: ApiKeys;
  onApiKeyChange: Subject<{ provider: keyof ApiKeys; value: string }>;
}

export function connectionsView({ apiKeys, onApiKeyChange }: ConnectionsViewProps): TemplateResult {
  // Internal test streams
  const testConnection$ = new Subject<{ provider: "openai" | "together" }>();
  const testResults$ = new BehaviorSubject<{ openai?: string; together?: string }>({});
  const testErrors$ = new BehaviorSubject<{ openai?: string; together?: string }>({});
  const testLoading$ = new BehaviorSubject<{ openai?: boolean; together?: boolean }>({});

  // Handle test connections internally
  const handleTestConnection$ = testConnection$.pipe(
    tap(({ provider }) => {
      const currentLoading = testLoading$.value;
      testLoading$.next({ ...currentLoading, [provider]: true });
    }),
    mergeMap(({ provider }) =>
      testConnection({
        provider,
        apiKeys,
      }).pipe(
        tap((result) => {
          const currentResults = testResults$.value;
          const currentErrors = testErrors$.value;
          const currentLoading = testLoading$.value;
          testResults$.next({ ...currentResults, [provider]: result });
          testErrors$.next({ ...currentErrors, [provider]: undefined });
          testLoading$.next({ ...currentLoading, [provider]: false });
        }),
        catchError((error) => {
          const currentResults = testResults$.value;
          const currentErrors = testErrors$.value;
          const currentLoading = testLoading$.value;
          testResults$.next({ ...currentResults, [provider]: undefined });
          testErrors$.next({ ...currentErrors, [provider]: error.message });
          testLoading$.next({ ...currentLoading, [provider]: false });
          return of(null);
        }),
      ),
    ),
  );

  // Subscribe to handle test connections
  handleTestConnection$.subscribe();

  // Derived observables for template
  const isDisabled$ = testLoading$.pipe(
    map((loading) => loading.openai || loading.together || (!apiKeys.openai && !apiKeys.together)),
  );
  const buttonText$ = testLoading$.pipe(
    map((loading) => (loading.openai || loading.together ? "Testing..." : "Test Connections")),
  );

  const openaiStatus$ = testLoading$.pipe(
    mergeMap((loading) =>
      testResults$.pipe(
        mergeMap((results) =>
          testErrors$.pipe(
            map((errors) => {
              if (!apiKeys.openai) return "✗ Not set";
              if (loading.openai) return "? Testing...";
              if (errors.openai) return `✗ ${errors.openai}`;
              if (results.openai) return `✓ ${results.openai}`;
              return "✓ Set";
            }),
          ),
        ),
      ),
    ),
  );

  const togetherStatus$ = testLoading$.pipe(
    mergeMap((loading) =>
      testResults$.pipe(
        mergeMap((results) =>
          testErrors$.pipe(
            map((errors) => {
              if (!apiKeys.together) return html`✗ Not set`;
              if (loading.together) return html`? Testing...`;
              if (errors.together) return html`✗ ${errors.together}`;
              if (results.together) return html`✓ <a href="${results.together}" target="_blank">View image</a>`;
              return html`✓ Set`;
            }),
          ),
        ),
      ),
    ),
  );

  const clearTestResults = (provider: keyof ApiKeys) => {
    const currentResults = testResults$.value;
    const currentErrors = testErrors$.value;
    testResults$.next({ ...currentResults, [provider]: undefined });
    testErrors$.next({ ...currentErrors, [provider]: undefined });
  };

  const handleOpenAIChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    onApiKeyChange.next({ provider: "openai", value: input.value });
    clearTestResults("openai");
  };

  const handleTogetherChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    onApiKeyChange.next({ provider: "together", value: input.value });
    clearTestResults("together");
  };

  const handleTestSubmit = (e: Event) => {
    e.preventDefault();

    // Test OpenAI first
    if (apiKeys.openai) {
      testConnection$.next({ provider: "openai" });
    }
    // Then test Together.ai
    if (apiKeys.together) {
      testConnection$.next({ provider: "together" });
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

      <button type="submit" ?disabled=${observe(isDisabled$)}>${observe(buttonText$)}</button>

      <div class="form-status">
        <small> OpenAI: ${observe(openaiStatus$)} | Together.ai: ${observe(togetherStatus$)} </small>
      </div>
    </form>
  `;
}
