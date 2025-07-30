import { html, render } from "lit-html";
import { combineLatest, EMPTY, of, Subject } from "rxjs";
import { catchError, distinctUntilChanged, map, switchMap, tap } from "rxjs/operators";
import { generateImage, type FluxConnection } from "../lib/generate-image";
import "./genearative-image.css";

type Status = "empty" | "loading" | "error" | "success";

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
  private status: Status = "empty";
  private currentImageUrl = "";
  private errorMessage = "";

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
        placeholderSrc: this.getAttribute("placeholderSrc") ?? "https://placehold.co/400x400",
        model: this.getAttribute("model") ?? "black-forest-labs/FLUX.1-schnell",
      })),
      distinctUntilChanged(
        (a, b) => a.prompt === b.prompt && a.width === b.width && a.height === b.height && a.model === b.model,
      ),
    );

    const imageGeneration$ = attributes$.pipe(
      switchMap((attrs) => {
        if (!attrs.prompt.trim()) {
          this.updateStatus("empty");
          return of(null);
        }

        this.updateStatus("loading");

        try {
          const connection = FluxImageElement.getConnection();
          return generateImage(connection, {
            prompt: attrs.prompt,
            width: attrs.width,
            height: attrs.height,
            model: attrs.model,
          }).pipe(
            tap((result) => {
              this.currentImageUrl = result.url;
              this.updateStatus("success");
            }),
            catchError((error) => {
              this.errorMessage = error.message || "Failed to generate image";
              this.updateStatus("error");
              return EMPTY;
            }),
          );
        } catch (error) {
          this.errorMessage = error instanceof Error ? error.message : "Failed to generate image";
          this.updateStatus("error");
          return of(null);
        }
      }),
    );

    const template$ = combineLatest([attributes$, imageGeneration$]).pipe(map(([attrs]) => this.renderTemplate(attrs)));

    template$.subscribe((template) => {
      render(template, this);
    });
  }

  private updateStatus(status: Status) {
    this.status = status;
    this.setAttribute("status", status);
  }

  private getImageSrc(attrs: { prompt: string; width: number; height: number; placeholderSrc: string }) {
    if (this.status === "success" && this.currentImageUrl) {
      return this.currentImageUrl;
    }

    if (attrs.placeholderSrc) {
      return attrs.placeholderSrc;
    }

    return `https://placehold.co/${attrs.width}x${attrs.height}`;
  }

  private renderTemplate(attrs: {
    prompt: string;
    width: number;
    height: number;
    placeholderSrc: string;
    model: string;
  }) {
    const imageSrc = this.getImageSrc(attrs);

    return html`
      <img src="${imageSrc}" alt="${attrs.prompt || "Generated image"}" loading="lazy" />
      ${this.status === "error" ? html`<div class="error">${this.errorMessage}</div>` : ""}
    `;
  }
}
