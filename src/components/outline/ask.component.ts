import { html, type TemplateResult } from "lit-html";
import { BehaviorSubject, combineLatest, ignoreElements, map, mergeWith, type Observable, Subject, tap } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import "./ask.component.css";
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
      itemToAsk$.next(null);
      question$.next("");
    }),
  );

  const openEffect$ = itemToAsk$.pipe(
    tap((item) => {
      const dialog = document.getElementById("ask-dialog") as HTMLDialogElement;
      if (dialog) {
        if (item) {
          dialog.showModal();
        } else {
          dialog.close();
        }
      }
    }),
  );

  const template$ = combineLatest([itemToAsk$, question$]).pipe(
    map(([item, question]) => {
      return html`
        <form
          method="dialog"
          @submit=${(e: Event) => {
            if (!question.trim()) {
              e.preventDefault();
              return;
            }

            if (item) {
              onAsk$.next({ item, question });
              question$.next(""); // Clear the question input after submission
            }
          }}
        >
          <div>
            <label for="question">Ask about: ${item?.bulletPoint}</label>
          </div>
          <br />
          <input
            id="question"
            class="outline-ask-input"
            type="text"
            autofocus
            .value=${question}
            @input=${(e: Event) => question$.next((e.target as HTMLInputElement).value)}
          />
        </form>
      `;
    }),
  );

  return template$.pipe(mergeWith(closeEffect$.pipe(ignoreElements()), openEffect$.pipe(ignoreElements())));
});
