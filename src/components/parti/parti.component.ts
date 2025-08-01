import { html } from "lit-html";
import { BehaviorSubject, ignoreElements, map, mergeWith } from "rxjs";
import { tap } from "rxjs/operators";
import { createComponent } from "../../sdk/create-component";
import "./parti.component.css";

export interface PartiComponentProps {
  partiText$: BehaviorSubject<string>;
}

export const PartiComponent = createComponent((props: PartiComponentProps) => {
  // 1. Internal state
  const { partiText$ } = props;

  // 2. Actions (user interactions) - handled directly in template via event handlers

  // 3. Effects (state changes)
  const inputEffect$ = partiText$.pipe(
    tap(() => {
      // Any side effects related to parti text changes can go here
    }),
  );

  // Event handler
  const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    partiText$.next(target.value);
  };

  // 4. Combine state and template
  const template$ = partiText$.pipe(
    map(
      (partiText) => html`
        <div class="parti-form">
          <label for="parti" class="parti-label">Describe your big idea</label>
          <textarea
            id="parti"
            class="parti-textarea"
            placeholder="Gravity is an illusion"
            rows="1"
            .value=${partiText}
            @input=${handleInput}
          ></textarea>
        </div>
      `,
    ),
    mergeWith(inputEffect$.pipe(ignoreElements())),
  );

  return template$;
});
