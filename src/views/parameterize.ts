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
  take,
  tap,
} from "rxjs";
import type { Parameter } from "../lib/generate-parameters";
import { regenerateParameterDescription$, streamParameters$ } from "../lib/generate-parameters";
import { observe } from "../lib/observe-directive";
import type { ApiKeys } from "../lib/storage";
import type { ConceptWithId } from "./conceptualize.js";
import "./parameterize.css";
import type { ArtifactWithId } from "./visualize.js";

export interface ParameterWithId extends Parameter {
  id: string;
  pinned: boolean;
}

export function parameterizeView(
  apiKeys$: Observable<ApiKeys>,
  concepts$: Observable<ConceptWithId[]>,
  artifacts$: Observable<ArtifactWithId[]>,
  parti$: Observable<string>,
) {
  // Internal state
  const parameters$ = new BehaviorSubject<ParameterWithId[]>([]);
  const rejectedParameters$ = new BehaviorSubject<string[]>([]);
  const isGenerating$ = new BehaviorSubject<boolean>(false);
  const domain$ = new BehaviorSubject<string>("");
  const newParameterName$ = new BehaviorSubject<string>("");
  const isGeneratingDescription$ = new BehaviorSubject<boolean>(false);

  // Actions
  const generateParameters$ = new Subject<void>();
  const editParameter$ = new Subject<{ id: string; field: "name" | "description"; value: string }>();
  const pinParameter$ = new Subject<string>();
  const rejectParameter$ = new Subject<string>();
  const revertRejection$ = new Subject<string>();
  const clearAllRejected$ = new Subject<void>();
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
    switchMap(() =>
      // Take current values at the moment the user action is triggered, not reactive to future changes
      combineLatest([apiKeys$, concepts$, artifacts$, parti$, domain$]).pipe(
        take(1), // Only take the current values, don't react to future changes
        map(([apiKeys, concepts, artifacts, parti, domain]) => ({
          parti,
          domain,
          apiKey: apiKeys.openai,
          concepts: concepts.map((c) => ({ name: c.concept, description: c.description })),
          artifacts: artifacts.map((a) => ({ name: a.name, description: a.description })),
        })),
        switchMap(({ parti, domain, apiKey, concepts, artifacts }) => {
          if (!apiKey) {
            console.error("OpenAI API key not found");
            isGenerating$.next(false);
            return EMPTY;
          }

          if (!parti) {
            console.error("Parti not found");
            isGenerating$.next(false);
            return EMPTY;
          }

          if (!domain.trim()) {
            console.error("Domain is required");
            isGenerating$.next(false);
            return EMPTY;
          }

          if (concepts.length === 0) {
            console.error("No concepts available");
            isGenerating$.next(false);
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

  // Clear all rejected effect
  const clearAllRejectedEffect$ = clearAllRejected$.pipe(
    tap(() => {
      rejectedParameters$.next([]);
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
          <div class="domain-input">
            <label for="domain">Constrain design to parameters specific to a domain</label>
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
                generateParameters$.next();
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
                            ? html`<button class="small" @click=${() => pinParameter$.next(parameter.id)}>
                                ✅ Pinned
                              </button>`
                            : html`
                                <button class="small" @click=${() => pinParameter$.next(parameter.id)}>Pin</button>
                                <button class="small" @click=${() => rejectParameter$.next(parameter.id)}>
                                  Reject
                                </button>
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
                      <div class="rejected-list-header">
                        <button class="small" @click=${() => clearAllRejected$.next()}>Clear all</button>
                      </div>
                      ${rejectedParameters.map(
                        (parameter) => html`
                          <div class="rejected-item">
                            <span>${parameter}</span>
                            <button class="small" @click=${() => revertRejection$.next(parameter)}>Restore</button>
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
    clearAllRejectedEffect$,
    updateDomainEffect$,
    addManualEffect$,
  );

  const staticTemplate = html`${observe(template$)}`;

  return {
    parameterizeTemplate: staticTemplate,
    parameters$,
    domain$,
    effects$,
  };
}
