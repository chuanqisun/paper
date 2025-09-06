import { html, type TemplateResult } from "lit-html";
import { BehaviorSubject, combineLatest, ignoreElements, map, mergeWith, type Observable, Subject, tap } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { OutlineItem } from "./generate-outline";

export interface AskComponentProps {
  itemToAsk$: BehaviorSubject<OutlineItem | null>;
  onAsk$: Subject<{ item: OutlineItem; question: string }>;
}

export const AskComponent = createComponent((props: AskComponentProps): Observable<TemplateResult> => {
  const { itemToAsk$, onAsk$ } = props;
  const question$ = new BehaviorSubject<string>("");

  const closeDialog$ = new Subject<void>();

  const closeEffect$ = closeDialog$.pipe(
    tap(() => {
      const dialog = document.getElementById("ask-dialog") as HTMLDialogElement;
      if (dialog) {
        dialog.close();
      }
      itemToAsk$.next(null);
      question$.next("");
    }),
  );

  const openEffect$ = itemToAsk$.pipe(
    tap((item) => {
      if (item) {
        const dialog = document.getElementById("ask-dialog") as HTMLDialogElement;
        if (dialog) {
          dialog.showModal();
        }
      }
    }),
  );

  const template$ = combineLatest([itemToAsk$, question$]).pipe(
    map(([item, question]) => {
      if (!item) {
        return html``;
      }

      return html`
        <form
          @submit=${(e: Event) => {
            e.preventDefault();
            if (question.trim()) {
              onAsk$.next({ item, question });
            }
            closeDialog$.next();
          }}
        >
          <p>Ask a question about: ${item.bulletPoint}</p>
          <textarea
            class="outline-ask-input"
            .value=${question}
            @input=${(e: Event) => question$.next((e.target as HTMLTextAreaElement).value)}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Escape") {
                closeDialog$.next();
              }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                if (question.trim()) {
                  onAsk$.next({ item, question });
                }
                closeDialog$.next();
              }
            }}
          ></textarea>
          <div class="dialog-actions">
            <button type="button" @click=${() => closeDialog$.next()}>Cancel</button>
            <button type="submit" ?disabled=${!question.trim()}>Ask</button>
          </div>
        </form>
      `;
    }),
  );

  return template$.pipe(mergeWith(closeEffect$.pipe(ignoreElements()), openEffect$.pipe(ignoreElements())));
});
