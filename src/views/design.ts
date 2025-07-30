import { html } from "lit-html";
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  map,
  merge,
  Observable,
  of,
  Subject,
  switchMap,
  take,
  tap,
} from "rxjs";
import type { Design } from "../lib/generate-designs.ts";
import { streamDesigns$, streamMockups$, type Mockup } from "../lib/generate-designs.ts";
import { observe } from "../lib/observe-directive.ts";
import { type ApiKeys } from "../lib/storage.js";
import type { ConceptWithId } from "./conceptualize.js";
import "./design.css";
import type { ParameterWithId } from "./parameterize.js";
import type { ArtifactWithId } from "./visualize.js";

export interface DesignWithId extends Design {
  id: string;
  pinned: boolean;
}

export interface MockupWithId extends Mockup {
  id: string;
  pinned: boolean;
  designId: string; // Associate mockup with its parent design
}

export function fitView(
  apiKeys$: Observable<ApiKeys>,
  concepts$: Observable<ConceptWithId[]>,
  artifacts$: Observable<ArtifactWithId[]>,
  parameters$: Observable<ParameterWithId[]>,
  parti$: Observable<string>,
  domain$: Observable<string>,
) {
  // Internal state
  const designs$ = new BehaviorSubject<DesignWithId[]>([]);
  const rejectedDesigns$ = new BehaviorSubject<string[]>([]);
  const isGenerating$ = new BehaviorSubject<boolean>(false);
  const mockups$ = new BehaviorSubject<MockupWithId[]>([]);
  const rejectedMockups$ = new BehaviorSubject<string[]>([]);
  const renderingDesigns$ = new BehaviorSubject<Set<string>>(new Set());
  const editingMockups$ = new BehaviorSubject<string[]>([]);

  // Actions
  const generateDesigns$ = new Subject<void>();
  const editDesign$ = new Subject<{ id: string; field: "name" | "parameter"; parameterName?: string; value: string }>();
  const pinDesign$ = new Subject<string>();
  const rejectDesign$ = new Subject<string>();
  const revertRejection$ = new Subject<string>();
  const clearAllRejected$ = new Subject<void>();
  const pinnedOnly$ = new Subject<void>();
  const renderMockups$ = new Subject<string>();
  const editMockup$ = new Subject<{ id: string; field: "name" | "description"; value: string }>();
  const pinMockup$ = new Subject<string>();
  const rejectMockup$ = new Subject<string>();
  const revertMockupRejection$ = new Subject<string>();
  const clearAllRejectedMockups$ = new Subject<void>();
  const toggleEditMockup$ = new Subject<string>();
  const pinnedOnlyMockups$ = new Subject<void>();

  // Generate designs effect
  const generateEffect$ = generateDesigns$.pipe(
    tap(() => isGenerating$.next(true)),
    switchMap(() =>
      // Take current values at the moment the user action is triggered, not reactive to future changes
      combineLatest([apiKeys$, concepts$, artifacts$, parameters$, parti$, domain$]).pipe(
        take(1), // Only take the current values, don't react to future changes
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
          );
        }),
      ),
    ),
    tap(() => isGenerating$.next(false)),
  );

  // Edit design effect
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

  // Pin design effect
  const pinEffect$ = pinDesign$.pipe(
    tap((id) => {
      const designs = designs$.value.map((d) => (d.id === id ? { ...d, pinned: !d.pinned } : d));
      designs$.next(designs);
    }),
  );

  // Reject design effect
  const rejectEffect$ = rejectDesign$.pipe(
    tap((id) => {
      const design = designs$.value.find((d) => d.id === id);
      if (design) {
        rejectedDesigns$.next([...rejectedDesigns$.value, design.name]);
        designs$.next(designs$.value.filter((d) => d.id !== id));
      }
    }),
  );

  // Revert rejection effect
  const revertEffect$ = revertRejection$.pipe(
    tap((rejectedDesign) => {
      rejectedDesigns$.next(rejectedDesigns$.value.filter((d) => d !== rejectedDesign));
    }),
  );

  // Clear all rejected effect
  const clearAllRejectedEffect$ = clearAllRejected$.pipe(
    tap(() => {
      rejectedDesigns$.next([]);
    }),
  );

  // Pinned only effect
  const pinnedOnlyEffect$ = pinnedOnly$.pipe(
    tap(() => {
      const currentDesigns = designs$.value;
      const unpinnedDesigns = currentDesigns.filter((d) => !d.pinned);
      const pinnedDesigns = currentDesigns.filter((d) => d.pinned);

      // Add unpinned designs to rejection list
      const newRejectedDesigns = [...rejectedDesigns$.value, ...unpinnedDesigns.map((d) => d.name)];
      rejectedDesigns$.next(newRejectedDesigns);

      // Keep only pinned designs
      designs$.next(pinnedDesigns);
    }),
  );

  // Render mockups effect
  const renderMockupsEffect$ = renderMockups$.pipe(
    tap((designId) => {
      const currentRendering = renderingDesigns$.value;
      renderingDesigns$.next(new Set([...currentRendering, designId]));
    }),
    switchMap((designId) =>
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
          const rejectedMockups = rejectedMockups$.value;

          return streamMockups$({
            designs: [design],
            domain,
            existingMockups,
            rejectedMockups,
            apiKey,
          }).pipe(
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
          );
        }),
        tap(() => {
          const currentRendering = renderingDesigns$.value;
          currentRendering.delete(designId);
          renderingDesigns$.next(new Set(currentRendering));
        }),
      ),
    ),
  );

  // Edit mockup effect
  const editMockupEffect$ = editMockup$.pipe(
    tap(({ id, field, value }) => {
      const mockups = mockups$.value.map((m) => (m.id === id ? { ...m, [field]: value } : m));
      mockups$.next(mockups);
    }),
  );

  // Pin mockup effect
  const pinMockupEffect$ = pinMockup$.pipe(
    tap((id) => {
      const mockups = mockups$.value.map((m) => (m.id === id ? { ...m, pinned: !m.pinned } : m));
      mockups$.next(mockups);
    }),
  );

  // Reject mockup effect
  const rejectMockupEffect$ = rejectMockup$.pipe(
    tap((id) => {
      const mockup = mockups$.value.find((m) => m.id === id);
      if (mockup) {
        const mockups = mockups$.value.filter((m) => m.id !== id);
        mockups$.next(mockups);
        rejectedMockups$.next([...rejectedMockups$.value, mockup.name]);
      }
    }),
  );

  // Revert mockup rejection effect
  const revertMockupRejectionEffect$ = revertMockupRejection$.pipe(
    tap((rejectedMockup) => {
      const rejected = rejectedMockups$.value.filter((m) => m !== rejectedMockup);
      rejectedMockups$.next(rejected);
    }),
  );

  // Clear all rejected mockups effect
  const clearAllRejectedMockupsEffect$ = clearAllRejectedMockups$.pipe(
    tap(() => {
      rejectedMockups$.next([]);
    }),
  );

  // Toggle edit mockup effect
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

  // Pinned only mockups effect
  const pinnedOnlyMockupsEffect$ = pinnedOnlyMockups$.pipe(
    tap(() => {
      const currentMockups = mockups$.value;
      const unpinnedMockups = currentMockups.filter((m) => !m.pinned);
      const pinnedMockups = currentMockups.filter((m) => m.pinned);

      // Add unpinned mockups to rejection list
      const newRejectedMockups = [...rejectedMockups$.value, ...unpinnedMockups.map((m) => m.name)];
      rejectedMockups$.next(newRejectedMockups);

      // Keep only pinned mockups
      mockups$.next(pinnedMockups);
    }),
  );

  // Template
  const template$ = combineLatest([
    designs$,
    rejectedDesigns$,
    isGenerating$,
    mockups$,
    rejectedMockups$,
    renderingDesigns$,
    editingMockups$,
  ]).pipe(
    map(
      ([designs, rejectedDesigns, isGenerating, mockups, rejectedMockups, renderingDesigns, editingMockups]) => html`
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
                          <button class="small" @click=${() => renderMockups$.next(design.id)}>
                            ${renderingDesigns.has(design.id) ? "Rendering..." : "Render"}
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
                          return designMockups.length > 0
                            ? html`
                                <div class="design-mockups">
                                  ${designMockups.length > 0
                                    ? html`
                                        <div class="mockups-grid">
                                          ${designMockups.map(
                                            (mockup) => html`
                                              <div class="mockup-card ${mockup.pinned ? "pinned" : ""}">
                                                ${editingMockups.includes(mockup.id)
                                                  ? html`
                                                      <div class="mockup-edit-area">
                                                        <textarea
                                                          class="mockup-description-edit"
                                                          .value=${mockup.description}
                                                          @input=${(e: Event) =>
                                                            editMockup$.next({
                                                              id: mockup.id,
                                                              field: "description",
                                                              value: (e.target as HTMLTextAreaElement).value,
                                                            })}
                                                        ></textarea>
                                                      </div>
                                                    `
                                                  : html`
                                                      <img
                                                        class="mockup-image"
                                                        src="https://placehold.co/400"
                                                        alt="${mockup.name}"
                                                        title="${mockup.description}"
                                                      />
                                                    `}
                                                <div class="mockup-content">
                                                  <textarea
                                                    class="mockup-name"
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
                                                        `
                                                      : mockup.pinned
                                                        ? html`
                                                            <button
                                                              class="small"
                                                              @click=${() => pinMockup$.next(mockup.id)}
                                                            >
                                                              ✅ Pinned
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
                generateDesigns$.next();
              }}
            >
              ${isGenerating ? "Generating..." : "Generate Designs"}
            </button>
            ${designs.length ? html`<button @click=${() => pinnedOnly$.next()}>Reject unpinned</button>` : ""}
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
          ${rejectedMockups.length > 0
            ? html`
                <div class="rejected-mockups">
                  <details>
                    <summary>Rejected mockups (${rejectedMockups.length})</summary>
                    <div class="rejected-list">
                      <div class="rejected-list-header">
                        <button class="small" @click=${() => clearAllRejectedMockups$.next()}>Clear all</button>
                      </div>
                      ${rejectedMockups.map(
                        (mockup) => html`
                          <div class="rejected-item">
                            <span>${mockup}</span>
                            <button class="small" @click=${() => revertMockupRejection$.next(mockup)}>Restore</button>
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
    pinnedOnlyEffect$,
    renderMockupsEffect$,
    editMockupEffect$,
    pinMockupEffect$,
    rejectMockupEffect$,
    revertMockupRejectionEffect$,
    clearAllRejectedMockupsEffect$,
    toggleEditMockupEffect$,
    pinnedOnlyMockupsEffect$,
  );

  const staticTemplate = html`${observe(template$)}`;

  return {
    fitTemplate: staticTemplate,
    designs$,
    mockups$,
    effects$,
  };
}
