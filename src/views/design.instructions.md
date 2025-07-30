---
applyTo: "**/design.*,**/generate-designs.ts"
---

# Feature: Design

## What

Use the Parti, concepts, visual artifacts, and parameters from all previous steps to generate specific product designs by assigning concrete values to the parameters.

## How

### Part 1: Assign parameters

Input: Parti (string), list of concepts ({name: string, description: string}[]), visual artifacts (image URLs and descriptions), list of parameters ({name: string, description: string}[])
Output: list of designs ({name: string, parameterAssignments: Record<string, string>}[])

Design name is for human to quickly identify the design approach. It should be descriptive but concise, capturing the key design direction.

Parameter assignments map each parameter name to a specific value that reflects the design decisions influenced by the Parti, concepts, and visual artifacts.

Design generation uses a similar process to concept generation, with a system prompt that instructs the LLM to create cohesive design decisions that align with the established vision. The designs should be diverse, exploring different ways to interpret the Parti through the lens of the concepts and visual direction.

We generate 3 initially, and 2 incrementally

Design generation is single thread but we will receive incremental outputs (as we do in concept generation).

### Part 2: Render product mockups

Input: list of designs ({name: string, parameterAssignments: Record<string, string>}[]), domain (string from parameterize step)
Intermediate output: list of mockups ({name: string, description: string}[])
Final output: list of images (urls)

Mockup name is the name of the view or aspect being shown (e.g., "Front", "Interior", "Detail", "In Use", "Side", "Top", etc.).

Mockup description is a detailed text description for AI to generate images from. It must be fully self-contained and descriptive enough to serve as an accessibility caption for blind people. It should explicitly describe what the product is, what view/aspect is being shown, all visible materials and colors, the setting/environment, lighting conditions, and any other visual details that would help someone understand exactly what they would see in the image. Include specific details from the parameter assignments and explain how they manifest visually in this domain product.

Mockup generation uses a similar process to artifact generation, with a system prompt that instructs the LLM to create product design renderings based on the parameter assignments and domain knowledge. The mockups should visualize different aspects, views, or configurations of the same unified product design, showcasing how the design decisions would manifest in actual products within the specified domain. These are complementary views that together tell the complete story of the product.

We generate 3 initially, and 2 incrementally

Mockup generation is single thread but we will receive incremental outputs (as we do in concept generation).

Text-to-image generation should run concurrently. We kick off image gen as soon as each mockup description is generated. This can be achieved with RxJS mergeMap operator.

## User control

A button to Generate Designs (design specifications)

### Manual Design Addition

A text input field where users can type in the high-level idea of a design they want to add manually.
A button labeled "Add Design" that triggers the manual design creation process.

When a user adds a design manually:

1. The system takes the user's input text as the design concept
2. AI automatically assigns sensible values to all parameters based on the user's input and the established context (Parti, concepts, visual artifacts)
3. The new design is added to the list of designs with AI-generated parameter assignments
4. The design follows the same workflow as AI-generated designs (can be pinned, edited, or rejected)

For each design, user can see the design name and all parameter assignments.
For each design, user can Pin, Edit, or Reject it, similar to the concept generation workflow
User can edit parameter assignments directly within each design card

A button to Render Mockups (product design mockups) that uses the generated parameters and domain from the parameterize step
For each design, user can see a "Render" button that appears before Pin/Reject buttons
For each mockup, user can Pin, Edit, or Reject it, similar to the visualize workflow
User needs to click an Edit button to see the text representation behind the image

## UI

### Manual Design Addition Interface

- A text input field for entering the high-level design idea
- "Add Design" button positioned next to or below the input field
- The input should be prominently placed at the top of the design section for easy access

### Design Display

Display designs as cards in a single column layout. Each card shows:

- Design name as the header
- Parameter assignments as key-value pairs below
- Action buttons (Pin/Edit/Reject)

Rejected designs only show the name with a restore button.
Pinned designs are visually highlighted and persist across sessions.

For editing, expand the card to show editable input fields for each parameter assignment.

Display rendered mockups as cards in a grid layout similar to the visualize feature. The cards are like Polaroids with the image on top and the description below.

Rejected mockups only show the title with a restore button.
