import { render } from "lit-html";
import "./main.css";
import { conceptualMappingView } from "./views/conceptualize";
import { connectionsView } from "./views/connections";
import { partiView } from "./views/parti";

// 1. Global DOM references
const connectionsContent = document.querySelector(".connections-content") as HTMLElement;
const partiContent = document.querySelector("#parti-content") as HTMLElement;
const conceptualContent = document.querySelector("#conceptual-content") as HTMLElement;

// 2. Global streams declarations
const { connectionsTemplate, apiKeys$ } = connectionsView();
const { partiTemplate } = partiView();
const { conceptualTemplate, effects$ } = conceptualMappingView(apiKeys$);

// 3. Effects: subscribe and render
render(connectionsTemplate, connectionsContent);
render(partiTemplate, partiContent);
render(conceptualTemplate, conceptualContent);

// Subscribe to effects to enable reactive behavior
effects$.subscribe();
