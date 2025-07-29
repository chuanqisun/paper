---
applyTo: "**/parameterize.*,**/generate-parameters.ts"
---

# Feature: Parameterize

## What

Use the Parti, concepts, and visual artifacts from previous steps to generate product design parameter sets for a specific domain. Each parameter set represents a cohesive collection of design decisions required for that product domain.

## How

Input: Parti (string), list of concepts ({name: string, description: string}[]), list of artifacts ({name: string, description: string}[]), domain (string), existing parameter sets (ParameterSet[])
Intermediate output: list of parameter sets ({name: string, description: string, parameters: Record<string, string>}[])
Final output: structured parameter sets ready for rendering

Parameter set name is for human to quickly identify the design direction. It should be very short, one word, or a short phrase only.

Parameter set description is a brief summary of the overall design direction and how it relates to the Parti.

Parameters object contains key-value pairs where keys are design aspects (e.g., "material", "color", "form_factor", "texture") and values are specific design decisions for that aspect.

Parameter generation uses a similar process to concept and artifact generation, but with a system prompt that instructs the LLM to generate domain-specific design parameters commonly required for that product category. The AI should suggest both the parameter categories and the specific values based on the Parti and previous artifacts.

We generate 3 initially, and 2 incrementally

Parameter generation is single thread but we will receive incremental outputs (as we do in concept and artifact generation).

## User control

A text input for specifying the product domain (e.g., "packaging", "clothing", "personal electronics")
A button to Generate Parameters
For each parameter set, user can see the name, description, and all parameter key-value pairs
For each parameter set, user can Accept or Reject it, similar to the concept and artifact generation workflow

## UI

Display parameter sets as cards in a list. Each card shows:

- Parameter set name as a heading
- Description as body text
- Parameter key-value pairs displayed as a definition list or table

Rejected parameter sets only show the name with a restore button.
