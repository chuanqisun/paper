import OpenAI from "openai";
import { Observable } from "rxjs";

export function getCaption(src: string, apiKey: string): Observable<string> {
  return new Observable<string>((subscriber) => {
    const abortController = new AbortController();
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    openai.responses
      .create(
        {
          model: "gpt-5-mini",
          reasoning: {
            effort: "minimal",
          },
          text: {
            verbosity: "low",
          },
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: "Describe this image in a short caption." },
                { type: "input_image", image_url: src, detail: "auto" },
              ],
            },
          ],
        },
        {
          signal: abortController.signal,
        },
      )
      .then((response) => {
        const caption = response.output
          .find((item) => item.type === "message")
          ?.content.find((item) => item.type === "output_text")?.text;
        if (caption) {
          subscriber.next(caption);
        }
        subscriber.complete();
      })
      .catch((error) => {
        console.error("Failed to generate caption:", error);
        subscriber.complete();
      });

    return () => {
      abortController.abort();
    };
  });
}
