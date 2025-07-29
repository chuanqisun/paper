import { render } from "lit-html";
import "./main.css";
import { conceptualMappingView } from "./views/conceptualize";
import { connectionsView } from "./views/connections";
import { parameterizeView } from "./views/parameterize";
import { partiView } from "./views/parti";
import { visualizeView } from "./views/visualize";

// 1. Global DOM references
const connectionsContent = document.querySelector(".connections-content") as HTMLElement;
const partiContent = document.querySelector("#parti-content") as HTMLElement;
const conceptualContent = document.querySelector("#conceptual-content") as HTMLElement;
const artifactsContent = document.querySelector("#artifacts-content") as HTMLElement;
const parametersContent = document.querySelector("#parameters-content") as HTMLElement;

// 2. Global streams declarations
const { connectionsTemplate, apiKeys$ } = connectionsView();
const { partiTemplate } = partiView();
const { conceptualTemplate, concepts$, effects$ } = conceptualMappingView(apiKeys$);
const { visualizeTemplate, artifacts$, effects$: visualizeEffects$ } = visualizeView(apiKeys$, concepts$);
const { parameterizeTemplate, effects$: parameterizeEffects$ } = parameterizeView(apiKeys$, concepts$, artifacts$);

// 3. Effects: subscribe and render
render(connectionsTemplate, connectionsContent);
render(partiTemplate, partiContent);
render(conceptualTemplate, conceptualContent);
render(visualizeTemplate, artifactsContent);
render(parameterizeTemplate, parametersContent);

// Subscribe to effects to enable reactive behavior
effects$.subscribe();
visualizeEffects$.subscribe();
parameterizeEffects$.subscribe();
