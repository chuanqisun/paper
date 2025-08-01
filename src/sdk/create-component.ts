import { html, type TemplateResult } from "lit-html";
import { guard } from "lit-html/directives/guard.js";
import { isObservable, type Observable } from "rxjs";
import { observe } from "./observe-directive";

export function createComponent<TProps extends object | undefined = undefined>(
  factory: (params: TProps) => Observable<TemplateResult> | TemplateResult,
) {
  return (params?: TProps) => {
    const deps = params ? Object.values(params) : [];
    return html`${guard(deps, () => {
      const result = factory(params as TProps);
      const template = isObservable(result) ? observe(result) : result;
      return template;
    })}`;
  };
}
