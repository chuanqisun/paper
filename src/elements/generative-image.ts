import { Observable, Subject } from "rxjs";
import "./genearative-image.css";

interface GenerateImageResult {
  url: string;
}

interface FluxConnection {
  apiKey: string;
}

export class FluxImageElement extends HTMLElement {
  static getConnection: () => FluxConnection;
  static observedAttributes = ["prompt", "width", "height", "placeholderSrc", "model"];
  static define(getConnection: () => FluxConnection, tagName = "generative-image-element") {
    if (!customElements.get(tagName)) {
      customElements.define(tagName, this);
      FluxImageElement.getConnection = getConnection;
    }
  }

  render$ = new Subject<void>();
  attributeChangedCallback(_name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      this.render$.next();
    }
  }

  generate(): Observable<GenerateImageResult> {
    return new Observable<GenerateImageResult>((subscriber) => {
      subscriber.next({ url: "https://placehold.co/400" });
      subscriber.complete();
    });
  }
}
