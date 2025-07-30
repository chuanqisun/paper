import { html } from "lit-html";
import { BehaviorSubject, EMPTY, Observable, Subject, combineLatest, merge } from "rxjs";
import { catchError, finalize, map, switchMap, take, takeUntil, tap } from "rxjs/operators";
import {
  fileToDataUrl,
  generateArtifactFromImage$,
  regenerateArtifactDescription$,
  streamArtifacts$,
  type Artifact,
} from "../lib/generate-artifacts.js";
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
  const newArtifactDescription$ = new BehaviorSubject<string>("");
  const isGeneratingFromText$ = new BehaviorSubject<boolean>(false);
  const isGeneratingFromImage$ = new BehaviorSubject<boolean>(false);

  // Actions
  const generateArtifacts$ = new Subject<void>();
  const stopGeneration$ = new Subject<void>();
  const editArtifact$ = new Subject<{ id: string; field: "name" | "description"; value: string }>();
  const acceptArtifact$ = new Subject<string>();
  const rejectArtifact$ = new Subject<string>();
  const revertRejection$ = new Subject<string>();
  const clearAllRejected$ = new Subject<void>();
  const toggleEdit$ = new Subject<string>();
  const pinnedOnly$ = new Subject<void>();
  const addManualArtifact$ = new Subject<void>();
  const stopAddingArtifact$ = new Subject<void>();
  const pasteImage$ = new Subject<ClipboardEvent>();

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
            takeUntil(stopGeneration$),
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
            finalize(() => isGenerating$.next(false)),
          );
        }),
      ),
    ),
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

  // Add manual artifact effect (from text description)
  const addManualEffect$ = addManualArtifact$.pipe(
    tap(() => isGeneratingFromText$.next(true)),
    switchMap(() =>
      apiKeys$.pipe(
        take(1),
        map((apiKeys) => ({
          description: newArtifactDescription$.value.trim(),
          apiKey: apiKeys.openai,
          existingArtifacts: artifacts$.value.map((a) => ({ name: a.name, description: a.description })),
        })),
        switchMap(({ description, apiKey, existingArtifacts }) => {
          if (!description || !apiKey) {
            isGeneratingFromText$.next(false);
            return EMPTY;
          }

          return regenerateArtifactDescription$({ artifactName: description, apiKey, existingArtifacts }).pipe(
            takeUntil(stopAddingArtifact$),
            tap((generatedDescription) => {
              const newArtifact: ArtifactWithId = {
                id: Math.random().toString(36).substr(2, 9),
                name: description,
                description: generatedDescription,
                pinned: true,
              };
              artifacts$.next([...artifacts$.value, newArtifact]);
              newArtifactDescription$.next("");
              isGeneratingFromText$.next(false);
            }),
            catchError((error) => {
              console.error("Error generating artifact description:", error);
              isGeneratingFromText$.next(false);
              return EMPTY;
            }),
            finalize(() => isGeneratingFromText$.next(false)),
          );
        }),
      ),
    ),
  );

  // Paste image effect
  const pasteImageEffect$ = pasteImage$.pipe(
    tap(() => isGeneratingFromImage$.next(true)),
    switchMap((event) =>
      apiKeys$.pipe(
        take(1),
        switchMap((apiKeys) => {
          if (!apiKeys.openai) {
            isGeneratingFromImage$.next(false);
            return EMPTY;
          }

          const files = Array.from(event.clipboardData?.files || []);
          const imageFile = files.find((file) => file.type.startsWith("image/"));

          if (!imageFile) {
            isGeneratingFromImage$.next(false);
            return EMPTY;
          }

          const existingArtifacts = artifacts$.value.map((a) => ({ name: a.name, description: a.description }));

          return new Observable<Artifact>((subscriber) => {
            fileToDataUrl(imageFile)
              .then((dataUrl) => {
                const base64 = dataUrl.split(",")[1];
                generateArtifactFromImage$({
                  imageBase64: base64,
                  apiKey: apiKeys.openai!,
                  existingArtifacts,
                }).subscribe(subscriber);
              })
              .catch((error) => subscriber.error(error));
          }).pipe(
            takeUntil(stopAddingArtifact$),
            tap((artifact: Artifact) => {
              const newArtifact: ArtifactWithId = {
                id: Math.random().toString(36).substr(2, 9),
                name: artifact.name,
                description: artifact.description,
                pinned: true,
              };
              artifacts$.next([...artifacts$.value, newArtifact]);
            }),
            catchError((error) => {
              console.error("Error generating artifact from image:", error);
              return EMPTY;
            }),
            finalize(() => isGeneratingFromImage$.next(false)),
          );
        }),
      ),
    ),
  );

  // Template
  const template$ = combineLatest([
    artifacts$,
    rejectedArtifacts$,
    isGenerating$,
    editingArtifacts$,
    newArtifactDescription$,
    isGeneratingFromText$,
    isGeneratingFromImage$,
  ]).pipe(
    map(
      ([
        artifacts,
        rejectedArtifacts,
        isGenerating,
        editingArtifacts,
        newArtifactDescription,
        isGeneratingFromText,
        isGeneratingFromImage,
      ]) => html`
        <div class="moodboard">
          <p>Generate artifacts that represent your Parti and accepted concepts</p>

          ${artifacts.length > 0
            ? html`
                <div class="cards-grid">
                  ${artifacts.map(
                    (artifact) => html`
                      <div class="media-card ${artifact.pinned ? "pinned" : ""}">
                        <div class="card-edit-area ${editingArtifacts.includes(artifact.id) ? "" : "hidden"}">
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
                        <generative-image
                          class="card-image ${editingArtifacts.includes(artifact.id) ? "hidden" : ""}"
                          prompt="${artifact.description}"
                          width="400"
                          height="400"
                          title="${artifact.description}"
                        ></generative-image>
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
                                    <button class="small" @click=${() => toggleEdit$.next(artifact.id)}>Edit</button>
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
                if (isGenerating) {
                  stopGeneration$.next();
                } else {
                  generateArtifacts$.next();
                }
              }}
            >
              ${isGenerating ? "Stop generating" : "Generate Artifacts"}
            </button>
            ${artifacts.length ? html`<button @click=${() => pinnedOnly$.next()}>Reject unpinned</button>` : ""}
            <textarea
              rows="1"
              placeholder="New artifact or paste image..."
              .value=${newArtifactDescription}
              @input=${(e: Event) => newArtifactDescription$.next((e.target as HTMLTextAreaElement).value)}
              @paste=${(e: ClipboardEvent) => {
                // Check if there are files in clipboard
                const files = Array.from(e.clipboardData?.files || []);
                const hasImage = files.some((file) => file.type.startsWith("image/"));
                if (hasImage) {
                  e.preventDefault();
                  pasteImage$.next(e);
                }
              }}
              ?disabled=${isGeneratingFromText || isGeneratingFromImage}
            ></textarea>
            <button
              @click=${() => {
                if (isGeneratingFromText) {
                  stopAddingArtifact$.next();
                } else {
                  addManualArtifact$.next();
                }
              }}
              ?disabled=${(!newArtifactDescription.trim() && !isGeneratingFromText) || isGeneratingFromImage}
            >
              ${isGeneratingFromText ? "Stop adding" : isGeneratingFromImage ? "Processing image..." : "Add Artifact"}
            </button>
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
    addManualEffect$,
    pasteImageEffect$,
  );

  const staticTemplate = html`${observe(template$)}`;

  return {
    visualizeTemplate: staticTemplate,
    artifacts$,
    effects$,
  };
}
