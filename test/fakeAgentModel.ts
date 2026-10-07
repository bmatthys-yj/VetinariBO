import type { CreateVetinariAgentOptions } from "@quinus-yj/vetinari-runtime";

type AgentModel = NonNullable<CreateVetinariAgentOptions["model"]>;
export type FakeModelReply = { readonly type: "text"; readonly text: string } | Error;
export interface FakeModelRequest {
  readonly prompt: unknown;
  readonly abortSignal?: AbortSignal;
}

/** A deterministic AI SDK v2 model for native workflow agent steps. */
export function fakeAgentModel(
  reply:
    | FakeModelReply
    | readonly FakeModelReply[]
    | ((call: number, request: FakeModelRequest) => FakeModelReply | Promise<FakeModelReply>),
) {
  const requests: FakeModelRequest[] = [];
  async function answer(options: FakeModelRequest) {
    requests.push(options);
    const next = await (typeof reply === "function"
      ? reply(requests.length - 1, options)
      : Array.isArray(reply)
        ? reply[requests.length - 1]
        : reply);
    if (!next) throw new Error("Unexpected model call.");
    if (next instanceof Error) throw next;
    return next.text;
  }
  const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
  const model = {
    specificationVersion: "v2",
    provider: "test",
    modelId: "test-model",
    supportedUrls: {},
    doGenerate: async (options: FakeModelRequest) => ({
      content: [{ type: "text" as const, text: await answer(options) }],
      finishReason: "stop" as const,
      usage,
      warnings: [],
    }),
    doStream: async (options: FakeModelRequest) => {
      const text = await answer(options);
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            controller.enqueue({ type: "text-start", id: "text" });
            controller.enqueue({ type: "text-delta", id: "text", delta: text });
            controller.enqueue({ type: "text-end", id: "text" });
            controller.enqueue({ type: "finish", finishReason: "stop", usage });
            controller.close();
          },
        }),
      };
    },
  } satisfies Partial<AgentModel>;
  return { model: model as AgentModel, requests };
}
