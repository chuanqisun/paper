import { html } from "lit-html";
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subject,
  catchError,
  combineLatest,
  map,
  merge,
  switchMap,
  tap,
} from "rxjs";
import type { Parameter } from "../lib/generate-parameters";
import { regenerateParameterDescription$, streamParameters$ } from "../lib/generate-parameters";
import { observe } from "../lib/observe-directive";
import type { ApiKeys } from "../lib/storage";
import "./parameterize.css";

export interface ParameterWithId extends Parameter {
  id: string;
  pinned: boolean;
}

export function parameterizeView(
  apiKeys$: Observable<ApiKeys>,
  concepts$: Observable<any[]>,
  artifacts$: Observable<any[]>,
) {
  // Internal state
  const parameters$ = new BehaviorSubject<ParameterWithId[]>([]);
  const rejectedParameters$ = new BehaviorSubject<string[]>([]);
  const isGenerating$ = new BehaviorSubject<boolean>(false);
  const domain$ = new BehaviorSubject<string>("");
  const newParameterName$ = new BehaviorSubject<string>("");
  const isGeneratingDescription$ = new BehaviorSubject<boolean>(false);

  // Actions
  const generateParameters$ = new Subject<{ parti: string; domain: string }>();
  const editParameter$ = new Subject<{ id: string; field: "name" | "description"; value: string }>();
  const pinParameter$ = new Subject<string>();
  const rejectParameter$ = new Subject<string>();
  const revertRejection$ = new Subject<string>();
  const updateDomain$ = new Subject<string>();
  const addManualParameter$ = new Subject<void>();

  // Update domain effect
  const updateDomainEffect$ = updateDomain$.pipe(tap((domain) => domain$.next(domain)));

  // Generate parameters effect
  const generateEffect$ = generateParameters$.pipe(
    tap(() => {
      isGenerating$.next(true);

      // Move unpinned parameters to rejected list
      const currentParameters = parameters$.value;
      const maybeParameters = currentParameters.filter((p) => !p.pinned);
      const pinnedParameters = currentParameters.filter((p) => p.pinned);

      if (maybeParameters.length > 0) {
        const newRejected = [...rejectedParameters$.value, ...maybeParameters.map((p) => p.name)];
        rejectedParameters$.next(newRejected);
      }

      parameters$.next(pinnedParameters);
    }),
    switchMap(({ parti, domain }) =>
      combineLatest([apiKeys$, concepts$, artifacts$]).pipe(
        map(([apiKeys, concepts, artifacts]) => ({
          parti,
          domain,
          apiKey: apiKeys.openai,
          concepts: concepts.map((c) => ({ name: c.concept, description: c.description })),
          artifacts: artifacts.map((a) => ({ name: a.name, description: a.description })),
        })),
        switchMap(({ parti, domain, apiKey, concepts, artifacts }) => {
          if (!apiKey) {
            console.error("OpenAI API key not found");
            return EMPTY;
          }

          if (!domain.trim()) {
            console.error("Domain is required");
            return EMPTY;
          }

          if (concepts.length === 0) {
            console.error("No concepts available");
            return EMPTY;
          }

          const existingParameters = parameters$.value.map((p) => p.name);
          const rejectedParameters = rejectedParameters$.value;

          return streamParameters$({
            parti,
            domain,
            concepts,
            artifacts,
            existingParameters,
            rejectedParameters,
            apiKey,
          }).pipe(
            map((parameter) => ({
              ...parameter,
              id: Math.random().toString(36).substr(2, 9),
              pinned: false,
            })),
            tap((parameter) => {
              const current = parameters$.value;
              parameters$.next([...current, parameter]);
            }),
            catchError((error) => {
              console.error("Error generating parameters:", error);
              return EMPTY;
            }),
          );
        }),
      ),
    ),
    tap(() => isGenerating$.next(false)),
  );

  // Edit parameter effect
  const editEffect$ = editParameter$.pipe(
    tap(({ id, field, value }) => {
      const parameters = parameters$.value.map((p) => (p.id === id ? { ...p, [field]: value } : p));
      parameters$.next(parameters);
    }),
  );

  // Pin parameter effect
  const pinEffect$ = pinParameter$.pipe(
    tap((id) => {
      const parameters = parameters$.value.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p));
      parameters$.next(parameters);
    }),
  );

  // Reject parameter effect
  const rejectEffect$ = rejectParameter$.pipe(
    tap((id) => {
      const parameter = parameters$.value.find((p) => p.id === id);
      if (parameter) {
        const remaining = parameters$.value.filter((p) => p.id !== id);
        const rejected = [...rejectedParameters$.value, parameter.name];
        parameters$.next(remaining);
        rejectedParameters$.next(rejected);
      }
    }),
  );

  // Revert rejection effect
  const revertEffect$ = revertRejection$.pipe(
    tap((rejectedParameter) => {
      const rejected = rejectedParameters$.value.filter((p) => p !== rejectedParameter);
      rejectedParameters$.next(rejected);
    }),
  );

  // Add manual parameter effect
  const addManualEffect$ = addManualParameter$.pipe(
    tap(() => isGeneratingDescription$.next(true)),
    switchMap(() =>
      apiKeys$.pipe(
        map((apiKeys) => ({
          parameterName: newParameterName$.value.trim(),
          domain: domain$.value,
          apiKey: apiKeys.openai,
          existingParameters: parameters$.value.map((p) => ({ name: p.name, description: p.description })),
        })),
        switchMap(({ parameterName, domain, apiKey, existingParameters }) => {
          if (!parameterName || !domain || !apiKey) {
            isGeneratingDescription$.next(false);
            return EMPTY;
          }

          return regenerateParameterDescription$({ parameterName, domain, apiKey, existingParameters }).pipe(
            tap((description) => {
              const newParameter: ParameterWithId = {
                id: Math.random().toString(36).substr(2, 9),
                name: parameterName,
                description,
                pinned: true,
              };
              parameters$.next([newParameter, ...parameters$.value]);
              newParameterName$.next("");
              isGeneratingDescription$.next(false);
            }),
            catchError((error) => {
              console.error("Error generating parameter description:", error);
              isGeneratingDescription$.next(false);
              return EMPTY;
            }),
          );
        }),
      ),
    ),
  );

  // Template
  const template$ = combineLatest([
    parameters$,
    rejectedParameters$,
    isGenerating$,
    concepts$,
    artifacts$,
    domain$,
    newParameterName$,
    isGeneratingDescription$,
  ]).pipe(
    map(
      ([
        parameters,
        rejectedParameters,
        isGenerating,
        concepts,
        ,
        domain,
        newParameterName,
        isGeneratingDescription,
      ]) => html`
        <div class="parameterize">
          <p>Generate design parameters relevant to your product domain</p>

          <div class="domain-input">
            <label for="domain">Product Domain *</label>
            <input
              id="domain"
              type="text"
              placeholder="e.g., packaging, clothing, personal electronics"
              .value=${domain}
              @input=${(e: Event) => updateDomain$.next((e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="parameterize-actions">
            <button
              @click=${() => {
                const parti = (document.querySelector("#parti-content textarea") as HTMLTextAreaElement)?.value || "";
                const currentDomain = domain$.value;
                if (parti && currentDomain.trim()) {
                  generateParameters$.next({ parti, domain: currentDomain });
                }
              }}
              ?disabled=${!domain.trim() || concepts.length === 0}
            >
              Generate Parameters
            </button>
            <textarea
              rows="1"
              placeholder="New parameter..."
              .value=${newParameterName}
              @input=${(e: Event) => newParameterName$.next((e.target as HTMLTextAreaElement).value)}
              ?disabled=${isGeneratingDescription || !domain.trim()}
            ></textarea>
            <button
              @click=${() => addManualParameter$.next()}
              ?disabled=${isGeneratingDescription || !newParameterName.trim() || !domain.trim()}
            >
              ${isGeneratingDescription ? "Generating..." : "Add Parameter"}
            </button>
          </div>

          ${isGenerating ? html`<div class="loading">Generating parameters...</div>` : ""}
          ${parameters.length > 0
            ? html`
                <div class="parameters-list">
                  ${parameters.map(
                    (parameter) => html`
                      <div class="parameter-card ${parameter.pinned ? "pinned" : ""}">
                        <textarea
                          class="parameter-name"
                          rows="1"
                          .value=${parameter.name}
                          @input=${(e: Event) =>
                            editParameter$.next({
                              id: parameter.id,
                              field: "name",
                              value: (e.target as HTMLTextAreaElement).value,
                            })}
                        ></textarea>
                        <textarea
                          class="parameter-description"
                          .value=${parameter.description}
                          @input=${(e: Event) =>
                            editParameter$.next({
                              id: parameter.id,
                              field: "description",
                              value: (e.target as HTMLTextAreaElement).value,
                            })}
                        ></textarea>
                        <div class="parameter-actions">
                          ${parameter.pinned
                            ? html`<button @click=${() => pinParameter$.next(parameter.id)}>✅ Pinned</button>`
                            : html`
                                <button @click=${() => pinParameter$.next(parameter.id)}>Pin</button>
                                <button @click=${() => rejectParameter$.next(parameter.id)}>Reject</button>
                              `}
                        </div>
                      </div>
                    `,
                  )}
                </div>
              `
            : ""}
          ${rejectedParameters.length > 0
            ? html`
                <div class="rejected-parameters">
                  <details>
                    <summary>Rejected parameters (${rejectedParameters.length})</summary>
                    <div class="rejected-list">
                      ${rejectedParameters.map(
                        (parameter) => html`
                          <div class="rejected-item">
                            <span>${parameter}</span>
                            <button @click=${() => revertRejection$.next(parameter)}>Restore</button>
                          </div>
                        `,
                      )}
                    </div>
                  </details>
                </div>
              `
            : ""}
        </div>
      `,
    ),
  );

  // Merge all effects
  const effects$ = merge(
    generateEffect$,
    editEffect$,
    pinEffect$,
    rejectEffect$,
    revertEffect$,
    updateDomainEffect$,
    addManualEffect$,
  );

  const staticTemplate = html`${observe(template$)}`;

  return {
    parameterizeTemplate: staticTemplate,
    parameters$,
    effects$,
  };
}
