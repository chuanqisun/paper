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
import type { Concept } from "../lib/get-json-streams";
import { regenerateConcept$, regenerateDescription$, streamConcepts$ } from "../lib/get-json-streams";
import { observe } from "../lib/observe-directive";
import type { ApiKeys } from "../lib/storage";

interface ConceptWithId extends Concept {
  id: string;
  favorite: boolean;
  editing: "none" | "concept" | "description";
}

export function conceptualMappingView(apiKeys$: Observable<ApiKeys>) {
  // Internal state
  const concepts$ = new BehaviorSubject<ConceptWithId[]>([]);
  const rejectedConcepts$ = new BehaviorSubject<string[]>([]);
  const isGenerating$ = new BehaviorSubject<boolean>(false);
  const newConceptTitle$ = new BehaviorSubject<string>("");
  const newConceptDescription$ = new BehaviorSubject<string>("");

  // Actions
  const generateConcepts$ = new Subject<{ parti: string }>();
  const editConcept$ = new Subject<{ id: string; field: "concept" | "description"; value: string }>();
  const toggleEdit$ = new Subject<{ id: string; field: "concept" | "description" }>();
  const deleteConcept$ = new Subject<string>();
  const favoriteConcept$ = new Subject<string>();
  const rejectConcept$ = new Subject<string>();
  const revertRejection$ = new Subject<string>();
  const addManualConcept$ = new Subject<void>();
  const regenerateConceptText$ = new Subject<{ id: string }>();
  const regenerateConceptDesc$ = new Subject<{ id: string }>();

  // Generate concepts effect
  const generateEffect$ = generateConcepts$.pipe(
    tap(() => {
      isGenerating$.next(true);

      // Move unfavorited concepts to rejected list
      const currentConcepts = concepts$.value;
      const unfavoritedConcepts = currentConcepts.filter((c) => !c.favorite);
      const favoritedConcepts = currentConcepts.filter((c) => c.favorite);

      if (unfavoritedConcepts.length > 0) {
        const newRejectedConcepts = unfavoritedConcepts.map((c) => c.concept);
        rejectedConcepts$.next([...rejectedConcepts$.value, ...newRejectedConcepts]);
        concepts$.next(favoritedConcepts);
      }
    }),
    switchMap(({ parti }) =>
      apiKeys$.pipe(
        map((apiKeys) => ({ parti, apiKey: apiKeys.openai })),
        switchMap(({ parti, apiKey }) => {
          if (!apiKey) {
            console.error("OpenAI API key not found");
            isGenerating$.next(false);
            return EMPTY;
          }

          const existingConcepts = concepts$.value.map((c) => c.concept);
          const rejectedConcepts = rejectedConcepts$.value;

          return streamConcepts$({ parti, existingConcepts, rejectedConcepts, apiKey }).pipe(
            map((concept) => ({
              ...concept,
              id: Math.random().toString(36).substr(2, 9),
              favorite: false,
              editing: "none" as const,
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

  // Toggle edit effect
  const toggleEditEffect$ = toggleEdit$.pipe(
    tap(({ id, field }) => {
      const concepts = concepts$.value.map((c) =>
        c.id === id
          ? { ...c, editing: c.editing === field ? ("none" as const) : field }
          : { ...c, editing: "none" as const },
      );
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
      const concepts = concepts$.value.map((c) => (c.id === id ? { ...c, favorite: !c.favorite } : c));
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

  // Add manual concept effect
  const addManualEffect$ = addManualConcept$.pipe(
    tap(() => {
      const title = newConceptTitle$.value.trim();
      const description = newConceptDescription$.value.trim();

      if (title && description) {
        const newConcept: ConceptWithId = {
          id: Math.random().toString(36).substr(2, 9),
          concept: title,
          description,
          favorite: false,
          editing: "none",
        };
        concepts$.next([...concepts$.value, newConcept]);
        newConceptTitle$.next("");
        newConceptDescription$.next("");
      }
    }),
  );

  // Regenerate concept text effect
  const regenerateTextEffect$ = regenerateConceptText$.pipe(
    switchMap(({ id }) =>
      apiKeys$.pipe(
        map((apiKeys) => ({ id, apiKey: apiKeys.openai })),
        switchMap(({ id, apiKey }) => {
          if (!apiKey) {
            console.error("OpenAI API key not found");
            return EMPTY;
          }

          const concept = concepts$.value.find((c) => c.id === id);
          if (!concept) return EMPTY;

          return regenerateConcept$({ description: concept.description, apiKey }).pipe(
            tap((newConcept) => {
              const concepts = concepts$.value.map((c) => (c.id === id ? { ...c, concept: newConcept } : c));
              concepts$.next(concepts);
            }),
            catchError((error) => {
              console.error("Error regenerating concept:", error);
              return EMPTY;
            }),
          );
        }),
      ),
    ),
  );

  // Regenerate description effect
  const regenerateDescEffect$ = regenerateConceptDesc$.pipe(
    switchMap(({ id }) =>
      apiKeys$.pipe(
        map((apiKeys) => ({ id, apiKey: apiKeys.openai })),
        switchMap(({ id, apiKey }) => {
          if (!apiKey) {
            console.error("OpenAI API key not found");
            return EMPTY;
          }

          const concept = concepts$.value.find((c) => c.id === id);
          if (!concept) return EMPTY;

          return regenerateDescription$({ concept: concept.concept, apiKey }).pipe(
            tap((newDescription) => {
              const concepts = concepts$.value.map((c) => (c.id === id ? { ...c, description: newDescription } : c));
              concepts$.next(concepts);
            }),
            catchError((error) => {
              console.error("Error regenerating description:", error);
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
    newConceptDescription$,
  ]).pipe(
    map(
      ([concepts, rejectedConcepts, isGenerating, newTitle, newDescription]) => html`
        <div class="conceptual-mapping">
          ${concepts.length === 0 && !isGenerating
            ? html`
                <div class="conceptual-placeholder">
                  <p>Add concepts that represent your Parti. You can:</p>
                  <ul>
                    <li>Generate concepts using AI</li>
                    <li>Manually add your own concepts</li>
                    <li>Edit, favorite, or reject concepts</li>
                    <li>Regenerate concept names or descriptions</li>
                  </ul>
                </div>
              `
            : ""}

          <div class="conceptual-actions">
            <button
              @click=${() => {
                const parti = (document.querySelector("#parti-content textarea") as HTMLTextAreaElement)?.value || "";
                if (parti) {
                  generateConcepts$.next({ parti });
                }
              }}
            >
              Generate Concepts
            </button>
          </div>

          ${isGenerating ? html`<div class="loading">Generating concepts...</div>` : ""}

          <div class="concepts-list">
            ${concepts.map(
              (concept) => html`
                <div class="concept-item ${concept.favorite ? "favorite" : ""}">
                  <div class="concept-header">
                    <div class="concept-title">
                      ${concept.editing === "concept"
                        ? html`
                            <input
                              .value=${concept.concept}
                              @input=${(e: Event) =>
                                editConcept$.next({
                                  id: concept.id,
                                  field: "concept",
                                  value: (e.target as HTMLInputElement).value,
                                })}
                              @blur=${() => toggleEdit$.next({ id: concept.id, field: "concept" })}
                              @keydown=${(e: KeyboardEvent) => {
                                if (e.key === "Enter" || e.key === "Escape") {
                                  toggleEdit$.next({ id: concept.id, field: "concept" });
                                }
                              }}
                            />
                          `
                        : html`
                            <span @click=${() => toggleEdit$.next({ id: concept.id, field: "concept" })}>
                              ${concept.concept}
                            </span>
                          `}
                    </div>
                    <div class="concept-actions">
                      <button @click=${() => favoriteConcept$.next(concept.id)}>${concept.favorite ? "★" : "☆"}</button>
                      <button
                        @click=${() => {
                          regenerateConceptText$.next({ id: concept.id });
                        }}
                      >
                        ⟲
                      </button>
                      <button @click=${() => rejectConcept$.next(concept.id)}>✕</button>
                    </div>
                  </div>
                  <div class="concept-description">
                    ${concept.editing === "description"
                      ? html`
                          <textarea
                            .value=${concept.description}
                            @input=${(e: Event) =>
                              editConcept$.next({
                                id: concept.id,
                                field: "description",
                                value: (e.target as HTMLTextAreaElement).value,
                              })}
                            @blur=${() => toggleEdit$.next({ id: concept.id, field: "description" })}
                            @keydown=${(e: KeyboardEvent) => {
                              if (e.key === "Escape") {
                                toggleEdit$.next({ id: concept.id, field: "description" });
                              }
                            }}
                          ></textarea>
                        `
                      : html`
                          <span @click=${() => toggleEdit$.next({ id: concept.id, field: "description" })}>
                            ${concept.description}
                          </span>
                          <button
                            @click=${() => {
                              regenerateConceptDesc$.next({ id: concept.id });
                            }}
                          >
                            ⟲
                          </button>
                        `}
                  </div>
                </div>
              `,
            )}
          </div>

          <div class="manual-add">
            <input
              type="text"
              placeholder="New concept..."
              .value=${newTitle}
              @input=${(e: Event) => newConceptTitle$.next((e.target as HTMLInputElement).value)}
            />
            <textarea
              placeholder="Description..."
              .value=${newDescription}
              @input=${(e: Event) => newConceptDescription$.next((e.target as HTMLTextAreaElement).value)}
            ></textarea>
            <button @click=${() => addManualConcept$.next()}>Add Concept</button>
          </div>

          ${rejectedConcepts.length > 0
            ? html`
                <div class="rejected-concepts">
                  <details>
                    <summary>Rejected concepts (${rejectedConcepts.length})</summary>
                    <div class="rejected-list">
                      ${rejectedConcepts.map(
                        (concept) => html`
                          <div class="rejected-item">
                            <span>${concept}</span>
                            <button @click=${() => revertRejection$.next(concept)}>Restore</button>
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
    toggleEditEffect$,
    deleteEffect$,
    favoriteEffect$,
    rejectEffect$,
    revertEffect$,
    addManualEffect$,
    regenerateTextEffect$,
    regenerateDescEffect$,
  );

  const staticTemplate = html`${observe(template$)}`;

  return {
    conceptualTemplate: staticTemplate,
    concepts$,
    effects$,
  };
}
