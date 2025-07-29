---
applyTo: "**/parameterize.*,**/generate-parameters.ts"
---

# Feature: Parameterize

## What

Use the Parti, concepts, and visual artifacts from previous steps to generate a list of design parameters relevant to a specific product domain. Each parameter represents a design aspect that needs to be considered for that product category.

## How

Input: Parti (string), list of concepts ({name: string, description: string}[]), list of artifacts ({name: string, description: string}[]), domain (string), existing parameters (Parameter[])
Output: list of parameters ({name: string, description: string}[])

Parameter name should be concise and clear, representing a specific design decision that a designer must make. It is usually associated with a list of possible choices (e.g., "Material" would be a parameter for clothing, and "Location" would be a parameter for art installation).

Parameter description is a short sentence that defines what this design decision encompasses, including example values that can be assigned to this parameter. This provides clarity about the scope and potential choices without introducing bias into the design process.

Parameter generation uses a similar process to concept and artifact generation, with a system prompt that instructs the LLM to identify domain-specific design decisions commonly required for that product category. The AI suggests parameter categories based on the Parti and previous artifacts, but does not assign specific values.

We generate 3 parameters initially, and 2 parameters incrementally if some parameters already exist

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
