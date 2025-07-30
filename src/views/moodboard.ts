import { html } from "lit-html";
import { BehaviorSubject, Observable, Subject, combineLatest, merge } from "rxjs";
import { catchError, map, switchMap, take, tap } from "rxjs/operators";
import { streamArtifacts$, type Artifact } from "../lib/generate-artifacts.js";
import { observe } from "../lib/observe-directive.js";
import { type ApiKeys } from "../lib/storage.js";
import type { ConceptWithId } from "./conceptualize.js";
import "./moodboard.css";

export interface ArtifactWithId extends Artifact {
  id: string;
  pinned: boolean;
}

export function moodboardView(
  apiKeys$: Observable<ApiKeys>,
  concepts$: Observable<ConceptWithId[]>,
  parti$: Observable<string>,
) {
  // Internal state
  const artifacts$ = new BehaviorSubject<ArtifactWithId[]>([]);
  const rejectedArtifacts$ = new BehaviorSubject<string[]>([]);
  const isGenerating$ = new BehaviorSubject<boolean>(false);
  const editingArtifacts$ = new BehaviorSubject<string[]>([]);

  // Actions
  const generateArtifacts$ = new Subject<void>();
  const editArtifact$ = new Subject<{ id: string; field: "name" | "description"; value: string }>();
  const acceptArtifact$ = new Subject<string>();
  const rejectArtifact$ = new Subject<string>();
  const revertRejection$ = new Subject<string>();
  const clearAllRejected$ = new Subject<void>();
  const toggleEdit$ = new Subject<string>();
  const pinnedOnly$ = new Subject<void>();

  // Generate artifacts effect
  const generateEffect$ = generateArtifacts$.pipe(
    tap(() => isGenerating$.next(true)),
    switchMap(() =>
      // Take current values at the moment the user action is triggered, not reactive to future changes
      combineLatest([apiKeys$, concepts$, parti$]).pipe(
        take(1), // Only take the current values, don't react to future changes
        map(([apiKeys, concepts, parti]) => ({
          parti,
          apiKey: apiKeys.openai,
          concepts: concepts.map((c) => ({ name: c.concept, description: c.description })),
        })),
        switchMap(({ parti, apiKey, concepts }) => {
          if (!apiKey) {
            console.error("OpenAI API key not available");
            isGenerating$.next(false);
            return [];
          }

          if (!parti) {
            console.error("Parti not found");
            isGenerating$.next(false);
            return [];
          }

          if (concepts.length === 0) {
            console.error("No accepted concepts available");
            isGenerating$.next(false);
            return [];
          }

          const existingArtifacts = artifacts$.value.map((a) => a.name);
          const rejectedArtifacts = rejectedArtifacts$.value;

          return streamArtifacts$({ parti, concepts, existingArtifacts, rejectedArtifacts, apiKey }).pipe(
            map((artifact) => ({
              ...artifact,
              id: Math.random().toString(36).substr(2, 9),
              pinned: false,
            })),
            tap((artifact) => {
              artifacts$.next([...artifacts$.value, artifact]);
            }),
            catchError((error) => {
              console.error("Error generating artifacts:", error);
              return [];
            }),
          );
        }),
      ),
    ),
    tap(() => isGenerating$.next(false)),
  );

  // Edit artifact effect
  const editEffect$ = editArtifact$.pipe(
    tap(({ id, field, value }) => {
      const artifacts = artifacts$.value.map((a) => (a.id === id ? { ...a, [field]: value } : a));
      artifacts$.next(artifacts);
    }),
  );

  // Accept artifact effect
  const acceptEffect$ = acceptArtifact$.pipe(
    tap((id) => {
      const artifacts = artifacts$.value.map((a) => (a.id === id ? { ...a, pinned: !a.pinned } : a));
      artifacts$.next(artifacts);
    }),
  );

  // Reject artifact effect
  const rejectEffect$ = rejectArtifact$.pipe(
    tap((id) => {
      const artifact = artifacts$.value.find((a) => a.id === id);
      if (artifact) {
        const artifacts = artifacts$.value.filter((a) => a.id !== id);
        artifacts$.next(artifacts);
        rejectedArtifacts$.next([...rejectedArtifacts$.value, artifact.name]);
      }
    }),
  );

  // Revert rejection effect
  const revertEffect$ = revertRejection$.pipe(
    tap((rejectedArtifact) => {
      const rejected = rejectedArtifacts$.value.filter((a) => a !== rejectedArtifact);
      rejectedArtifacts$.next(rejected);
    }),
  );

  // Clear all rejected effect
  const clearAllRejectedEffect$ = clearAllRejected$.pipe(
    tap(() => {
      rejectedArtifacts$.next([]);
    }),
  );

  // Toggle edit effect
  const toggleEditEffect$ = toggleEdit$.pipe(
    tap((id) => {
      const editing = editingArtifacts$.value;
      if (editing.includes(id)) {
        editingArtifacts$.next(editing.filter((e) => e !== id));
      } else {
        editingArtifacts$.next([...editing, id]);
      }
    }),
  );

  // Pinned only effect
  const pinnedOnlyEffect$ = pinnedOnly$.pipe(
    tap(() => {
      const currentArtifacts = artifacts$.value;
      const unpinnedArtifacts = currentArtifacts.filter((a) => !a.pinned);
      const pinnedArtifacts = currentArtifacts.filter((a) => a.pinned);

      // Add unpinned artifacts to rejection list
      const newRejectedArtifacts = [...rejectedArtifacts$.value, ...unpinnedArtifacts.map((a) => a.name)];
      rejectedArtifacts$.next(newRejectedArtifacts);

      // Keep only pinned artifacts
      artifacts$.next(pinnedArtifacts);
    }),
  );

  // Template
  const template$ = combineLatest([artifacts$, rejectedArtifacts$, isGenerating$, editingArtifacts$]).pipe(
    map(
      ([artifacts, rejectedArtifacts, isGenerating, editingArtifacts]) => html`
        <div class="moodboard">
          <p>Generate artifacts that represent your Parti and accepted concepts</p>

          ${artifacts.length > 0
            ? html`
                <div class="cards-grid">
                  ${artifacts.map(
                    (artifact) => html`
                      <div class="media-card ${artifact.pinned ? "pinned" : ""}">
                        ${editingArtifacts.includes(artifact.id)
                          ? html`
                              <div class="card-edit-area">
                                <textarea
                                  class="card-edit-textarea"
                                  .value=${artifact.description}
                                  @input=${(e: Event) =>
                                    editArtifact$.next({
                                      id: artifact.id,
                                      field: "description",
                                      value: (e.target as HTMLTextAreaElement).value,
                                    })}
                                ></textarea>
                              </div>
                            `
                          : html`
                              <generative-image
                                class="card-image"
                                prompt="${artifact.description}"
                                width="400"
                                height="400"
                                title="${artifact.description}"
                              ></generative-image>
                            `}
                        <div class="card-content">
                          <textarea
                            class="card-name"
                            rows="1"
                            .value=${artifact.name}
                            @input=${(e: Event) =>
                              editArtifact$.next({
                                id: artifact.id,
                                field: "name",
                                value: (e.target as HTMLTextAreaElement).value,
                              })}
                          ></textarea>
                          <menu>
                            ${editingArtifacts.includes(artifact.id)
                              ? html`
                                  <button class="small" @click=${() => toggleEdit$.next(artifact.id)}>Done</button>
                                `
                              : artifact.pinned
                                ? html`
                                    <button class="small" @click=${() => acceptArtifact$.next(artifact.id)}>
                                      ✅ Pinned
                                    </button>
                                  `
                                : html`
                                    <button class="small" @click=${() => acceptArtifact$.next(artifact.id)}>Pin</button>
                                    <button class="small" @click=${() => toggleEdit$.next(artifact.id)}>Edit</button>
                                    <button class="small" @click=${() => rejectArtifact$.next(artifact.id)}>
                                      Reject
                                    </button>
                                  `}
                          </menu>
                        </div>
                      </div>
                    `,
                  )}
                </div>
              `
            : ""}

          <menu>
            <button
              @click=${() => {
                generateArtifacts$.next();
              }}
            >
              ${isGenerating ? "Generating..." : "Generate Artifacts"}
            </button>
            ${artifacts.length ? html`<button @click=${() => pinnedOnly$.next()}>Reject unpinned</button>` : ""}
          </menu>
          ${rejectedArtifacts.length > 0
            ? html`
                <div class="rejected-artifacts">
                  <details>
                    <summary>Rejected artifacts (${rejectedArtifacts.length})</summary>
                    <div class="rejected-list">
                      <div class="rejected-list-header">
                        <button class="small" @click=${() => clearAllRejected$.next()}>Clear all</button>
                      </div>
                      ${rejectedArtifacts.map(
                        (artifact) => html`
                          <div class="rejected-item">
                            <span>${artifact}</span>
                            <button class="small" @click=${() => revertRejection$.next(artifact)}>Restore</button>
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
    acceptEffect$,
    rejectEffect$,
    revertEffect$,
    clearAllRejectedEffect$,
    toggleEditEffect$,
    pinnedOnlyEffect$,
  );

  const staticTemplate = html`${observe(template$)}`;

  return {
    visualizeTemplate: staticTemplate,
    artifacts$,
    effects$,
  };
}
