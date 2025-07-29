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
import type { Design } from "../lib/generate-fits.ts";
import { streamDesigns$ } from "../lib/generate-fits.ts";
import { observe } from "../lib/observe-directive.ts";
import { type ApiKeys } from "../lib/storage.js";
import type { ConceptWithId } from "./conceptualize.js";
import "./fit.css";
import type { ParameterWithId } from "./parameterize.js";
import type { ArtifactWithId } from "./visualize.js";

export interface DesignWithId extends Design {
  id: string;
  pinned: boolean;
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
  const editingDesigns$ = new BehaviorSubject<string[]>([]);

  // Actions
  const generateDesigns$ = new Subject<void>();
  const editDesign$ = new Subject<{ id: string; field: "name" | "parameter"; parameterName?: string; value: string }>();
  const pinDesign$ = new Subject<string>();
  const rejectDesign$ = new Subject<string>();
  const revertRejection$ = new Subject<string>();
  const toggleEdit$ = new Subject<string>();

  // Generate designs effect
  const generateEffect$ = generateDesigns$.pipe(
    tap(() => {
      isGenerating$.next(true);

      // Move unpinned designs to rejected list
      const currentDesigns = designs$.value;
      const maybeDesigns = currentDesigns.filter((d) => !d.pinned);
      const pinnedDesigns = currentDesigns.filter((d) => d.pinned);

      if (maybeDesigns.length > 0) {
        const rejectedNames = maybeDesigns.map((d) => d.name);
        rejectedDesigns$.next([...rejectedDesigns$.value, ...rejectedNames]);
        designs$.next(pinnedDesigns);
      }
    }),
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

  // Toggle edit effect
  const toggleEditEffect$ = toggleEdit$.pipe(
    tap((id) => {
      const editing = editingDesigns$.value;
      if (editing.includes(id)) {
        editingDesigns$.next(editing.filter((e) => e !== id));
      } else {
        editingDesigns$.next([...editing, id]);
      }
    }),
  );

  // Template
  const template$ = combineLatest([designs$, rejectedDesigns$, isGenerating$, editingDesigns$]).pipe(
    map(
      ([designs, rejectedDesigns, isGenerating, editingDesigns]) => html`
        <div class="fit">
          <p>Generate design specifications by assigning concrete values to parameters</p>
          <div class="fit-actions">
            <button
              @click=${() => {
                generateDesigns$.next();
              }}
            >
              Generate Designs
            </button>
          </div>

          ${isGenerating ? html`<div class="loading">Generating designs...</div>` : ""}
          ${designs.length > 0
            ? html`
                <div class="designs-grid">
                  ${designs.map(
                    (design) => html`
                      <div
                        class="design-card ${design.pinned ? "pinned" : ""} ${editingDesigns.includes(design.id)
                          ? "design-edit-mode"
                          : ""}"
                      >
                        <textarea
                          class="design-name"
                          rows="1"
                          .value=${design.name}
                          ?readonly=${!editingDesigns.includes(design.id)}
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
                                <div class="parameter-name">${paramName}:</div>
                                <textarea
                                  class="parameter-value"
                                  rows="1"
                                  .value=${paramValue}
                                  ?readonly=${!editingDesigns.includes(design.id)}
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
                        <div class="design-actions">
                          ${editingDesigns.includes(design.id)
                            ? html` <button class="small" @click=${() => toggleEdit$.next(design.id)}>Done</button> `
                            : design.pinned
                              ? html`
                                  <button class="small" @click=${() => pinDesign$.next(design.id)}>✅ Pinned</button>
                                `
                              : html`
                                  <button class="small" @click=${() => pinDesign$.next(design.id)}>Pin</button>
                                  <button class="small" @click=${() => toggleEdit$.next(design.id)}>Edit</button>
                                  <button class="small" @click=${() => rejectDesign$.next(design.id)}>Reject</button>
                                `}
                        </div>
                      </div>
                    `,
                  )}
                </div>
              `
            : ""}
          ${rejectedDesigns.length > 0
            ? html`
                <div class="rejected-designs">
                  <details>
                    <summary>Rejected designs (${rejectedDesigns.length})</summary>
                    <div class="rejected-list">
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
  );

  // Merge all effects
  const effects$ = merge(generateEffect$, editEffect$, pinEffect$, rejectEffect$, revertEffect$, toggleEditEffect$);

  const staticTemplate = html`${observe(template$)}`;

  return {
    fitTemplate: staticTemplate,
    designs$,
    effects$,
  };
}
