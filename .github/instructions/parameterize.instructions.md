---
applyTo: "**/parameterize.*,**/generate-parameters.ts"
---

# Feature: Parameterize

## What

Use the Parti, concepts, and visual artifacts from previous steps to generate a list of design parameters relevant to a specific product domain. Each parameter represents a design aspect that needs to be considered for that product category.

## How

Input: Parti (string), list of concepts ({name: string, description: string}[]), list of artifacts ({name: string, description: string}[]), domain (string), existing parameters (Parameter[])
Output: list of parameters ({name: string, description: string}[])

Parameter name should be concise and clear, representing a specific design aspect (e.g., "Material" would be a parameter for clothing, and "Location" would be a parameter for art installation).

Parameter description explains what this design aspect encompasses and why it's relevant to the product domain. Descriptions should be neutral and avoid specific examples or values to prevent introducing bias into the design process.

Parameter generation uses a similar process to concept and artifact generation, with a system prompt that instructs the LLM to identify domain-specific design aspects commonly required for that product category. The AI suggests parameter categories based on the Parti and previous artifacts, but does not assign specific values.

We generate 3 initially, and 2 incrementally

Parameter generation is single thread but we will receive incremental outputs (as we do in concept and artifact generation).

## User control

A required text input for specifying the product domain (e.g., "packaging", "clothing", "personal electronics")
A button to Generate Parameters
For each parameter, user can see the name and description
For each parameter, user can Pin, Unpin, or Reject it, similar to the concept and artifact generation workflow

## UI

Display parameters as cards in a list. Each card shows:

- Parameter name as a heading
- Description as body text

Rejected parameters only show the name with a restore button.
