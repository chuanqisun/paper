import { GoogleGenAI, Type, type Content, type GenerateContentConfig } from "@google/genai";
import { JSONParser } from "@streamparser/json";
import { Observable } from "rxjs";

export interface GenerateOutlineParams {
  apiKey: string;
  content: string;
  parent?: OutlineItem;
  fullOutline?: OutlineItem[];
}

export interface OutlineItem {
  id: string;
  bulletPoint: string;
  children: OutlineItem[];
  citations: string[];
  citationIds?: string[];
  isExpanded: boolean;
  isExpanding?: boolean;
  source: "generation" | "question";
}

// Helper function to build the full ancestral context
function buildParentContext(outline: OutlineItem[], targetItem: OutlineItem): string {
  if (!targetItem || !outline) return "";

  const ancestors: OutlineItem[] = [];

  function findAncestors(items: OutlineItem[], target: OutlineItem, currentPath: OutlineItem[]): boolean {
    for (const item of items) {
      const newPath = [...currentPath, item];

      if (item.id === target.id) {
        ancestors.push(...currentPath);
        return true;
      }

      if (item.children && item.children.length > 0) {
        if (findAncestors(item.children, target, newPath)) {
          return true;
        }
      }
    }
    return false;
  }

  findAncestors(outline, targetItem, []);

  if (ancestors.length === 0) {
    return `
The user is focusing on the following bullet point:
- ${targetItem.bulletPoint}

Please only generate relevant points that explains, expands, contrasts, contextualizes the point. If none available, respond empty array.
    `.trim();
  }

  // Build indented context with all ancestors
  const contextLines =
    targetItem.source === "question"
      ? ["The user is asking a question in the following context:"]
      : ["The user is focusing on the following context:"];
  ancestors.forEach((ancestor, index) => {
    const indent = "  ".repeat(index);
    contextLines.push(`${indent}- ${ancestor.bulletPoint}`);
  });
  contextLines.push(`${"  ".repeat(ancestors.length)}- ${targetItem.bulletPoint}`);
  contextLines.push("");
  contextLines.push(
    "Please only generate relevant points that explains, expands, contrasts, contextualizes the deepest point. If none available, respond empty array.",
  );

  return contextLines.join("\n").trim();
}

export function generateOutline$(params: GenerateOutlineParams): Observable<OutlineItem> {
  return new Observable<OutlineItem>((subscriber) => {
    const ai = new GoogleGenAI({
      apiKey: params.apiKey,
    });

    const parser = new JSONParser();

    // Wire up parser event to emit outline items
    parser.onValue = (entry) => {
      console.log(entry);
      // Check if this is an array item
      if (typeof entry.key === "number" && entry.value && typeof entry.value === "object") {
        const outlineItem = entry.value as unknown as { bulletPoint: string; sources: string[] };
        if (outlineItem.bulletPoint) {
          subscriber.next({
            ...outlineItem,
            id: crypto.randomUUID(),
            children: [],
            citations: outlineItem.sources,
            isExpanded: false,
            source: "generation",
          } satisfies OutlineItem);
        }
      }
    };

    // Call Gemini API in structured mode, streaming output
    (async () => {
      try {
        const parentContext = params.parent ? buildParentContext(params.fullOutline ?? [], params.parent) : "";

        const developerPrompt = `
Help user outline the following content:

\`\`\`
${params.content.trim()}
\`\`\`       
        `.trim();

        const userPrompt = `${
          params.parent && params.parent.source === "question"
            ? `Help me answer the question "${params.parent.bulletPoint}". Generate a list of bullet points that directly answer this question.`
            : params.parent
              ? `Expand on "${params.parent.bulletPoint}". Generate a list of bullet points that directly address this point.`
              : "Distill the following content into a list of high-level bullet points."
        } Each bullet point should be one short sentence that captures a key idea or concept. Focus on the main points and hide unnecessary details to help the user quickly understand the content. Each bullet point must cite at least one piece of text from the source document.

Gather relevant sources across the content before you distill them to bullet points.
Source text must be an identical substring from the original document. Do NOT paraphrase or fix typos or punctuation. The original text must be preserved exactly in the source.
Compress sources into short bullet points that represent the most important ideas from this content:

\`\`\`
${parentContext}
\`\`\`

Respond outline items in this JSON array format:
[
  {
    sources: string[],
    bulletPoint: string
  }
]
        `.trim();

        const responseSchema = {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            required: ["sources", "bulletPoint"],
            properties: {
              sources: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              bulletPoint: { type: Type.STRING },
            },
          },
        };

        const config: GenerateContentConfig = {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        };

        const model = "gemini-2.5-flash";

        const contents = [
          {
            role: "model",
            parts: [
              {
                text: developerPrompt,
              },
            ],
          } satisfies Content,
          {
            role: "user",
            parts: [
              {
                text: userPrompt,
              },
            ],
          },
        ];

        const response = await ai.models.generateContentStream({
          model,
          config,
          contents,
        });

        for await (const chunk of response) {
          if (chunk.text) {
            parser.write(chunk.text);
          }

          if (chunk.usageMetadata) {
            console.log(chunk.usageMetadata);
          }
        }

        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();
  });
}
