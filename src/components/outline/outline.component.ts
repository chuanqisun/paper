import { html, type TemplateResult } from "lit-html";
import { repeat } from "lit-html/directives/repeat.js";
import {
  BehaviorSubject,
  EMPTY,
  Subject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  filter,
  finalize,
  ignoreElements,
  map,
  merge,
  mergeMap,
  mergeWith,
  of,
  scan,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { ApiKeys } from "../connections/storage";
import type { Citation } from "./citation";
import { generateOutline$, type OutlineItem } from "./generate-outline";
import "./outline.component.css";

export interface OutlineComponentProps {
  apiKeys$: BehaviorSubject<ApiKeys>;
  paperContent$: BehaviorSubject<string | null>;
  isEmpty$: BehaviorSubject<boolean>;
  tooltipContent$: BehaviorSubject<string | null>;
}

export const OutlineComponent = createComponent((props: OutlineComponentProps) => {
  const { apiKeys$, paperContent$, isEmpty$, tooltipContent$ } = props;

  const outline$ = new BehaviorSubject<OutlineItem[]>([]);
  const citations$ = new BehaviorSubject<Record<string, Citation>>({});
  const isGenerating$ = new BehaviorSubject<boolean>(false);
  const stopGeneration$ = new Subject<void>();
  const stopExpanding$ = new Subject<string>();
  const regenerate$ = new Subject<void>();
  const clear$ = new Subject<void>();
  const generateChildren$ = new Subject<OutlineItem>();
  const regenerateItem$ = new Subject<OutlineItem>();
  const clearItem$ = new Subject<OutlineItem>();

  const generationTrigger$ = paperContent$.pipe(distinctUntilChanged());

  const generateOutlineEffect$ = merge(generationTrigger$, regenerate$.pipe(map(() => paperContent$.value))).pipe(
    switchMap((content) => {
      if (!content || content.trim().length === 0) {
        outline$.next([]);
        citations$.next({});
        return EMPTY;
      }

      return combineLatest([apiKeys$]).pipe(
        switchMap(([apiKeys]) => {
          if (!apiKeys.openai) {
            console.error("OpenAI API key not found");
            return EMPTY;
          }

          isGenerating$.next(true);
          outline$.next([]); // Clear previous outline
          citations$.next({}); // Clear previous citations

          return generateOutline$({
            apiKey: apiKeys.openai,
            content: content,
          }).pipe(
            takeUntil(stopGeneration$),
            scan(
              (acc, outlineItem) => {
                const newCitations: Record<string, Citation> = {};
                const citationIds: string[] = [];
                for (const citationText of outlineItem.citations) {
                  const citationId = crypto.randomUUID();
                  newCitations[citationId] = {
                    id: Object.keys(acc.citations).length + Object.keys(newCitations).length + 1,
                    text: citationText,
                  };
                  citationIds.push(citationId);
                }
                const newItem = { ...outlineItem, citationIds };
                return {
                  citations: { ...acc.citations, ...newCitations },
                  items: [...acc.items, newItem],
                  newCitations,
                  newItem,
                };
              },
              {
                citations: {} as Record<string, Citation>,
                items: [] as OutlineItem[],
                newCitations: {} as Record<string, Citation>,
                newItem: {} as OutlineItem,
              },
            ),
            tap(({ newCitations, newItem }) => {
              citations$.next({ ...citations$.value, ...newCitations });
              const current = outline$.value;
              outline$.next([...current, newItem]);
            }),
            catchError((error) => {
              console.error("Error generating outline:", error);
              return EMPTY;
            }),
            finalize(() => isGenerating$.next(false)),
          );
        }),
      );
    }),
  );

  const stopGenerationEffect$ = stopGeneration$.pipe(tap(() => isGenerating$.next(false)));

  const clearEffect$ = clear$.pipe(tap(() => paperContent$.next(null)));

  const regenerateItemEffect$ = regenerateItem$.pipe(
    tap((itemToRegenerate) => {
      const update = (items: OutlineItem[]): OutlineItem[] => {
        return items.map((item) => {
          if (item.id === itemToRegenerate.id) {
            return { ...item, children: [] };
          }
          if (item.children.length > 0) {
            return { ...item, children: update(item.children) };
          }
          return item;
        });
      };
      outline$.next(update(outline$.value));
      generateChildren$.next(itemToRegenerate);
    }),
  );

  const clearItemEffect$ = clearItem$.pipe(
    tap((itemToClear) => {
      const update = (items: OutlineItem[]): OutlineItem[] => {
        return items.map((item) => {
          if (item.id === itemToClear.id) {
            return { ...item, children: [], isExpanded: false };
          }
          if (item.children.length > 0) {
            return { ...item, children: update(item.children) };
          }
          return item;
        });
      };
      outline$.next(update(outline$.value));
    }),
  );

  const generateChildrenEffect$ = generateChildren$.pipe(
    mergeMap((itemToExpand: OutlineItem) => {
      const updateItemState = (
        items: OutlineItem[],
        itemId: string,
        update: (item: OutlineItem) => OutlineItem,
      ): OutlineItem[] => {
        return items.map((item) => {
          if (item.id === itemId) {
            return update(item);
          }
          if (item.children && item.children.length > 0) {
            return { ...item, children: updateItemState(item.children, itemId, update) };
          }
          return item;
        });
      };

      return of(itemToExpand).pipe(
        tap(() => {
          const updatedOutline = updateItemState(outline$.value, itemToExpand.id, (item) => ({
            ...item,
            isExpanding: true,
            isExpanded: true,
          }));
          outline$.next(updatedOutline);
        }),
        switchMap(() =>
          combineLatest([apiKeys$, paperContent$]).pipe(
            take(1),
            switchMap(([apiKeys, content]) => {
              if (!apiKeys.openai || !content) {
                return EMPTY;
              }

              return generateOutline$({
                apiKey: apiKeys.openai,
                content: content,
                parent: itemToExpand,
              }).pipe(
                takeUntil(stopExpanding$.pipe(filter((id) => id === itemToExpand.id))),
                scan(
                  (acc, outlineItem) => {
                    const newCitations: Record<string, Citation> = {};
                    const citationIds: string[] = [];
                    for (const citationText of outlineItem.citations) {
                      const citationId = crypto.randomUUID();
                      newCitations[citationId] = {
                        id: Object.keys(acc.citations).length + Object.keys(newCitations).length + 1,
                        text: citationText,
                      };
                      citationIds.push(citationId);
                    }
                    const newItem = { ...outlineItem, citationIds };
                    return {
                      citations: { ...acc.citations, ...newCitations },
                      newItem,
                    };
                  },
                  { citations: citations$.value, newItem: {} as OutlineItem },
                ),
                tap(({ citations: newCitations, newItem }) => {
                  citations$.next(newCitations);
                  const updatedOutline = updateItemState(outline$.value, itemToExpand.id, (item) => ({
                    ...item,
                    children: [...item.children, newItem],
                  }));
                  outline$.next(updatedOutline);
                }),
              );
            }),
          ),
        ),
        catchError((error) => {
          console.error("Error expanding outline item:", error);
          return EMPTY;
        }),
        finalize(() => {
          const updatedOutline = updateItemState(outline$.value, itemToExpand.id, (item) => ({
            ...item,
            isExpanding: false,
          }));
          outline$.next(updatedOutline);
        }),
      );
    }),
  );

  const onStop = () => stopGeneration$.next();
  const onStopExpanding = (item: OutlineItem) => stopExpanding$.next(item.id);
  const onRegenerate = () => regenerate$.next();
  const onClear = () => clear$.next();
  const onGenerateChildren = (item: OutlineItem) => generateChildren$.next(item);
  const onRegenerateItem = (item: OutlineItem) => regenerateItem$.next(item);
  const onClearItem = (item: OutlineItem) => clearItem$.next(item);
  const onShowTooltip = (item: OutlineItem) => {
    if (!item.citationIds || item.citationIds.length === 0) {
      return;
    }
    const allCitations = citations$.value;
    const tooltipText = item.citationIds
      .map((id) => {
        const citation = allCitations[id];
        return citation ? `[${citation.id}]: ${citation.text}` : null;
      })
      .filter(Boolean)
      .join("\n");

    if (tooltipText) {
      tooltipContent$.next(tooltipText);
    }
  };
  const onHideTooltip = () => tooltipContent$.next(null);

  const toggleBullet = (itemToToggle: OutlineItem) => {
    const update = (items: OutlineItem[]): OutlineItem[] => {
      return items.map((item) => {
        if (item.id === itemToToggle.id) {
          return { ...item, isExpanded: !item.isExpanded };
        }
        if (item.children && item.children.length > 0) {
          return { ...item, children: update(item.children) };
        }
        return item;
      });
    };
    outline$.next(update(outline$.value));
  };

  const renderOutlineItem = (item: OutlineItem): TemplateResult => {
    const hasChildren = item.children && item.children.length > 0;
    const chevron = item.isExpanded ? "▾" : "▸";

    return html`
      <div class="outline-item">
        <div
          class="outline-item-self"
          @click=${() => toggleBullet(item)}
          @mouseenter=${() => onShowTooltip(item)}
          @mouseleave=${onHideTooltip}
        >
          <span class="outline-chevron">${chevron}</span>
          <span class="outline-bullet-point">${item.bulletPoint}</span>
        </div>
        ${item.isExpanded
          ? html`
              <div class="outline-item-children">
                <div class="outline-actions">
                  ${!hasChildren && !item.isExpanding
                    ? html`<button
                        class="outline-action-button"
                        @click=${(e: Event) => {
                          e.stopPropagation();
                          onGenerateChildren(item);
                        }}
                      >
                        Expand
                      </button>`
                    : null}
                  ${item.isExpanding
                    ? html`<button
                        @click=${(e: Event) => {
                          e.stopPropagation();
                          onStopExpanding(item);
                        }}
                        class="outline-action-button stop-button"
                      >
                        stop
                      </button>`
                    : null}
                  ${hasChildren && !item.isExpanding
                    ? html`
                        <button
                          class="outline-action-button"
                          @click=${(e: Event) => {
                            e.stopPropagation();
                            onRegenerateItem(item);
                          }}
                        >
                          Regenerate
                        </button>
                        <button
                          class="outline-action-button"
                          @click=${(e: Event) => {
                            e.stopPropagation();
                            onClearItem(item);
                          }}
                        >
                          Clear
                        </button>
                      `
                    : null}
                </div>
                ${repeat(
                  item.children,
                  (child: OutlineItem) => child.id,
                  (child: OutlineItem) => renderOutlineItem(child),
                )}
              </div>
            `
          : null}
      </div>
    `;
  };

  const template$ = combineLatest([outline$, isGenerating$, paperContent$]).pipe(
    tap(([outlineItems, isGenerating, content]) => {
      const hasContent = !!content && content.trim().length > 0;
      const hasOutline = outlineItems.length > 0;
      isEmpty$.next(!hasOutline && !isGenerating && hasContent);
    }),
    map(([outlineItems, isGenerating, content]) => {
      const hasContent = content && content.trim().length > 0;
      const hasOutline = outlineItems.length > 0;

      if (!hasContent && !isGenerating) {
        return html``;
      }

      const showStop = isGenerating;
      const showRegenerateAndClear = !isGenerating && (hasContent || hasOutline);

      return html`
        <div class="outline-section">
          <div class="outline-header">
            <h2>Outline</h2>
            <div class="outline-actions">
              ${showStop
                ? html`<button @click=${onStop} class="outline-action-button stop-button">stop</button>`
                : null}
              ${showRegenerateAndClear
                ? html`
                    <button @click=${onRegenerate} class="outline-action-button">Regenerate</button>
                    <button @click=${onClear} class="outline-action-button">Clear</button>
                  `
                : null}
            </div>
          </div>
          <div class="outline-content">
            ${repeat(
              outlineItems,
              (item: OutlineItem) => item.id,
              (item: OutlineItem) => renderOutlineItem(item),
            )}
            ${isGenerating ? html`<div class="outline-item generating">Generating...</div>` : null}
          </div>
        </div>
      `;
    }),
  );

  return template$.pipe(
    mergeWith(
      generateOutlineEffect$.pipe(ignoreElements()),
      stopGenerationEffect$.pipe(ignoreElements()),
      clearEffect$.pipe(ignoreElements()),
      generateChildrenEffect$.pipe(ignoreElements()),
      regenerateItemEffect$.pipe(ignoreElements()),
      clearItemEffect$.pipe(ignoreElements()),
    ),
  );
});
