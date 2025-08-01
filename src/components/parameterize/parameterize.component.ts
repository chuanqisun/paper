import { html } from "lit-html";
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subject,
  catchError,
  combineLatest,
  finalize,
  ignoreElements,
  map,
  merge,
  mergeWith,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { ConceptWithId } from "../conceptualize/conceptualize.component";
import type { ApiKeys } from "../connections/storage";
import type { ArtifactWithId } from "../moodboard/moodboard.component";
import type { Parameter } from "./generate-parameters";
import { regenerateParameterDescription$, streamParameters$ } from "./generate-parameters";
import "./parameterize.component.css";

export interface ParameterWithId extends Parameter {
  id: string;
  pinned: boolean;
}

export interface ParameterizeComponentProps {
  apiKeys$: Observable<ApiKeys>;
  concepts$: Observable<ConceptWithId[]>;
  artifacts$: Observable<ArtifactWithId[]>;
  partiText$: Observable<string>;
  parameters$: BehaviorSubject<ParameterWithId[]>;
  domain$: BehaviorSubject<string>;
}

export const ParameterizeComponent = createComponent((props: ParameterizeComponentProps) => {
  // 1. Internal state
  const { apiKeys$, concepts$, artifacts$, partiText$, parameters$, domain$ } = props;
  const rejectedParameters$ = new BehaviorSubject<string[]>([]);
  const isGenerating$ = new BehaviorSubject<boolean>(false);
  const newParameterName$ = new BehaviorSubject<string>("");
  const isGeneratingDescription$ = new BehaviorSubject<boolean>(false);

  // 2. Actions (user interactions)
  const generateParameters$ = new Subject<void>();
  const stopGeneration$ = new Subject<void>();
  const editParameter$ = new Subject<{ id: string; field: "name" | "description"; value: string }>();
  const pinParameter$ = new Subject<string>();
  const rejectParameter$ = new Subject<string>();
  const revertRejection$ = new Subject<string>();
  const clearAllRejected$ = new Subject<void>();
  const updateDomain$ = new Subject<string>();
  const addManualParameter$ = new Subject<void>();
  const stopAddingParameter$ = new Subject<void>();
  const pinnedOnly$ = new Subject<void>();

  // 3. Effects (state changes)
  const updateDomainEffect$ = updateDomain$.pipe(tap((domain) => domain$.next(domain)));

  const generateEffect$ = generateParameters$.pipe(
    tap(() => isGenerating$.next(true)),
    switchMap(() =>
      combineLatest([apiKeys$, concepts$, artifacts$, partiText$, domain$]).pipe(
        take(1),
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
            takeUntil(stopGeneration$),
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
            finalize(() => isGenerating$.next(false)),
          );
        }),
      ),
    ),
  );

  const editEffect$ = editParameter$.pipe(
    tap(({ id, field, value }) => {
      const parameters = parameters$.value.map((p) => (p.id === id ? { ...p, [field]: value } : p));
      parameters$.next(parameters);
    }),
  );

  const pinEffect$ = pinParameter$.pipe(
    tap((id) => {
      const parameters = parameters$.value.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p));
      parameters$.next(parameters);
    }),
  );

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

  const revertEffect$ = revertRejection$.pipe(
    tap((rejectedParameter) => {
      const rejected = rejectedParameters$.value.filter((p) => p !== rejectedParameter);
      rejectedParameters$.next(rejected);
    }),
  );

  const clearAllRejectedEffect$ = clearAllRejected$.pipe(
    tap(() => {
      rejectedParameters$.next([]);
    }),
  );

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
            takeUntil(stopAddingParameter$),
            tap((description) => {
              const newParameter: ParameterWithId = {
                id: Math.random().toString(36).substr(2, 9),
                name: parameterName,
                description,
                pinned: true,
              };
              parameters$.next([...parameters$.value, newParameter]);
              newParameterName$.next("");
              isGeneratingDescription$.next(false);
            }),
            catchError((error) => {
              console.error("Error generating parameter description:", error);
              isGeneratingDescription$.next(false);
              return EMPTY;
            }),
            finalize(() => isGeneratingDescription$.next(false)),
          );
        }),
      ),
    ),
  );

  const pinnedOnlyEffect$ = pinnedOnly$.pipe(
    tap(() => {
      const currentParameters = parameters$.value;
      const unpinnedParameters = currentParameters.filter((p) => !p.pinned);
      const pinnedParameters = currentParameters.filter((p) => p.pinned);

      const newRejectedParameters = [...rejectedParameters$.value, ...unpinnedParameters.map((p) => p.name)];
      rejectedParameters$.next(newRejectedParameters);

      parameters$.next(pinnedParameters);
    }),
  );

  const effects$ = merge(
    updateDomainEffect$,
    generateEffect$,
    editEffect$,
    pinEffect$,
    rejectEffect$,
    revertEffect$,
    clearAllRejectedEffect$,
    addManualEffect$,
    pinnedOnlyEffect$,
  ).pipe(ignoreElements());

  // 4. Combine state and template
  const template$ = combineLatest([
    parameters$,
    rejectedParameters$,
    isGenerating$,
    domain$,
    newParameterName$,
    isGeneratingDescription$,
  ]).pipe(
    map(
      ([parameters, rejectedParameters, isGenerating, domain, newParameterName, isGeneratingDescription]) => html`
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
                        <menu>
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
                        </menu>
                      </div>
                    `,
                  )}
                </div>
              `
            : ""}
          ${domain
            ? html`<menu>
                <button
                  @click=${() => {
                    if (isGenerating) {
                      stopGeneration$.next();
                    } else {
                      generateParameters$.next();
                    }
                  }}
                >
                  ${isGenerating ? "Stop generating" : "Generate Parameters"}
                </button>
                ${parameters.length ? html`<button @click=${() => pinnedOnly$.next()}>Reject unpinned</button>` : ""}
                <textarea
                  rows="1"
                  placeholder="New parameter..."
                  .value=${newParameterName}
                  @input=${(e: Event) => newParameterName$.next((e.target as HTMLTextAreaElement).value)}
                  ?disabled=${isGeneratingDescription || !domain.trim()}
                ></textarea>
                <button
                  @click=${() => {
                    if (isGeneratingDescription) {
                      stopAddingParameter$.next();
                    } else {
                      addManualParameter$.next();
                    }
                  }}
                  ?disabled=${(!newParameterName.trim() && !isGeneratingDescription) || !domain.trim()}
                >
                  ${isGeneratingDescription ? "Stop adding" : "Add Parameter"}
                </button>
              </menu>`
            : null}
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
    mergeWith(effects$),
  );

  return template$;
});
