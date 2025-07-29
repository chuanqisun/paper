import { html } from "lit-html";
import { BehaviorSubject, Observable, Subject, combineLatest, merge } from "rxjs";
import { catchError, map, switchMap, tap } from "rxjs/operators";
import { streamArtifacts$, type Artifact } from "../lib/generate-artifacts.js";
import { observe } from "../lib/observe-directive.js";
import { type ApiKeys } from "../lib/storage.js";
import "./materialize.css";

interface ArtifactWithId extends Artifact {
  id: string;
  accepted: boolean;
}

export function materializeView(apiKeys$: Observable<ApiKeys>, concepts$: Observable<any[]>) {
  // Internal state
  const artifacts$ = new BehaviorSubject<ArtifactWithId[]>([]);
  const rejectedArtifacts$ = new BehaviorSubject<string[]>([]);
  const isGenerating$ = new BehaviorSubject<boolean>(false);

  // Actions
  const generateArtifacts$ = new Subject<{ parti: string }>();
  const editArtifact$ = new Subject<{ id: string; field: "name" | "description"; value: string }>();
  const acceptArtifact$ = new Subject<string>();
  const rejectArtifact$ = new Subject<string>();
  const revertRejection$ = new Subject<string>();

  // Generate artifacts effect
  const generateEffect$ = generateArtifacts$.pipe(
    tap(() => {
      isGenerating$.next(true);

      // Move unaccepted artifacts to rejected list
      const currentArtifacts = artifacts$.value;
      const unacceptedArtifacts = currentArtifacts.filter((a) => !a.accepted);
      const acceptedArtifacts = currentArtifacts.filter((a) => a.accepted);

      if (unacceptedArtifacts.length > 0) {
        const newRejectedArtifacts = unacceptedArtifacts.map((a) => a.name);
        rejectedArtifacts$.next([...rejectedArtifacts$.value, ...newRejectedArtifacts]);
        artifacts$.next(acceptedArtifacts);
      }
    }),
    switchMap(({ parti }) =>
      combineLatest([apiKeys$, concepts$]).pipe(
        map(([apiKeys, concepts]) => ({
          parti,
          apiKey: apiKeys.openai,
          concepts: concepts.filter((c) => c.favorite).map((c) => ({ name: c.concept, description: c.description })),
        })),
        switchMap(({ parti, apiKey, concepts }) => {
          if (!apiKey) {
            console.error("OpenAI API key not available");
            return [];
          }

          if (concepts.length === 0) {
            console.error("No accepted concepts available");
            return [];
          }

          const existingArtifacts = artifacts$.value.map((a) => a.name);
          const rejectedArtifacts = rejectedArtifacts$.value;

          return streamArtifacts$({ parti, concepts, existingArtifacts, rejectedArtifacts, apiKey }).pipe(
            map((artifact) => ({
              ...artifact,
              id: Math.random().toString(36).substr(2, 9),
              accepted: false,
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
      const artifacts = artifacts$.value.map((a) => (a.id === id ? { ...a, accepted: !a.accepted } : a));
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

  // Template
  const template$ = combineLatest([artifacts$, rejectedArtifacts$, isGenerating$, concepts$]).pipe(
    map(
      ([artifacts, rejectedArtifacts, isGenerating, concepts]) => html`
        <div class="materialize">
          <p>Generate artifacts that represent your Parti and accepted concepts</p>
          <div class="materialize-actions">
            <button
              @click=${() => {
                const parti = (document.querySelector("#parti-content textarea") as HTMLTextAreaElement)?.value || "";
                if (parti) {
                  generateArtifacts$.next({ parti });
                }
              }}
              ?disabled=${concepts.filter((c) => c.favorite).length === 0}
            >
              Generate Artifacts
            </button>
          </div>

          ${concepts.filter((c) => c.favorite).length === 0
            ? html`<div class="materialize-placeholder">
                Please accept some concepts first before generating artifacts.
              </div>`
            : ""}
          ${isGenerating ? html`<div class="loading">Generating artifacts...</div>` : ""}
          ${artifacts.length > 0
            ? html`
                <div class="artifacts-grid">
                  ${artifacts.map(
                    (artifact) => html`
                      <div class="artifact-card ${artifact.accepted ? "accepted" : ""}">
                        <div class="artifact-placeholder">Image placeholder</div>
                        <div class="artifact-content">
                          <div class="artifact-header">
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
                              <button @click=${() => acceptArtifact$.next(artifact.id)}>
                                ${artifact.accepted ? "✅" : "Accept"}
                              </button>
                              ${artifact.accepted
                                ? null
                                : html`<button @click=${() => rejectArtifact$.next(artifact.id)}>✕</button>`}
                            </div>
                          </div>
                          <textarea
                            class="artifact-description"
                            .value=${artifact.description}
                            @input=${(e: Event) =>
                              editArtifact$.next({
                                id: artifact.id,
                                field: "description",
                                value: (e.target as HTMLTextAreaElement).value,
                              })}
                          ></textarea>
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
                            <button @click=${() => revertRejection$.next(artifact)}>Restore</button>
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
  const effects$ = merge(generateEffect$, editEffect$, acceptEffect$, rejectEffect$, revertEffect$);

  const staticTemplate = html`${observe(template$)}`;

  return {
    materializeTemplate: staticTemplate,
    artifacts$,
    effects$,
  };
}
