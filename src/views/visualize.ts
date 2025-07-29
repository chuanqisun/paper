import { html } from "lit-html";
import { BehaviorSubject, Observable, Subject, combineLatest, merge } from "rxjs";
import { catchError, map, switchMap, take, tap } from "rxjs/operators";
import { streamArtifacts$, type Artifact } from "../lib/generate-artifacts.js";
import { observe } from "../lib/observe-directive.js";
import { type ApiKeys } from "../lib/storage.js";
import type { ConceptWithId } from "./conceptualize.js";
import "./visualize.css";

export interface ArtifactWithId extends Artifact {
  id: string;
  pinned: boolean;
}

export function visualizeView(apiKeys$: Observable<ApiKeys>, concepts$: Observable<ConceptWithId[]>) {
  // Internal state
  const artifacts$ = new BehaviorSubject<ArtifactWithId[]>([]);
  const rejectedArtifacts$ = new BehaviorSubject<string[]>([]);
  const isGenerating$ = new BehaviorSubject<boolean>(false);
  const editingArtifacts$ = new BehaviorSubject<string[]>([]);

  // Actions
  const generateArtifacts$ = new Subject<{ parti: string }>();
  const editArtifact$ = new Subject<{ id: string; field: "name" | "description"; value: string }>();
  const acceptArtifact$ = new Subject<string>();
  const rejectArtifact$ = new Subject<string>();
  const revertRejection$ = new Subject<string>();
  const toggleEdit$ = new Subject<string>();

  // Generate artifacts effect
  const generateEffect$ = generateArtifacts$.pipe(
    tap(() => {
      isGenerating$.next(true);

      // Move unaccepted artifacts to rejected list
      const currentArtifacts = artifacts$.value;
      const maybeArtifacts = currentArtifacts.filter((a) => !a.pinned);
      const pinnedArtifacts = currentArtifacts.filter((a) => a.pinned);

      if (maybeArtifacts.length > 0) {
        const newRejectedArtifacts = maybeArtifacts.map((a) => a.name);
        rejectedArtifacts$.next([...rejectedArtifacts$.value, ...newRejectedArtifacts]);
        artifacts$.next(pinnedArtifacts);
      }
    }),
    switchMap(({ parti }) =>
      // Take current values at the moment the user action is triggered, not reactive to future changes
      combineLatest([apiKeys$, concepts$]).pipe(
        take(1), // Only take the current values, don't react to future changes
        map(([apiKeys, concepts]) => ({
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

  // Template
  const template$ = combineLatest([artifacts$, rejectedArtifacts$, isGenerating$, editingArtifacts$]).pipe(
    map(
      ([artifacts, rejectedArtifacts, isGenerating, editingArtifacts]) => html`
        <div class="visualize">
          <p>Generate artifacts that represent your Parti and accepted concepts</p>
          <div class="visualize-actions">
            <button
              @click=${() => {
                const parti = (document.querySelector("#parti-content textarea") as HTMLTextAreaElement)?.value || "";
                if (parti) {
                  generateArtifacts$.next({ parti });
                }
              }}
            >
              Generate Artifacts
            </button>
          </div>

          ${isGenerating ? html`<div class="loading">Generating artifacts...</div>` : ""}
          ${artifacts.length > 0
            ? html`
                <div class="artifacts-grid">
                  ${artifacts.map(
                    (artifact) => html`
                      <div class="artifact-card ${artifact.pinned ? "accepted" : ""}">
                        ${editingArtifacts.includes(artifact.id)
                          ? html`
                              <div class="artifact-edit-area">
                                <textarea
                                  class="artifact-description-edit"
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
                              <img
                                class="artifact-image"
                                src="https://placehold.co/400"
                                alt="${artifact.name}"
                                title="${artifact.description}"
                              />
                            `}
                        <div class="artifact-content">
                          <textarea
                            class="artifact-name"
                            rows="1"
                            .value=${artifact.name}
                            @input=${(e: Event) =>
                              editArtifact$.next({
                                id: artifact.id,
                                field: "name",
                                value: (e.target as HTMLTextAreaElement).value,
                              })}
                          ></textarea>
                          <div class="artifact-actions">
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
                          </div>
                        </div>
                      </div>
                    `,
                  )}
                </div>
              `
            : ""}
          ${rejectedArtifacts.length > 0
            ? html`
                <div class="rejected-artifacts">
                  <details>
                    <summary>Rejected artifacts (${rejectedArtifacts.length})</summary>
                    <div class="rejected-list">
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
  const effects$ = merge(generateEffect$, editEffect$, acceptEffect$, rejectEffect$, revertEffect$, toggleEditEffect$);

  const staticTemplate = html`${observe(template$)}`;

  return {
    visualizeTemplate: staticTemplate,
    artifacts$,
    effects$,
  };
}
