import { render } from "lit-html";
import "./main.css";
import { conceptualMappingView } from "./views/conceptualize";
import { connectionsView } from "./views/connections";
import { fitView } from "./views/fit";
import { parameterizeView } from "./views/parameterize";
import { partiView } from "./views/parti";
import { visualizeView } from "./views/visualize";

// 1. Global DOM references
const connectionsContent = document.querySelector(".connections-content") as HTMLElement;
const partiContent = document.querySelector("#parti-content") as HTMLElement;
const conceptualContent = document.querySelector("#conceptual-content") as HTMLElement;
const artifactsContent = document.querySelector("#artifacts-content") as HTMLElement;
const parametersContent = document.querySelector("#parameters-content") as HTMLElement;
const fitContent = document.querySelector("#renderings-content") as HTMLElement;

// 2. Global streams declarations
const { connectionsTemplate, apiKeys$ } = connectionsView();
const { partiTemplate, partiText$ } = partiView();
const { conceptualTemplate, concepts$, effects$: conceptualize$ } = conceptualMappingView(apiKeys$, partiText$);
const { visualizeTemplate, artifacts$, effects$: visualize$ } = visualizeView(apiKeys$, concepts$, partiText$);
const {
  parameterizeTemplate,
  parameters$,
  domain$,
  effects$: parameterize$,
} = parameterizeView(apiKeys$, concepts$, artifacts$, partiText$);
const { fitTemplate, effects$: fitEffects$ } = fitView(
  apiKeys$,
  concepts$,
  artifacts$,
  parameters$,
  partiText$,
  domain$,
);

// 3. Effects: subscribe and render
render(connectionsTemplate, connectionsContent);
render(partiTemplate, partiContent);
render(conceptualTemplate, conceptualContent);
render(visualizeTemplate, artifactsContent);
render(parameterizeTemplate, parametersContent);
render(fitTemplate, fitContent);

// Subscribe to effects to enable reactive behavior
conceptualize$.subscribe();
visualize$.subscribe();
parameterize$.subscribe();
fitEffects$.subscribe();
