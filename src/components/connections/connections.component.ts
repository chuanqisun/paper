import { html } from "lit-html";
import { BehaviorSubject, Subject, ignoreElements, map, merge, mergeWith, of } from "rxjs";
import { catchError, debounceTime, distinctUntilChanged, mergeMap, tap } from "rxjs/operators";
import { createComponent } from "../../sdk/create-component";
import { observe } from "../../sdk/observe-directive";
import "./connections.component.css";
import { saveApiKeys, type ApiKeys } from "./storage";
import { testConnection } from "./test-connections";

export interface ConnectionsComponentProps {
  apiKeys$: BehaviorSubject<ApiKeys>;
}

export const ConnectionsComponent = createComponent((props: ConnectionsComponentProps) => {
  // 1. Internal state
  const { apiKeys$ } = props;
  const testResults$ = new BehaviorSubject<{ openai?: string; together?: string; gemini?: string }>({});
  const testErrors$ = new BehaviorSubject<{ openai?: string; together?: string; gemini?: string }>({});
  const testLoading$ = new BehaviorSubject<{ openai?: boolean; together?: boolean; gemini?: boolean }>({});

  // 2. Actions (user interactions)
  const apiKeyChange$ = new Subject<{ provider: keyof ApiKeys; value: string }>();
  const testConnection$ = new Subject<{ provider: "openai" | "together" | "gemini" }>();

  // 3. Effects (state changes)
  const persistKeys$ = apiKeyChange$.pipe(
    debounceTime(300),
    distinctUntilChanged((a, b) => a.provider === b.provider && a.value === b.value),
    tap(({ provider, value }) => {
      const currentKeys = apiKeys$.value;
      const updatedKeys = { ...currentKeys, [provider]: value };
      apiKeys$.next(updatedKeys);
      saveApiKeys(updatedKeys);
    }),
  );

  const handleTestConnection$ = testConnection$.pipe(
    tap(({ provider }) => {
      const currentLoading = testLoading$.value;
      testLoading$.next({ ...currentLoading, [provider]: true });
    }),
    mergeMap(({ provider }) =>
      testConnection({
        provider,
        apiKeys: apiKeys$.value,
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

  // Helper functions
  const clearTestResults = (provider: keyof ApiKeys) => {
    const currentResults = testResults$.value;
    const currentErrors = testErrors$.value;
    testResults$.next({ ...currentResults, [provider]: undefined });
    testErrors$.next({ ...currentErrors, [provider]: undefined });
  };

  const handleOpenAIChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    apiKeyChange$.next({ provider: "openai", value: input.value });
    clearTestResults("openai");
  };

  const handleTogetherChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    apiKeyChange$.next({ provider: "together", value: input.value });
    clearTestResults("together");
  };

  const handleGeminiChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    apiKeyChange$.next({ provider: "gemini", value: input.value });
    clearTestResults("gemini");
  };

  const handleTestSubmit = (e: Event) => {
    e.preventDefault();

    const currentApiKeys = apiKeys$.value;
    // Test OpenAI first
    if (currentApiKeys.openai) {
      testConnection$.next({ provider: "openai" });
    }
    // Then test Together.ai
    if (currentApiKeys.together) {
      testConnection$.next({ provider: "together" });
    }
    // Then test Gemini
    if (currentApiKeys.gemini) {
      testConnection$.next({ provider: "gemini" });
    }
  };

  // Derived observables for template
  const isDisabled$ = testLoading$.pipe(
    mergeMap((loading) =>
      apiKeys$.pipe(
        map(
          (apiKeys) =>
            loading.openai ||
            loading.together ||
            loading.gemini ||
            (!apiKeys.openai && !apiKeys.together && !apiKeys.gemini),
        ),
      ),
    ),
  );

  const buttonText$ = testLoading$.pipe(
    map((loading) => (loading.openai || loading.together || loading.gemini ? "Testing..." : "Test Connections")),
  );

  const openaiStatus$ = testLoading$.pipe(
    mergeMap((loading) =>
      testResults$.pipe(
        mergeMap((results) =>
          testErrors$.pipe(
            mergeMap((errors) =>
              apiKeys$.pipe(
                map((apiKeys) => {
                  if (!apiKeys.openai) return "✗ Not set";
                  if (loading.openai) return `Testing...`;
                  if (errors.openai) return `✗ ${errors.openai}`;
                  if (results.openai) return `✓ ${results.openai}`;
                  return "✓ Set";
                }),
              ),
            ),
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
            mergeMap((errors) =>
              apiKeys$.pipe(
                map((apiKeys) => {
                  if (!apiKeys.together) return html`✗ Not set`;
                  if (loading.together) return html`Testing...`;
                  if (errors.together) return html`✗ ${errors.together}`;
                  if (results.together) return html`✓ <a href="${results.together}" target="_blank">View image</a>`;
                  return html`✓ Set`;
                }),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  const geminiStatus$ = testLoading$.pipe(
    mergeMap((loading) =>
      testResults$.pipe(
        mergeMap((results) =>
          testErrors$.pipe(
            mergeMap((errors) =>
              apiKeys$.pipe(
                map((apiKeys) => {
                  if (!apiKeys.gemini) return "✗ Not set";
                  if (loading.gemini) return "Testing...";
                  if (errors.gemini) return `✗ ${errors.gemini}`;
                  if (results.gemini) return `✓ ${results.gemini}`;
                  return "✓ Set";
                }),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  const effects$ = merge(persistKeys$, handleTestConnection$).pipe(ignoreElements());

  // 4. Combine state and template
  const template$ = apiKeys$.pipe(
    map(
      (apiKeys) => html`
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

          <div class="form-field">
            <label for="gemini-key">Gemini API Key</label>
            <input
              id="gemini-key"
              type="password"
              value=${apiKeys.gemini || ""}
              placeholder="API key for Google Gemini"
              @input=${handleGeminiChange}
            />
          </div>

          <button type="submit" ?disabled=${observe(isDisabled$)}>${observe(buttonText$)}</button>

          <div class="form-status">
            <small>OpenAI: ${observe(openaiStatus$)}</small><br />
            <small>Together.ai: ${observe(togetherStatus$)}</small><br />
            <small>Gemini: ${observe(geminiStatus$)}</small>
          </div>
        </form>
      `,
    ),
    mergeWith(effects$),
  );

  return template$;
});
