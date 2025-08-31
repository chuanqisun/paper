import { html } from "lit-html";
import { BehaviorSubject, EMPTY, ignoreElements, map, mergeMap, mergeWith, tap, withLatestFrom } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { ImageItem } from "../canvas/canvas.component";
import type { ApiKeys } from "../connections/storage";
import { blendImages } from "./blend-images";
import "./context-tray.component.css";

export const ContextTrayComponent = createComponent(
  ({ images$, apiKeys$ }: { images$: BehaviorSubject<ImageItem[]>; apiKeys$: BehaviorSubject<ApiKeys> }) => {
    // Internal state
    const blendInstruction$ = new BehaviorSubject<string>("");

    // Actions
    const blend$ = new BehaviorSubject<void>(undefined);

    // Effects
    const blendEffect$ = blend$.pipe(
      withLatestFrom(images$, blendInstruction$, apiKeys$),
      mergeMap(([_, images, instruction, apiKeys]) => {
        const selected = images.filter((img) => img.isSelected);
        if (selected.length < 2 || !instruction.trim() || !apiKeys.gemini) {
          return EMPTY;
        }
        return blendImages({ instruction: instruction.trim(), images: selected, apiKey: apiKeys.gemini }).pipe(
          tap((blendedSrc) => {
            const newImage: ImageItem = {
              id: `blended-${Date.now()}`,
              src: blendedSrc,
              x: Math.random() * 400,
              y: Math.random() * 400,
              width: 200,
              height: 200,
              caption: `(blended)`,
              isSelected: false,
            };
            images$.next([...images$.value, newImage]);
          }),
        );
      }),
      ignoreElements(),
    );

    const template$ = images$.pipe(
      map((images) => {
        const selected = images.filter((img) => img.isSelected);
        if (selected.length === 0) return html``;

        const blendUI =
          selected.length >= 2
            ? html`
                <div class="blend-section">
                  <textarea
                    placeholder="Enter blending instruction..."
                    .value=${blendInstruction$.value}
                    @input=${(e: Event) => blendInstruction$.next((e.target as HTMLTextAreaElement).value)}
                  ></textarea>
                  <button @click=${() => blend$.next()}>Blend</button>
                </div>
              `
            : html``;

        return html`<aside class="context-tray">
          <p>${selected.length === 1 ? `Caption: ${selected[0].caption}` : `${selected.length} items`}</p>
          ${blendUI}
        </aside>`;
      }),
    );

    return template$.pipe(mergeWith(blendEffect$));
  },
);
