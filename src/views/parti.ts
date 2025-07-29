import type { TemplateResult } from "lit-html";
import { html } from "lit-html";
import { BehaviorSubject } from "rxjs";
import { observe } from "../lib/observe-directive";
import "./parti.css";

export function partiView() {
  // Internal state
  const partiText$ = new BehaviorSubject<string>("");

  // Event handlers
  const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    partiText$.next(target.value);
  };

  // Template
  const partiTemplate: TemplateResult = html`
    <div class="parti-form">
      <label for="parti" class="parti-label">Describe your big idea</label>
      <textarea
        id="parti"
        class="parti-textarea"
        placeholder="Gravity is an illusion"
        rows="1"
        .value=${observe(partiText$)}
        @input=${handleInput}
      ></textarea>
    </div>
  `;

  return {
    partiTemplate,
    partiText$,
  };
}
