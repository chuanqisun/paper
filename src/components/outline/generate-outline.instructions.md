---
applyTo: "**/outline/**"
---

Use Gen AI to prompt the LLM to linearly distill the content to a list of bullet points.

## Requirement

- Use stream feature in openai SDK, so we can get bullet points as they are generated
- Each bullet point should be one short sentence so user can grok the idea quickly
- The bullet points should be on the high level. Hide unnecessary details from the user.
- Each bullet point must cite at least one piece of text from the source document
