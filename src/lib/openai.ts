import { from, Observable } from "rxjs";
import type { ApiKeys } from "./storage";

export interface TestConnectionRequest {
  provider: "openai" | "blackforest";
  testInput: string;
  apiKeys: ApiKeys;
}

export function testOpenAIConnection(apiKey: string, input: string): Observable<string> {
  const request = async (): Promise<string> => {
    const { default: OpenAI } = await import("openai");

    const openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: `${input} (Please just say "OpenAI test success!" in response)`,
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

export function testConnection({ provider, testInput, apiKeys }: TestConnectionRequest): Observable<string> {
  switch (provider) {
    case "openai":
      if (!apiKeys.openai) {
        throw new Error("OpenAI API key is not set");
      }
      return testOpenAIConnection(apiKeys.openai, testInput);

    case "blackforest":
      throw new Error("BlackForest API testing is not implemented yet");

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
