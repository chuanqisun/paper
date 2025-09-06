import { JSONParser } from "@streamparser/json";
import { OpenAI } from "openai";
import { Observable } from "rxjs";

export interface GenerateOutlineParams {
  apiKey: string;
  content: string;
  parent?: OutlineItem;
}

export interface OutlineItem {
  id: string;
  bulletPoint: string;
  children: OutlineItem[];
  citations: string[];
  citationIds?: string[];
  isExpanded: boolean;
  isExpanding?: boolean;
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
        const outlineItem = entry.value as unknown as { bulletPoint: string; citations: string[] };
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
        const parentContext = params.parent
          ? `
The user is focusing on the following bullet point:
- ${params.parent.bulletPoint}

Please only generate relevant sub-bullet points that explains, expands, contrasts, contextualizes the point. If none available, respond empty array.
          `.trim()
          : "";

        const prompt = `
${
  params.parent
    ? "Generate a list of detailed sub-bullet points for the given context."
    : "Distill the following content into a list of high-level bullet points."
} Each bullet point should be one short sentence that captures a key idea or concept. Focus on the main points and hide unnecessary details to help the user quickly understand the content. Each bullet point must cite at least one piece of text from the source document.

Content to outline:
\`\`\`
${params.content}
\`\`\`

Generate bullet points that represent the most important ideas from this content. Make each bullet point concise and clear. For each bullet point, provide citations from the original content that support it. The citation text must be an identical substring from the original document. Do NOT paraphrase or fix typos or punctuation. The original text must be preserved exactly in the citation.
${parentContext}

Respond in this JSON format:
{
  "outline": [
    {
      "bulletPoint": "string",
      "citations": ["string"]
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
