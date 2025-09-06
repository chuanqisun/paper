import { JSONParser } from "@streamparser/json";
import { OpenAI } from "openai";
import { Observable } from "rxjs";

export interface GenerateOutlineParams {
  apiKey: string;
  content: string;
}

export interface OutlineItem {
  id: string;
  bulletPoint: string;
  children: OutlineItem[];
  isExpanded: boolean;
}

export function generateOutline$(params: GenerateOutlineParams): Observable<OutlineItem> {
  return new Observable<OutlineItem>((subscriber) => {
    const openai = new OpenAI({
      dangerouslyAllowBrowser: true,
      apiKey: params.apiKey,
    });

    const parser = new JSONParser();

    // Wire up parser event to emit outline items
    parser.onValue = (entry) => {
      // Check if this is an array item under the "outline" key
      if (typeof entry.key === "number" && entry.parent && entry.value && typeof entry.value === "object") {
        const outlineItem = entry.value as unknown as OutlineItem;
        if (outlineItem.bulletPoint) {
          subscriber.next({
            ...outlineItem,
            id: crypto.randomUUID(),
            children: [],
            isExpanded: false,
          } satisfies OutlineItem);
        }
      }
    };

    // Call OpenAI responses API in structured mode, streaming output
    (async () => {
      try {
        const prompt = `
Distill the following content into a list of high-level bullet points. Each bullet point should be one short sentence that captures a key idea or concept. Focus on the main points and hide unnecessary details to help the user quickly understand the content.

Content to outline:
\`\`\`
${params.content}
\`\`\`

Generate bullet points that represent the most important ideas from this content. Make each bullet point concise and clear.

Respond in this JSON format:
{
  "outline": [
    {
      "bulletPoint": "string"
    }
  ]
}
        `.trim();

        const responseStream = await openai.responses.create({
          model: "gpt-5-mini",
          input: prompt,
          text: { format: { type: "json_object" }, verbosity: "low" },
          reasoning: { effort: "minimal" },
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
