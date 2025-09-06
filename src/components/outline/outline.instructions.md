---
applyTo: "outline/**"
---

# Outline feature

An interactive outline that summarizes the document into recursively explorable bullet points.

## Behavior

- The outline items are generated incrementally by using an LLM to distill the source document
- Each bullet point in the outline can be clicked to toggle open/close state
- Each bullet must be trailed by 1 or more source links. A source link is a numbered reference to texts from the original document. The source link number increments as more links are added.
- When a bullet point is opened, user has options:
  - Expand: expand the bullet point into sub-bullets, each bullet point following the same rules as the parent bullet point.
  - Ask: ask a question about this bullet point. When user clicks ask, an inline input box allows user to type in question and get an answer from the LLM. The question itself is a bullet point, and the answer to that question are bullet points too and follows the same rules.
- For the "Expand" and "Ask" task, the LLM should use the full source text as well as the ancestor bullet points as context. Prompt shall be carefully constructed so LLM has the correct context and focus for the task.

## Appearance

- The outline is a nested hierarchical tree. We use monospace characters to render indentation and open/close indicator so we can align the indendation properly.
- The source links are just simple numbers in square brackets, e.g. [1], [2]. Clicking on the source link will render the source text in a tooltip.
