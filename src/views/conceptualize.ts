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
import type { Concept } from "../lib/generate-concepts";
import { regenerateDescription$, streamConcepts$ } from "../lib/generate-concepts";
import { observe } from "../lib/observe-directive";
import type { ApiKeys } from "../lib/storage";
import "./conceptualize.css";

export interface ConceptWithId extends Concept {
  id: string;
  pinned: boolean;
}

export function conceptualMappingView(apiKeys$: Observable<ApiKeys>, parti$: Observable<string>) {
  // Internal state
  const concepts$ = new BehaviorSubject<ConceptWithId[]>([]);
  const rejectedConcepts$ = new BehaviorSubject<string[]>([]);
  const isGenerating$ = new BehaviorSubject<boolean>(false);
  const newConceptTitle$ = new BehaviorSubject<string>("");
  const isGeneratingDescription$ = new BehaviorSubject<boolean>(false);

  // Actions
  const generateConcepts$ = new Subject<void>();
  const editConcept$ = new Subject<{ id: string; field: "concept" | "description"; value: string }>();
  const deleteConcept$ = new Subject<string>();
  const favoriteConcept$ = new Subject<string>();
  const rejectConcept$ = new Subject<string>();
  const revertRejection$ = new Subject<string>();
  const clearAllRejected$ = new Subject<void>();
  const addManualConcept$ = new Subject<void>();

  // Generate concepts effect
  const generateEffect$ = generateConcepts$.pipe(
    tap(() => {
      isGenerating$.next(true);

      // Move unfavorited concepts to rejected list
      const currentConcepts = concepts$.value;
      const maybeConcepts = currentConcepts.filter((c) => !c.pinned);
      const pinnedConcepts = currentConcepts.filter((c) => c.pinned);

      if (maybeConcepts.length > 0) {
        const newRejectedConcepts = maybeConcepts.map((c) => c.concept);
        rejectedConcepts$.next([...rejectedConcepts$.value, ...newRejectedConcepts]);
        concepts$.next(pinnedConcepts);
      }
    }),
    switchMap(() =>
      // Take current values at the moment the user action is triggered, not reactive to future changes
      combineLatest([parti$, apiKeys$]).pipe(
        take(1), // Only take the current values, don't react to future changes
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
          );
        }),
      ),
    ),
    tap(() => isGenerating$.next(false)),
  );

  // Edit concept effect
  const editEffect$ = editConcept$.pipe(
    tap(({ id, field, value }) => {
      const concepts = concepts$.value.map((c) => (c.id === id ? { ...c, [field]: value } : c));
      concepts$.next(concepts);
    }),
  );

  // Delete concept effect
  const deleteEffect$ = deleteConcept$.pipe(
    tap((id) => {
      const concepts = concepts$.value.filter((c) => c.id !== id);
      concepts$.next(concepts);
    }),
  );

  // Favorite concept effect
  const favoriteEffect$ = favoriteConcept$.pipe(
    tap((id) => {
      const concepts = concepts$.value.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c));
      concepts$.next(concepts);
    }),
  );

  // Reject concept effect
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

  // Revert rejection effect
  const revertEffect$ = revertRejection$.pipe(
    tap((rejectedConcept) => {
      const rejected = rejectedConcepts$.value.filter((c) => c !== rejectedConcept);
      rejectedConcepts$.next(rejected);
    }),
  );

  // Clear all rejected effect
  const clearAllRejectedEffect$ = clearAllRejected$.pipe(
    tap(() => {
      rejectedConcepts$.next([]);
    }),
  );

  // Add manual concept effect
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
            tap((description) => {
              const newConcept: ConceptWithId = {
                id: Math.random().toString(36).substr(2, 9),
                concept,
                description,
                pinned: true,
              };
              concepts$.next([newConcept, ...concepts$.value]);
              newConceptTitle$.next("");
              isGeneratingDescription$.next(false);
            }),
            catchError((error) => {
              console.error("Error generating description:", error);
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
          <div class="conceptual-actions">
            <button
              @click=${() => {
                generateConcepts$.next();
              }}
            >
              Generate Concepts
            </button>
            <textarea
              rows="1"
              placeholder="New concept..."
              .value=${newTitle}
              @input=${(e: Event) => newConceptTitle$.next((e.target as HTMLTextAreaElement).value)}
              ?disabled=${isGeneratingDescription}
            ></textarea>
            <button @click=${() => addManualConcept$.next()} ?disabled=${isGeneratingDescription || !newTitle.trim()}>
              ${isGeneratingDescription ? "Generating..." : "Add Concept"}
            </button>
          </div>

          ${isGenerating ? html`<div class="loading">Generating concepts...</div>` : ""}

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
  );

  // Merge all effects
  const effects$ = merge(
    generateEffect$,
    editEffect$,
    deleteEffect$,
    favoriteEffect$,
    rejectEffect$,
    revertEffect$,
    clearAllRejectedEffect$,
    addManualEffect$,
  );

  const staticTemplate = html`${observe(template$)}`;

  return {
    conceptualTemplate: staticTemplate,
    concepts$,
    effects$,
  };
}
