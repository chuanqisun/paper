import { html } from "lit-html";
import { repeat } from "lit-html/directives/repeat.js";
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
  mergeMap,
  mergeWith,
  of,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { ConceptWithId } from "../conceptualize/conceptualize.component";
import type { ApiKeys } from "../connections/storage";
import "../generative-image/generative-image";
import type { ArtifactWithId } from "../moodboard/moodboard.component";
import type { ParameterWithId } from "../parameterize/parameterize.component";
import "./design.component.css";
import type { Design } from "./generate-designs";
import { generateManualDesign$, streamDesigns$, streamMockups$, type Mockup } from "./generate-designs";

export interface DesignWithId extends Design {
  id: string;
  pinned: boolean;
}

export interface MockupWithId extends Mockup {
  id: string;
  pinned: boolean;
  designId: string;
}

export interface DesignComponentProps {
  apiKeys$: Observable<ApiKeys>;
  concepts$: Observable<ConceptWithId[]>;
  artifacts$: Observable<ArtifactWithId[]>;
  parameters$: Observable<ParameterWithId[]>;
  partiText$: Observable<string>;
  domain$: Observable<string>;
  designs$: BehaviorSubject<DesignWithId[]>;
  mockups$: BehaviorSubject<MockupWithId[]>;
}

