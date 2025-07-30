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

export interface Mockup {
  name: string;
  description: string;
}

export interface StreamMockupsParams {
  designs: Design[];
  domain: string;
  existingMockups: string[];
  rejectedMockups: string[];
  apiKey: string;
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

export function streamMockups$(params: StreamMockupsParams): Observable<Mockup> {
  return new Observable<Mockup>((subscriber) => {
    const openai = new OpenAI({
      dangerouslyAllowBrowser: true,
      apiKey: params.apiKey,
    });

    const parser = new JSONParser();

    // Wire up parser event to emit mockups
    parser.onValue = (entry) => {
      // Check if this is an array item under the "mockups" key
      if (typeof entry.key === "number" && entry.parent && entry.value && typeof entry.value === "object") {
        const mockup = entry.value as unknown as Mockup;
        if (mockup.name && mockup.description) {
          subscriber.next(mockup);
        }
      }
    };

    // Call OpenAI responses API in structured mode, streaming output
    (async () => {
      try {
        const designsList = params.designs
          .map((d) => {
            const assignments = Object.entries(d.parameterAssignments)
              .map(([key, value]) => `  - ${key}: ${value}`)
              .join("\n");
            return `**${d.name}**\n${assignments}`;
          })
          .join("\n\n");

        const existingList =
          params.existingMockups.length > 0
            ? `\n\nExisting mockups (avoid repetition):\n${params.existingMockups.map((m) => `- ${m}`).join("\n")}`
            : "";

        const rejectedList =
          params.rejectedMockups.length > 0
            ? `\n\nRejected mockups (do not suggest these):\n${params.rejectedMockups.map((m) => `- ${m}`).join("\n")}`
            : "";

        const isIncremental = params.existingMockups.length > 0;
        const count = isIncremental ? 2 : 3;

        const prompt = `
Generate product design renderings for ${params.domain} based on these design specifications:

\`\`\`designs
${designsList}
\`\`\`${existingList}${rejectedList}

Generate ${count} different views or aspects of the same unified ${params.domain} product that incorporates all the design specifications above. Each rendering should showcase different details, usage contexts, or configurations of the same product design. The renderings should be complementary views that together tell the complete story of the product.

Mockup name should be the name of the view or aspect being shown (e.g., "Front", "Interior", "Detail", "In Use", "Side", "Top", etc.).
Mockup description must be fully self-contained and descriptive enough to serve as an accessibility caption for blind people. It should explicitly describe what the product is, what view/aspect is being shown, all visible materials and colors, the setting/environment, lighting conditions, and any other visual details that would help someone understand exactly what they would see in the image. Include specific details from the parameter assignments and explain how they manifest visually in this ${params.domain} product.

Respond in this JSON format:
{
  "mockups": [
    {
      "name": "string",
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
