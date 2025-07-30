---
applyTo: "**/moodboard.*,**/generate-artifacts.ts"
---

# Feature: Moodboard

## What

Use a list of user provided concepts and their descriptions to generate a set of images that represent the Parti of a design.

## How

Input: Parti (string), list of concepts ({name: string, description: string}[]), existing image descriptions (string[])
Intermediate output: list of artifacts ({name: string, description: string}[])
Final output: list of images (urls)

Artifact name is for human to quickly identify what it is. It should be very short, one word, or a short phrase only.

Artifact description is a detailed text description for AI to generate images from. It should be one sentence long, detailed description including subject, scene, style.

Artifact generation uses a similar process to concept generation, but with a system prompt that instructs the LLM to generate artifacts commonly seen in a moodboard. The want the image to be diverse and represent multi-sensory aspects of the Parti.

We generate 5 initially, and 3 incrementally

Artifact generation is single thread but we will receive incremental outputs (as we do in concept generation).

Text-to-image generation happens automatically within the generative-image web component. Each artifact's description is passed as the prompt to the component, which handles the image generation process internally using the Together.ai API.

## User control

A button to Generate Artifacts (image descriptions + images)
For each artifact, user can see the text description as well as the image.
For each artifact, user can Accept or Reject it, similar to the concept generation workflow

## UI

Display artifacts as cards in a grid. The cards are like Polaroids with the generative-image component on top and the description below. The generative-image component automatically handles loading states, error states, and displays a placeholder while generating.

Rejected artifacts only show the title with a restore button.
