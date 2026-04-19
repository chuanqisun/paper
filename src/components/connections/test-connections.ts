import OpenAI from "openai";
import { from, Observable } from "rxjs";
import type { ApiKeys } from "./storage";

export interface TestConnectionRequest {
  provider: "openai";
  apiKeys: ApiKeys;
}

export function testOpenAIConnection(apiKey: string): Observable<string> {
  const request = async (): Promise<string> => {
    const openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    const response = await openai.responses.create({
      model: "gpt-5.4-nano",
      input: "Please respond with exactly 'OpenAI test success!'",
      max_output_tokens: 32,
      reasoning: { effort: "none" },
      text: { verbosity: "low" },
    });

    if (response.output && response.output.length > 0) {
      const content = response.output
        .find((item) => item.type === "message")
        ?.content.find((item) => item.type === "output_text");
      if (!content) return "error";
      return content.text;
    }

    return "No response received from OpenAI";
  };

  return from(request());
}

export function testConnection({ provider, apiKeys }: TestConnectionRequest): Observable<string> {
  switch (provider) {
    case "openai":
      if (!apiKeys.openai) {
        throw new Error("OpenAI API key is not set");
      }
      return testOpenAIConnection(apiKeys.openai);

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
