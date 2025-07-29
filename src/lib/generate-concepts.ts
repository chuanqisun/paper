import { JSONParser } from "@streamparser/json";
import { OpenAI } from "openai";
import { Observable } from "rxjs";

export interface StreamConceptsParams {
  parti: string;
  existingConcepts: string[];
  rejectedConcepts: string[];
  apiKey: string;
}

export interface Concept {
  concept: string;
  description: string;
}

export function streamConcepts$(params: StreamConceptsParams): Observable<Concept> {
  return new Observable<Concept>((subscriber) => {
    const openai = new OpenAI({
      dangerouslyAllowBrowser: true,
      apiKey: params.apiKey,
    });

    const parser = new JSONParser();

    // Wire up parser event to emit concepts
    parser.onValue = (entry) => {
      // Check if this is an array item under the "concepts" key
      if (typeof entry.key === "number" && entry.parent && entry.value && typeof entry.value === "object") {
        const concept = entry.value as unknown as Concept;
        if (concept.concept && concept.description) {
          subscriber.next(concept);
        }
      }
    };

    // Call OpenAI responses API in structured mode, streaming output
    (async () => {
      try {
        const existingList =
          params.existingConcepts.length > 0
            ? `\n\nExisting concepts (avoid repetition):\n${params.existingConcepts.map((c) => `- ${c}`).join("\n")}`
            : "";

        const rejectedList =
          params.rejectedConcepts.length > 0
            ? `\n\nRejected concepts (do not suggest these):\n${params.rejectedConcepts.map((c) => `- ${c}`).join("\n")}`
            : "";

        const prompt = `
Generate conceptual keywords that best represent this Parti:

\`\`\`parti
${params.parti}
\`\`\`${existingList}${rejectedList}

Generate up to ${params.existingConcepts.length ? 3 : 5} new concepts (one word, or compound word) with short descriptions that capture the essence of the Parti. Each concept should be unique and meaningful.

Respond in this JSON format:
{
  "concepts": [
    {
      "concept": "string",
      "description": "string"
    }
  ]
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

export function regenerateDescription$(params: {
  concept: string;
  apiKey: string;
  existingConcepts?: Concept[];
}): Observable<string> {
  return new Observable<string>((subscriber) => {
    const openai = new OpenAI({
      dangerouslyAllowBrowser: true,
      apiKey: params.apiKey,
    });

    (async () => {
      try {
        const response = await openai.responses.create({
          model: "gpt-4.1",
          input: [
            { role: "developer", content: "Write a short one-sentence description for the provided concept." },

            // Few-shot examples using existing concepts
            ...(params.existingConcepts ?? []).flatMap((example) => [
              { role: "user" as const, content: example.concept },
              { role: "assistant" as const, content: example.description },
            ]),

            { role: "user", content: params.concept },
          ],
        });

        const message = response.output[0];
        if (message?.type === "message" && "content" in message) {
          const content = message.content?.[0];
          if (content?.type === "output_text") {
            subscriber.next(content.text.trim());
          }
        }
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();
  });
}
