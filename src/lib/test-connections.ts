import { from, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { generateImage, type FluxConnection, type GenerateImageOptions } from "./generate-image";
import type { ApiKeys } from "./storage";

export interface TestConnectionRequest {
  provider: "openai" | "together";
  apiKeys: ApiKeys;
}

export function testOpenAIConnection(apiKey: string): Observable<string> {
  const request = async (): Promise<string> => {
    const { default: OpenAI } = await import("openai");

    const openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: "Please respond with exactly 'OpenAI test success!'",
      max_output_tokens: 16,
    });

    if (response.output && response.output.length > 0) {
      const firstMessage = response.output[0];
      if (firstMessage.type === "message" && firstMessage.content && firstMessage.content.length > 0) {
        const content = firstMessage.content[0];
        if (content.type === "output_text") {
          return content.text;
        }
      }
    }

    return "No response received from OpenAI";
  };

  return from(request());
}

export function testTogetherConnection(apiKey: string): Observable<string> {
  const connection: FluxConnection = { apiKey };
  const options: GenerateImageOptions = {
    prompt: "A green checkmark",
    width: 400,
    height: 400,
    model: "black-forest-labs/FLUX.1-schnell-Free",
  };

  return generateImage(connection, options).pipe(map((result) => result.url));
}

export function testConnection({ provider, apiKeys }: TestConnectionRequest): Observable<string> {
  switch (provider) {
    case "openai":
      if (!apiKeys.openai) {
        throw new Error("OpenAI API key is not set");
      }
      return testOpenAIConnection(apiKeys.openai);

    case "together":
      if (!apiKeys.together) {
        throw new Error("Together.ai API key is not set");
      }
      return testTogetherConnection(apiKeys.together);

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
