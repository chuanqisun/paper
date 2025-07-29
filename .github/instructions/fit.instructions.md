---
applyTo: "**/fit.*,**/generate-designs.ts"
---

# Feature: Fit

## What

Use the Parti, concepts, visual artifacts, and parameters from all previous steps to generate specific product designs by assigning concrete values to the parameters.

## How

Input: Parti (string), list of concepts ({name: string, description: string}[]), visual artifacts (image URLs and descriptions), list of parameters ({name: string, description: string}[])
Output: list of designs ({name: string, parameterAssignments: Record<string, string>}[])

Design name is for human to quickly identify the design approach. It should be descriptive but concise, capturing the key design direction.

Parameter assignments map each parameter name to a specific value that reflects the design decisions influenced by the Parti, concepts, and visual artifacts.

Design generation uses a similar process to concept generation, with a system prompt that instructs the LLM to create cohesive design decisions that align with the established vision. The designs should be diverse, exploring different ways to interpret the Parti through the lens of the concepts and visual direction.

We generate 3 initially, and 2 incrementally

Design generation is single thread but we will receive incremental outputs (as we do in concept generation).

## User control

A button to Generate Designs (design specifications)
For each design, user can see the design name and all parameter assignments.
For each design, user can Pin, Edit, or Reject it, similar to the concept generation workflow
User can edit parameter assignments directly within each design card

## UI

Display designs as cards in a grid. Each card shows:

- Design name as the header
- Parameter assignments as key-value pairs below
- Action buttons (Pin/Edit/Reject)

Rejected designs only show the name with a restore button.
Pinned designs are visually highlighted and persist across sessions.

For editing, expand the card to show editable input fields for each parameter assignment.
