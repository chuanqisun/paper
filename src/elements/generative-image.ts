import { html, render } from "lit-html";
import { combineLatest, concat, of, Subject } from "rxjs";
import { catchError, distinctUntilChanged, map, switchMap, tap } from "rxjs/operators";
import { generateImage, type FluxConnection } from "../lib/generate-image";
import "./generative-image.css";

type Status = "empty" | "loading" | "error" | "success";

interface ImageState {
  status: Status;
  imageUrl: string;
  altText: string;
}

export class FluxImageElement extends HTMLElement {
  static getConnection: () => FluxConnection;
  static observedAttributes = ["prompt", "width", "height", "placeholderSrc", "model"];

  static define(getConnection: () => FluxConnection, tagName = "generative-image") {
    if (!customElements.get(tagName)) {
      customElements.define(tagName, this);
      FluxImageElement.getConnection = getConnection;
    }
  }

  private render$ = new Subject<void>();

  connectedCallback() {
    this.setupReactivity();
    this.render$.next();
  }

  attributeChangedCallback(_name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      this.render$.next();
    }
  }

  private setupReactivity() {
    const attributes$ = this.render$.pipe(
      map(() => ({
        prompt: this.getAttribute("prompt") ?? "",
        width: parseInt(this.getAttribute("width") ?? "400"),
        height: parseInt(this.getAttribute("height") ?? "400"),
        placeholderSrc: this.getAttribute("placeholderSrc"),
        model: this.getAttribute("model") ?? "black-forest-labs/FLUX.1-schnell-free",
      })),
      distinctUntilChanged(
        (a, b) => a.prompt === b.prompt && a.width === b.width && a.height === b.height && a.model === b.model,
      ),
    );

    const imageState$ = attributes$.pipe(
      switchMap((attrs) => {
        if (!attrs.prompt.trim()) {
          return of({
            status: "empty" as Status,
            imageUrl: this.getPlaceholderUrl(attrs),
            altText: "Enter a prompt to generate an image",
          });
        }

        const loadingState: ImageState = {
          status: "loading",
          imageUrl: this.getGeneratingUrl(attrs),
          altText: attrs.prompt ?? "<blank>",
        };

        try {
          const connection = FluxImageElement.getConnection();

          const generation$ = generateImage(connection, {
            prompt: attrs.prompt,
            width: attrs.width,
            height: attrs.height,
            model: attrs.model,
          }).pipe(
            map((result) => ({
              status: "success" as Status,
              imageUrl: result.url,
              altText: attrs.prompt || "Generated image",
            })),
            catchError((error) =>
              of({
                status: "error" as Status,
                imageUrl: this.getErrorUrl(attrs),
                altText: error.message || "Failed to generate image",
              }),
            ),
          );

          return concat(of(loadingState), generation$);
        } catch (error) {
          return of({
            status: "error" as Status,
            imageUrl: this.getErrorUrl(attrs),
            altText: error instanceof Error ? error.message : "Failed to generate image",
          });
        }
      }),
      tap((state) => this.setAttribute("status", state.status)),
    );

    const template$ = combineLatest([attributes$, imageState$]).pipe(
      map(([_attrs, state]) => this.renderTemplate(state)),
    );

    template$.subscribe((template) => {
      render(template, this);
    });
  }

  private getPlaceholderUrl(attrs: { width: number; height: number; placeholderSrc?: string | null }) {
    return attrs.placeholderSrc ?? `https://placehold.co/${attrs.width}x${attrs.height}/EEE/999?font=source-sans-pro`;
  }

  private getErrorUrl(attrs: { width: number; height: number }) {
    return `https://placehold.co/${attrs.width}x${attrs.height}/EEE/999?text=Error&font=source-sans-pro`;
  }

  private getGeneratingUrl(attrs: { width: number; height: number }) {
    return `https://placehold.co/${attrs.width}x${attrs.height}/EEE/999?font=source-sans-pro`;
  }

  private renderTemplate(state: ImageState) {
    return html`<img src="${state.imageUrl}" alt="${state.altText}" title="${state.altText}" loading="lazy" />`;
  }
}
