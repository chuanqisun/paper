---
applyTo: "**/conceptualize.*, **/generate-concepts.ts"
---

# Feature: Conceptual Map

## What

A step where user and AI collaborate to map out what the Parti truly means

## Outcome

The step will produce a set of concepts (Words or short phrase) that best represent the Parti.
Each concept also has a one short sentence description.

## UI

User can perform these actions:

- Generate concepts: use Parti and existing concepts (if any) to generate new concepts that avoid repetition of the existing ones
- Edit a concept and its description
- Manually add a concept and its description
- Regenerate the concept based on its description
- Regenerate the description based on its concept
- Reject a concept: remove it from the list and move it to the rejected list (so we don't generate it again)
- Revert a rejection: move it back to the main list
- Favorite a concept: mark it as favorite, so we can prioritize it in the next step

## Logic

- Use OpenAI Response API with structured output
- Use @streamparser/json (already installed in package.json) to incrementally emit concepts

## Reference implementation of incremental structured output

```ts
import { Observable } from "rxjs";
import { OpenAI } from "openai"; // Assume imported from 'openai' package or a compatible ESM module
import { JSONParser } from "@streamparser/json"; // Assume imported from '@streamparser/json'

// Types for ideas
interface Idea {
  title: string;
  description: string;
  sourceIds: number[];
}

// The demo function: streams ideas from OpenAI, emits each parsed idea
export function streamIdeas$(params: { backlog: string; apiKey: string }): Observable<Idea> {
  return new Observable<Idea>((subscriber) => {
    const openai = new OpenAI({
      dangerouslyAllowBrowser: true,
      apiKey: params.apiKey,
    });

    const parser = new JSONParser();

    // Wire up parser event to emit ideas
    parser.onValue = (entry) => {
      // Assume ideas are entries in an array under key 'ideas'
      if (typeof entry.key === "number" && entry.parent?.key === "ideas" && typeof entry.value?.title === "string") {
        subscriber.next(entry.value);
      }
    };

    // Call OpenAI responses API in structured mode, streaming output
    (async () => {
      try {
        const prompt = `
Generate inspiring ideas based on the backlog:

\`\`\`backlog
${params.backlog}
\`\`\`

Respond 7 ideas in this JSON format:
type Response {
  ideas: {
    title: string;
    description: string;
    sourceIds: number[];
  }[]
}
        `.trim();

        const responseStream = await openai.responses.create({
          model: "gpt-4.1",
          input: prompt,
          text: { format: { type: "json_object" } },
          stream: true,
        });

        for await (const chunk of responseStream) {
          if (chunk.type === "response.output_text.delta") {
            parser.write(chunk.delta);
          }
        }
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();
  });
}
```
