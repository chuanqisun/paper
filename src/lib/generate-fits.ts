import { JSONParser } from "@streamparser/json";
import { OpenAI } from "openai";
import { Observable } from "rxjs";

export interface StreamDesignsParams {
  parti: string;
  domain: string;
  concepts: { name: string; description: string }[];
  artifacts: { name: string; description: string }[];
  parameters: { name: string; description: string }[];
  existingDesigns: string[];
  rejectedDesigns: string[];
  apiKey: string;
}

export interface Design {
  name: string;
  parameterAssignments: Record<string, string>;
}

export function streamDesigns$(params: StreamDesignsParams): Observable<Design> {
  return new Observable<Design>((subscriber) => {
    const openai = new OpenAI({
      dangerouslyAllowBrowser: true,
      apiKey: params.apiKey,
    });

    const parser = new JSONParser();

    // Wire up parser event to emit designs
    parser.onValue = (entry) => {
      // Check if this is an array item under the "designs" key
      if (typeof entry.key === "number" && entry.parent && entry.value && typeof entry.value === "object") {
        const design = entry.value as unknown as Design;
        if (design.name && design.parameterAssignments) {
          subscriber.next(design);
        }
      }
    };

    // Call OpenAI responses API in structured mode, streaming output
    (async () => {
      try {
        const conceptsList = params.concepts.map((c) => `- ${c.name}: ${c.description}`).join("\n");
        const artifactsList = params.artifacts.map((a) => `- ${a.name}: ${a.description}`).join("\n");
        const parametersList = params.parameters.map((p) => `- ${p.name}: ${p.description}`).join("\n");

        const existingList =
          params.existingDesigns.length > 0
            ? `\n\nExisting designs (avoid repetition):\n${params.existingDesigns.map((d) => `- ${d}`).join("\n")}`
            : "";

        const rejectedList =
          params.rejectedDesigns.length > 0
            ? `\n\nRejected designs (do not suggest these):\n${params.rejectedDesigns.map((d) => `- ${d}`).join("\n")}`
            : "";

        const isIncremental = params.existingDesigns.length > 0;
        const count = isIncremental ? 2 : 3;

        const prompt = `
Generate product design specifications for ${params.domain} based on this Parti, concepts, visual artifacts, and parameters:

\`\`\`parti
${params.parti}
\`\`\`

\`\`\`concepts
${conceptsList}
\`\`\`

\`\`\`artifacts
${artifactsList}
\`\`\`

\`\`\`parameters
${parametersList}
\`\`\`${existingList}${rejectedList}

Generate ${count} diverse design specifications for ${params.domain} that assign concrete values to the parameters. Each design should reflect cohesive design decisions that align with the Parti, concepts, and visual direction, specifically tailored for the ${params.domain} domain.

Design name should be descriptive but concise, capturing the key design direction for ${params.domain}.
Parameter assignments should map each parameter name to a specific value that reflects the design decisions suitable for ${params.domain}.

Respond in this JSON format:
{
  "designs": [
    {
      "name": "string",
      "parameterAssignments": {
        "parameter_name": "assigned_value"
      }
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
