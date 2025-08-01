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
import type { ApiKeys } from "../connections/storage";
import "./conceptualize.component.css";
import type { Concept } from "./generate-concepts";
import { regenerateDescription$, streamConcepts$ } from "./generate-concepts";

export interface ConceptWithId extends Concept {
  id: string;
  pinned: boolean;
}

export interface ConceptualizeComponentProps {
  apiKeys$: Observable<ApiKeys>;
  partiText$: Observable<string>;
  concepts$: BehaviorSubject<ConceptWithId[]>;
}

export const ConceptualizeComponent = createComponent((props: ConceptualizeComponentProps) => {
  // 1. Internal state
  const { apiKeys$, partiText$, concepts$ } = props;
  const rejectedConcepts$ = new BehaviorSubject<string[]>([]);
  const isGenerating$ = new BehaviorSubject<boolean>(false);
  const newConceptTitle$ = new BehaviorSubject<string>("");
  const isGeneratingDescription$ = new BehaviorSubject<boolean>(false);

  // 2. Actions (user interactions)
  const generateConcepts$ = new Subject<void>();
  const stopGeneration$ = new Subject<void>();
  const editConcept$ = new Subject<{ id: string; field: "concept" | "description"; value: string }>();
  const deleteConcept$ = new Subject<string>();
  const favoriteConcept$ = new Subject<string>();
  const rejectConcept$ = new Subject<string>();
  const revertRejection$ = new Subject<string>();
  const clearAllRejected$ = new Subject<void>();
  const addManualConcept$ = new Subject<void>();
  const stopAddingConcept$ = new Subject<void>();
  const pinnedOnly$ = new Subject<void>();

  // 3. Effects (state changes)
  const generateEffect$ = generateConcepts$.pipe(
    tap(() => isGenerating$.next(true)),
    switchMap(() =>
      combineLatest([partiText$, apiKeys$]).pipe(
        take(1),
        map(([parti, apiKeys]) => ({ parti, apiKey: apiKeys.openai })),
        switchMap(({ parti, apiKey }) => {
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

          const existingConcepts = concepts$.value.map((c) => c.concept);
          const rejectedConcepts = rejectedConcepts$.value;

          return streamConcepts$({ parti, existingConcepts, rejectedConcepts, apiKey }).pipe(
            takeUntil(stopGeneration$),
            map((concept) => ({
              ...concept,
              id: Math.random().toString(36).substr(2, 9),
              pinned: false,
            })),
            tap((concept) => {
              concepts$.next([...concepts$.value, concept]);
            }),
            catchError((error) => {
              console.error("Error generating concepts:", error);
              return EMPTY;
            }),
            finalize(() => isGenerating$.next(false)),
          );
        }),
      ),
    ),
  );

  const editEffect$ = editConcept$.pipe(
    tap(({ id, field, value }) => {
      const concepts = concepts$.value.map((c) => (c.id === id ? { ...c, [field]: value } : c));
      concepts$.next(concepts);
    }),
  );

  const deleteEffect$ = deleteConcept$.pipe(
    tap((id) => {
      const concepts = concepts$.value.filter((c) => c.id !== id);
      concepts$.next(concepts);
    }),
  );

  const favoriteEffect$ = favoriteConcept$.pipe(
    tap((id) => {
      const concepts = concepts$.value.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c));
      concepts$.next(concepts);
    }),
  );

  const rejectEffect$ = rejectConcept$.pipe(
    tap((id) => {
      const concept = concepts$.value.find((c) => c.id === id);
      if (concept) {
        rejectedConcepts$.next([...rejectedConcepts$.value, concept.concept]);
        const concepts = concepts$.value.filter((c) => c.id !== id);
        concepts$.next(concepts);
      }
    }),
  );

  const revertEffect$ = revertRejection$.pipe(
    tap((rejectedConcept) => {
      const rejected = rejectedConcepts$.value.filter((c) => c !== rejectedConcept);
      rejectedConcepts$.next(rejected);
    }),
  );

  const clearAllRejectedEffect$ = clearAllRejected$.pipe(
    tap(() => {
      rejectedConcepts$.next([]);
    }),
  );

  const addManualEffect$ = addManualConcept$.pipe(
    tap(() => isGeneratingDescription$.next(true)),
    switchMap(() =>
      apiKeys$.pipe(
        map((apiKeys) => ({
          concept: newConceptTitle$.value.trim(),
          apiKey: apiKeys.openai,
          existingConcepts: concepts$.value.map((c) => ({ concept: c.concept, description: c.description })),
        })),
        switchMap(({ concept, apiKey, existingConcepts }) => {
          if (!concept || !apiKey) {
            isGeneratingDescription$.next(false);
            return EMPTY;
          }

          return regenerateDescription$({ concept, apiKey, existingConcepts }).pipe(
            takeUntil(stopAddingConcept$),
            tap((description) => {
              const newConcept: ConceptWithId = {
                id: Math.random().toString(36).substr(2, 9),
                concept,
                description,
                pinned: true,
              };
              concepts$.next([...concepts$.value, newConcept]);
              newConceptTitle$.next("");
              isGeneratingDescription$.next(false);
            }),
            catchError((error) => {
              console.error("Error generating description:", error);
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
      const currentConcepts = concepts$.value;
      const unpinnedConcepts = currentConcepts.filter((c) => !c.pinned);
      const pinnedConcepts = currentConcepts.filter((c) => c.pinned);

      const newRejectedConcepts = [...rejectedConcepts$.value, ...unpinnedConcepts.map((c) => c.concept)];
      rejectedConcepts$.next(newRejectedConcepts);

      concepts$.next(pinnedConcepts);
    }),
  );

  const effects$ = merge(
    generateEffect$,
    editEffect$,
    deleteEffect$,
    favoriteEffect$,
    rejectEffect$,
    revertEffect$,
    clearAllRejectedEffect$,
    addManualEffect$,
    pinnedOnlyEffect$,
  ).pipe(ignoreElements());

  // 4. Combine state and template
  const template$ = combineLatest([
    concepts$,
    rejectedConcepts$,
    isGenerating$,
    newConceptTitle$,
    isGeneratingDescription$,
  ]).pipe(
    map(
      ([concepts, rejectedConcepts, isGenerating, newTitle, isGeneratingDescription]) => html`
        <div class="conceptualize">
          <p>Explore related concepts that capture the essence of your Parti</p>

          <div class="concepts-list">
            ${concepts.map(
              (concept) => html`
                <div class="concept-item ${concept.pinned ? "favorite" : ""}">
                  <div class="concept-header">
                    <textarea
                      class="concept-title"
                      rows="1"
                      .value=${concept.concept}
                      @input=${(e: Event) =>
                        editConcept$.next({
                          id: concept.id,
                          field: "concept",
                          value: (e.target as HTMLTextAreaElement).value,
                        })}
                    ></textarea>
                    <div class="concept-actions">
                      <button class="small" @click=${() => favoriteConcept$.next(concept.id)}>
                        ${concept.pinned ? "✅ Pinned" : "Pin"}
                      </button>
                      ${concept.pinned
                        ? null
                        : html`<button class="small" @click=${() => rejectConcept$.next(concept.id)}>Reject</button>`}
                    </div>
                  </div>
                  <textarea
                    class="concept-description"
                    .value=${concept.description}
                    @input=${(e: Event) =>
                      editConcept$.next({
                        id: concept.id,
                        field: "description",
                        value: (e.target as HTMLTextAreaElement).value,
                      })}
                  ></textarea>
                </div>
              `,
            )}
          </div>

          <menu>
            <button
              @click=${() => {
                if (isGenerating) {
                  stopGeneration$.next();
                } else {
                  generateConcepts$.next();
                }
              }}
            >
              ${isGenerating ? "Stop generating" : "Generate Concepts"}
            </button>
            ${concepts.length ? html`<button @click=${() => pinnedOnly$.next()}>Reject unpinned</button>` : ""}
            <textarea
              rows="1"
              placeholder="New concept..."
              .value=${newTitle}
              @input=${(e: Event) => newConceptTitle$.next((e.target as HTMLTextAreaElement).value)}
              ?disabled=${isGeneratingDescription}
            ></textarea>
            <button
              @click=${() => {
                if (isGeneratingDescription) {
                  stopAddingConcept$.next();
                } else {
                  addManualConcept$.next();
                }
              }}
              ?disabled=${!newTitle.trim() && !isGeneratingDescription}
            >
              ${isGeneratingDescription ? "Stop adding" : "Add Concept"}
            </button>
          </menu>

          ${rejectedConcepts.length > 0
            ? html`
                <div class="rejected-concepts">
                  <details>
                    <summary>Rejected concepts (${rejectedConcepts.length})</summary>
                    <div class="rejected-list">
                      <div class="rejected-list-header">
                        <button class="small" @click=${() => clearAllRejected$.next()}>Clear all</button>
                      </div>
                      ${rejectedConcepts.map(
                        (concept) => html`
                          <div class="rejected-item">
                            <span>${concept}</span>
                            <button class="small" @click=${() => revertRejection$.next(concept)}>Restore</button>
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
