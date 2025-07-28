import { render } from "lit-html";
import "./main.css";
import { connectionsView } from "./views/connections";
import "./views/connections.css";
import { partiView } from "./views/parti";
import "./views/parti.css";

// 1. Global DOM references
const connectionsContent = document.querySelector(".connections-content") as HTMLElement;
const partiContent = document.querySelector("#parti-content") as HTMLElement;

// 2. Global streams declarations
const { connectionsTemplate, apiKeys$ } = connectionsView();
const { partiTemplate, partiText$ } = partiView();

// 3. Effects: subscribe and render
render(connectionsTemplate, connectionsContent);
render(partiTemplate, partiContent);
