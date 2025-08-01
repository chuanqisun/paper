import { html, render } from "lit-html";
import { BehaviorSubject } from "rxjs";
import { ConceptualizeComponent, type ConceptWithId } from "./components/conceptualize/conceptualize.component";
import { ConnectionsComponent } from "./components/connections/connections.component";
import { loadApiKeys, type ApiKeys } from "./components/connections/storage";
import { DesignComponent, type DesignWithId, type MockupWithId } from "./components/design/design.component";
import { FluxImageElement } from "./components/generative-image/generative-image";
import { MoodboardComponent, type ArtifactWithId } from "./components/moodboard/moodboard.component";
import { ParameterizeComponent, type ParameterWithId } from "./components/parameterize/parameterize.component";
import { PartiComponent } from "./components/parti/parti.component";
import "./main.css";
import { createComponent } from "./sdk/create-component";

// Register custom elements
FluxImageElement.define(() => ({
  apiKey: loadApiKeys().together || "",
}));

const Main = createComponent(() => {
  const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());
  const partiText$ = new BehaviorSubject<string>("");
  const concepts$ = new BehaviorSubject<ConceptWithId[]>([]);
  const artifacts$ = new BehaviorSubject<ArtifactWithId[]>([]);
  const parameters$ = new BehaviorSubject<ParameterWithId[]>([]);
  const domain$ = new BehaviorSubject<string>("");
  const designs$ = new BehaviorSubject<DesignWithId[]>([]);
  const mockups$ = new BehaviorSubject<MockupWithId[]>([]);

  return html`
    <header class="header">
      <h1>Computational Design Lab</h1>
    </header>

    <main class="main">
      <section class="section">
        <header class="section-header"><h2>0. Connect</h2></header>
        <div class="connections-content">${ConnectionsComponent({ apiKeys$ })}</div>
      </section>

      <section class="section">
        <header class="section-header"><h2>1. Parti</h2></header>
        <div class="section-content">${PartiComponent({ partiText$ })}</div>
      </section>

      <section class="section">
        <header class="section-header"><h2>2. Concepts</h2></header>
        <div class="section-content">${ConceptualizeComponent({ apiKeys$, partiText$, concepts$ })}</div>
      </section>

      <section class="section">
        <header class="section-header"><h2>3. Moodboard</h2></header>
        <div class="section-content">${MoodboardComponent({ apiKeys$, concepts$, partiText$, artifacts$ })}</div>
      </section>

      <section class="section">
        <header class="section-header"><h2>4. Parameters</h2></header>
        <div class="section-content">
          ${ParameterizeComponent({ apiKeys$, concepts$, artifacts$, partiText$, parameters$, domain$ })}
        </div>
      </section>

      <section class="section">
        <header class="section-header"><h2>5. Designs</h2></header>
        <div class="section-content">
          ${DesignComponent({ apiKeys$, concepts$, artifacts$, parameters$, partiText$, domain$, designs$, mockups$ })}
        </div>
      </section>
    </main>
  `;
});

render(Main(), document.getElementById("app")!);