export const DesignComponent = createComponent((props: DesignComponentProps) => {
  // 1. Internal state
  const { apiKeys$, concepts$, artifacts$, parameters$, partiText$, domain$, designs$, mockups$ } = props;
  const rejectedDesigns$ = new BehaviorSubject<string[]>([]);
  const isGenerating$ = new BehaviorSubject<boolean>(false);
  const rejectedMockups$ = new BehaviorSubject<MockupWithId[]>([]);
  const renderingDesigns$ = new BehaviorSubject<Set<string>>(new Set());
  const editingMockups$ = new BehaviorSubject<string[]>([]);
  const newDesignIdea$ = new BehaviorSubject<string>("");
  const isGeneratingManualDesign$ = new BehaviorSubject<boolean>(false);

  // 2. Actions (user interactions)
  const generateDesigns$ = new Subject<void>();
  const stopDesignGeneration$ = new Subject<void>();
  const editDesign$ = new Subject<{ id: string; field: "name" | "parameter"; parameterName?: string; value: string }>();
  const pinDesign$ = new Subject<string>();
  const rejectDesign$ = new Subject<string>();
  const revertRejection$ = new Subject<string>();
  const clearAllRejected$ = new Subject<void>();
  const pinnedOnly$ = new Subject<void>();
  const addManualDesign$ = new Subject<void>();
  const stopAddingDesign$ = new Subject<void>();
  const renderMockups$ = new Subject<string>();
  const stopRender$ = new Subject<string>();
  const editMockup$ = new Subject<{ id: string; field: "name" | "description"; value: string }>();
  const pinMockup$ = new Subject<string>();
  const rejectMockup$ = new Subject<string>();
  const revertMockupRejection$ = new Subject<string>();
  const clearAllRejectedMockups$ = new Subject<void>();
  const toggleEditMockup$ = new Subject<string>();
  const pinnedOnlyMockups$ = new Subject<void>();
  const retryMockup$ = new Subject<string>();

  // 3. Effects (state changes)
  const generateEffect$ = generateDesigns$.pipe(
    tap(() => isGenerating$.next(true)),
    switchMap(() =>
      combineLatest([apiKeys$, concepts$, artifacts$, parameters$, partiText$, domain$]).pipe(
        take(1),
        tap((e) => console.log("Generating designs with:", e)),
        map(([apiKeys, concepts, artifacts, parameters, parti, domain]) => ({
          parti,
          domain,
          apiKey: apiKeys.openai,
          concepts: concepts.map((c) => ({ name: c.concept, description: c.description })),
          artifacts: artifacts.map((a) => ({ name: a.name, description: a.description })),
          parameters: parameters.map((p) => ({ name: p.name, description: p.description })),
        })),
        switchMap(({ parti, domain, apiKey, concepts, artifacts, parameters }) => {
          if (!apiKey) {
            console.error("OpenAI API key not found");
            return of();
          }

          if (!parti) {
            console.error("Parti not found");
            return of();
          }

          if (concepts.length === 0) {
            console.error("No concepts found");
            return of();
          }

          if (parameters.length === 0) {
            console.error("No parameters found");
            return of();
          }

          const existingDesigns = designs$.value.map((d) => d.name);
          const rejectedDesigns = rejectedDesigns$.value;

          return streamDesigns$({
            parti,
            domain,
            concepts,
            artifacts,
            parameters,
            existingDesigns,
            rejectedDesigns,
            apiKey,
          }).pipe(
            takeUntil(stopDesignGeneration$),
            map(
              (design) =>
                ({
                  ...design,
                  id: Math.random().toString(36).substr(2, 9),
                  pinned: false,
                }) as DesignWithId,
            ),
            tap((design) => {
              const currentDesigns = designs$.value;
              designs$.next([...currentDesigns, design]);
            }),
            catchError((error) => {
              console.error("Error generating designs:", error);
              return of();
            }),
            finalize(() => isGenerating$.next(false)),
          );
        }),
      ),
    ),
  );

  const editEffect$ = editDesign$.pipe(
    tap(({ id, field, parameterName, value }) => {
      const designs = designs$.value.map((d) => {
        if (d.id === id) {
          if (field === "name") {
            return { ...d, name: value };
          } else if (field === "parameter" && parameterName) {
            return {
              ...d,
              parameterAssignments: {
                ...d.parameterAssignments,
                [parameterName]: value,
              },
            };
          }
        }
        return d;
      });
      designs$.next(designs);
    }),
  );

  const pinEffect$ = pinDesign$.pipe(
    tap((id) => {
      const designs = designs$.value.map((d) => (d.id === id ? { ...d, pinned: !d.pinned } : d));
      designs$.next(designs);
    }),
  );

  const rejectEffect$ = rejectDesign$.pipe(
    tap((id) => {
      const design = designs$.value.find((d) => d.id === id);
      if (design) {
        rejectedDesigns$.next([...rejectedDesigns$.value, design.name]);
        designs$.next(designs$.value.filter((d) => d.id !== id));
      }
    }),
  );

  const revertEffect$ = revertRejection$.pipe(
    tap((rejectedDesign) => {
      rejectedDesigns$.next(rejectedDesigns$.value.filter((d) => d !== rejectedDesign));
    }),
  );

  const clearAllRejectedEffect$ = clearAllRejected$.pipe(
    tap(() => {
      rejectedDesigns$.next([]);
    }),
  );

  const pinnedOnlyEffect$ = pinnedOnly$.pipe(
    tap(() => {
      const currentDesigns = designs$.value;
      const unpinnedDesigns = currentDesigns.filter((d) => !d.pinned);
      const pinnedDesigns = currentDesigns.filter((d) => d.pinned);

      const newRejectedDesigns = [...rejectedDesigns$.value, ...unpinnedDesigns.map((d) => d.name)];
      rejectedDesigns$.next(newRejectedDesigns);

      designs$.next(pinnedDesigns);
    }),
  );

  const addManualDesignEffect$ = addManualDesign$.pipe(
    tap(() => isGeneratingManualDesign$.next(true)),
    switchMap(() =>
      combineLatest([apiKeys$, concepts$, artifacts$, parameters$, partiText$, domain$]).pipe(
        take(1),
        map(([apiKeys, concepts, artifacts, parameters, parti, domain]) => ({
          designIdea: newDesignIdea$.value.trim(),
          parti,
          domain,
          apiKey: apiKeys.openai,
          concepts: concepts.map((c) => ({ name: c.concept, description: c.description })),
          artifacts: artifacts.map((a) => ({ name: a.name, description: a.description })),
          parameters: parameters.map((p) => ({ name: p.name, description: p.description })),
          existingDesigns: designs$.value,
        })),
        switchMap(({ designIdea, parti, domain, apiKey, concepts, artifacts, parameters, existingDesigns }) => {
          if (!designIdea || !parti || !domain || !apiKey) {
            isGeneratingManualDesign$.next(false);
            return EMPTY;
          }

          if (concepts.length === 0) {
            console.error("No concepts available");
            isGeneratingManualDesign$.next(false);
            return EMPTY;
          }

          if (parameters.length === 0) {
            console.error("No parameters available");
            isGeneratingManualDesign$.next(false);
            return EMPTY;
          }

          return generateManualDesign$({
            designIdea,
            parti,
            domain,
            concepts,
            artifacts,
            parameters,
            apiKey,
            existingDesigns,
          }).pipe(
            takeUntil(stopAddingDesign$),
            tap((design) => {
              const newDesign: DesignWithId = {
                ...design,
                id: Math.random().toString(36).substr(2, 9),
                pinned: true,
              };
              designs$.next([...designs$.value, newDesign]);
              newDesignIdea$.next("");
              isGeneratingManualDesign$.next(false);
            }),
            catchError((error) => {
              console.error("Error generating manual design:", error);
              isGeneratingManualDesign$.next(false);
              return EMPTY;
            }),
            finalize(() => isGeneratingManualDesign$.next(false)),
          );
        }),
      ),
    ),
  );

  const renderMockupsEffect$ = renderMockups$.pipe(
    tap((designId) => {
      const currentRendering = renderingDesigns$.value;
      renderingDesigns$.next(new Set([...currentRendering, designId]));
    }),
    mergeMap((designId) =>
      combineLatest([apiKeys$, domain$]).pipe(
        take(1),
        map(([apiKeys, domain]) => ({
          apiKey: apiKeys.openai,
          domain,
          design: designs$.value.find((d) => d.id === designId),
          designId,
        })),
        switchMap(({ apiKey, domain, design, designId }) => {
          if (!apiKey) {
            console.error("OpenAI API key not available");
            const currentRendering = renderingDesigns$.value;
            currentRendering.delete(designId);
            renderingDesigns$.next(new Set(currentRendering));
            return of();
          }

          if (!design) {
            console.error("Design not found");
            const currentRendering = renderingDesigns$.value;
            currentRendering.delete(designId);
            renderingDesigns$.next(new Set(currentRendering));
            return of();
          }

          if (!domain) {
            console.error("Domain not found");
            const currentRendering = renderingDesigns$.value;
            currentRendering.delete(designId);
            renderingDesigns$.next(new Set(currentRendering));
            return of();
          }

          const existingMockups = mockups$.value.map((m) => m.name);
          const rejectedMockups = rejectedMockups$.value.map((m) => m.name);

          return streamMockups$({
            designs: [design],
            domain,
            existingMockups,
            rejectedMockups,
            apiKey,
          }).pipe(
            takeUntil(stopRender$.pipe(map((stopDesignId) => stopDesignId === designId))),
            map(
              (mockup) =>
                ({
                  ...mockup,
                  id: Math.random().toString(36).substr(2, 9),
                  pinned: false,
                  designId,
                }) as MockupWithId,
            ),
            tap((mockup) => {
              const currentMockups = mockups$.value;
              mockups$.next([...currentMockups, mockup]);
            }),
            catchError((error) => {
              console.error("Error generating mockups:", error);
              return of();
            }),
            finalize(() => {
              const currentRenderingDesigns = renderingDesigns$.value;
              currentRenderingDesigns.delete(designId);
              renderingDesigns$.next(new Set(currentRenderingDesigns));
            }),
          );
        }),
      ),
    ),
  );

  const editMockupEffect$ = editMockup$.pipe(
    tap(({ id, field, value }) => {
      const mockups = mockups$.value.map((m) => (m.id === id ? { ...m, [field]: value } : m));
      mockups$.next(mockups);
    }),
  );

  const pinMockupEffect$ = pinMockup$.pipe(
    tap((id) => {
      const mockups = mockups$.value.map((m) => (m.id === id ? { ...m, pinned: !m.pinned } : m));
      mockups$.next(mockups);
    }),
  );

  const rejectMockupEffect$ = rejectMockup$.pipe(
    tap((id) => {
      const mockup = mockups$.value.find((m) => m.id === id);
      if (mockup) {
        const mockups = mockups$.value.filter((m) => m.id !== id);
        mockups$.next(mockups);
        rejectedMockups$.next([...rejectedMockups$.value, mockup]);
      }
    }),
  );

  const revertMockupRejectionEffect$ = revertMockupRejection$.pipe(
    tap((rejectedMockupId) => {
      const rejectedMockup = rejectedMockups$.value.find((m) => m.id === rejectedMockupId);
      if (rejectedMockup) {
        const rejected = rejectedMockups$.value.filter((m) => m.id !== rejectedMockupId);
        rejectedMockups$.next(rejected);
        mockups$.next([...mockups$.value, rejectedMockup]);
      }
    }),
  );

  const clearAllRejectedMockupsEffect$ = clearAllRejectedMockups$.pipe(
    tap(() => {
      rejectedMockups$.next([]);
    }),
  );

  const toggleEditMockupEffect$ = toggleEditMockup$.pipe(
    tap((id) => {
      const editing = editingMockups$.value;
      if (editing.includes(id)) {
        editingMockups$.next(editing.filter((e) => e !== id));
      } else {
        editingMockups$.next([...editing, id]);
      }
    }),
  );

  const pinnedOnlyMockupsEffect$ = pinnedOnlyMockups$.pipe(
    tap(() => {
      const currentMockups = mockups$.value;
      const unpinnedMockups = currentMockups.filter((m) => !m.pinned);
      const pinnedMockups = currentMockups.filter((m) => m.pinned);

      const newRejectedMockups = [...rejectedMockups$.value, ...unpinnedMockups];
      rejectedMockups$.next(newRejectedMockups);

      mockups$.next(pinnedMockups);
    }),
  );

  const retryMockupEffect$ = retryMockup$.pipe(
    tap((id) => {
      const editing = editingMockups$.value.filter((e) => e !== id);
      editingMockups$.next(editing);

      setTimeout(() => {
        const imageElement = document.querySelector(`[data-mockup-id="${id}"] generative-image`) as any;
        if (imageElement && typeof imageElement.retry === "function") {
          imageElement.retry();
        }
      }, 0);
    }),
  );

  const effects$ = merge(
    generateEffect$,
    editEffect$,
    pinEffect$,
    rejectEffect$,
    revertEffect$,
    clearAllRejectedEffect$,
    pinnedOnlyEffect$,
    addManualDesignEffect$,
    renderMockupsEffect$,
    editMockupEffect$,
    pinMockupEffect$,
    rejectMockupEffect$,
    revertMockupRejectionEffect$,
    clearAllRejectedMockupsEffect$,
    toggleEditMockupEffect$,
    pinnedOnlyMockupsEffect$,
    retryMockupEffect$,
  ).pipe(ignoreElements());

  // 4. Combine state and template
  const template$ = combineLatest([
    designs$,
    rejectedDesigns$,
    isGenerating$,
    mockups$,
    rejectedMockups$,
    renderingDesigns$,
    editingMockups$,
    newDesignIdea$,
    isGeneratingManualDesign$,
  ]).pipe(
    map(
      ([
        designs,
        rejectedDesigns,
        isGenerating,
        mockups,
        rejectedMockups,
        renderingDesigns,
        editingMockups,
        newDesignIdea,
        isGeneratingManualDesign,
      ]) => html`
        <div class="design">
          <p>Generate design concepts by assigning concrete values to parameters</p>

          ${designs.length > 0
            ? html`
                <div class="designs-grid">
                  ${designs.map(
                    (design) => html`
                      <div class="design-card ${design.pinned ? "pinned" : ""}">
                        <textarea
                          class="design-name"
                          rows="1"
                          .value=${design.name}
                          @input=${(e: Event) =>
                            editDesign$.next({
                              id: design.id,
                              field: "name",
                              value: (e.target as HTMLTextAreaElement).value,
                            })}
                        ></textarea>
                        <div class="design-parameters">
                          ${Object.entries(design.parameterAssignments).map(
                            ([paramName, paramValue]) => html`
                              <div class="parameter-row">
                                <div class="parameter-name">${paramName}</div>
                                <textarea
                                  class="parameter-value"
                                  rows="1"
                                  .value=${paramValue}
                                  @input=${(e: Event) =>
                                    editDesign$.next({
                                      id: design.id,
                                      field: "parameter",
                                      parameterName: paramName,
                                      value: (e.target as HTMLTextAreaElement).value,
                                    })}
                                ></textarea>
                              </div>
                            `,
                          )}
                        </div>
                        <menu>
                          <button
                            class="small"
                            @click=${() => {
                              if (renderingDesigns.has(design.id)) {
                                stopRender$.next(design.id);
                              } else {
                                renderMockups$.next(design.id);
                              }
                            }}
                          >
                            ${renderingDesigns.has(design.id) ? "Stop rendering" : "Render"}
                          </button>
                          ${design.pinned
                            ? html`
                                <button class="small" @click=${() => pinDesign$.next(design.id)}>✅ Pinned</button>
                              `
                            : html`
                                <button class="small" @click=${() => pinDesign$.next(design.id)}>Pin</button>
                                <button class="small" @click=${() => rejectDesign$.next(design.id)}>Reject</button>
                              `}
                        </menu>
                        ${(() => {
                          const designMockups = mockups.filter((m) => m.designId === design.id);
                          const designRejectedMockups = rejectedMockups.filter((m) => m.designId === design.id);
                          return designMockups.length > 0 || designRejectedMockups.length > 0
                            ? html`
                                <div class="design-mockups">
                                  ${designMockups.length > 0
                                    ? html`
                                        <div class="cards-grid">
                                          ${repeat(
                                            designMockups,
                                            (mockup) => mockup.id,
                                            (mockup) => html`
                                              <div
                                                class="media-card ${mockup.pinned ? "pinned" : ""}"
                                                data-mockup-id="${mockup.id}"
                                              >
                                                <div
                                                  class="card-edit-area ${editingMockups.includes(mockup.id)
                                                    ? ""
                                                    : "hidden"}"
                                                >
                                                  <textarea
                                                    class="card-edit-textarea"
                                                    .value=${mockup.description}
                                                    @change=${(e: Event) =>
                                                      editMockup$.next({
                                                        id: mockup.id,
                                                        field: "description",
                                                        value: (e.target as HTMLTextAreaElement).value,
                                                      })}
                                                  ></textarea>
                                                </div>
                                                <generative-image
                                                  class="card-image ${editingMockups.includes(mockup.id)
                                                    ? "hidden"
                                                    : ""}"
                                                  prompt="${mockup.description}"
                                                  width="400"
                                                  height="400"
                                                  title="${mockup.description}"
                                                ></generative-image>
                                                <div class="card-content">
                                                  <textarea
                                                    class="card-name"
                                                    rows="1"
                                                    .value=${mockup.name}
                                                    @input=${(e: Event) =>
                                                      editMockup$.next({
                                                        id: mockup.id,
                                                        field: "name",
                                                        value: (e.target as HTMLTextAreaElement).value,
                                                      })}
                                                  ></textarea>
                                                  <menu>
                                                    ${editingMockups.includes(mockup.id)
                                                      ? html`
                                                          <button
                                                            class="small"
                                                            @click=${() => toggleEditMockup$.next(mockup.id)}
                                                          >
                                                            Done
                                                          </button>
                                                          <button
                                                            class="small"
                                                            @click=${() => retryMockup$.next(mockup.id)}
                                                          >
                                                            Retry
                                                          </button>
                                                        `
                                                      : mockup.pinned
                                                        ? html`
                                                            <button
                                                              class="small"
                                                              @click=${() => pinMockup$.next(mockup.id)}
                                                            >
                                                              ✅ Pinned
                                                            </button>
                                                            <button
                                                              class="small"
                                                              @click=${() => toggleEditMockup$.next(mockup.id)}
                                                            >
                                                              Edit
                                                            </button>
                                                          `
                                                        : html`
                                                            <button
                                                              class="small"
                                                              @click=${() => pinMockup$.next(mockup.id)}
                                                            >
                                                              Pin
                                                            </button>
                                                            <button
                                                              class="small"
                                                              @click=${() => toggleEditMockup$.next(mockup.id)}
                                                            >
                                                              Edit
                                                            </button>
                                                            <button
                                                              class="small"
                                                              @click=${() => rejectMockup$.next(mockup.id)}
                                                            >
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
                                  ${designRejectedMockups.length > 0
                                    ? html`
                                        <div class="rejected-mockups">
                                          <details>
                                            <summary>Rejected mockups (${designRejectedMockups.length})</summary>
                                            <div class="rejected-list">
                                              <div class="rejected-list-header">
                                                <button class="small" @click=${() => clearAllRejectedMockups$.next()}>
                                                  Clear all
                                                </button>
                                              </div>
                                              ${designRejectedMockups.map(
                                                (mockup) => html`
                                                  <div class="rejected-item">
                                                    <span>${mockup.name}</span>
                                                    <button
                                                      class="small"
                                                      @click=${() => revertMockupRejection$.next(mockup.id)}
                                                    >
                                                      Restore
                                                    </button>
                                                  </div>
                                                `,
                                              )}
                                            </div>
                                          </details>
                                        </div>
                                      `
                                    : ""}
                                </div>
                              `
                            : "";
                        })()}
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
                  stopDesignGeneration$.next();
                } else {
                  generateDesigns$.next();
                }
              }}
            >
              ${isGenerating ? "Stop generating" : "Generate Designs"}
            </button>
            ${designs.length ? html`<button @click=${() => pinnedOnly$.next()}>Reject unpinned</button>` : ""}
            <textarea
              rows="1"
              placeholder="New design idea..."
              .value=${newDesignIdea}
              @input=${(e: Event) => newDesignIdea$.next((e.target as HTMLTextAreaElement).value)}
              ?disabled=${isGeneratingManualDesign}
            ></textarea>
            <button
              @click=${() => {
                if (isGeneratingManualDesign) {
                  stopAddingDesign$.next();
                } else {
                  addManualDesign$.next();
                }
              }}
              ?disabled=${!newDesignIdea.trim() && !isGeneratingManualDesign}
            >
              ${isGeneratingManualDesign ? "Stop adding" : "Add Design"}
            </button>
          </menu>
          ${rejectedDesigns.length > 0
            ? html`
                <div class="rejected-designs">
                  <details>
                    <summary>Rejected designs (${rejectedDesigns.length})</summary>
                    <div class="rejected-list">
                      <div class="rejected-list-header">
                        <button class="small" @click=${() => clearAllRejected$.next()}>Clear all</button>
                      </div>
                      ${rejectedDesigns.map(
                        (design) => html`
                          <div class="rejected-item">
                            <span>${design}</span>
                            <button class="small" @click=${() => revertRejection$.next(design)}>Restore</button>
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
