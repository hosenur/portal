import { defineHandler } from "nitro/h3";
import { getCodexClient } from "../../lib/codex-client";
import { parsePort } from "../../lib/validation";

interface CodexModel {
  id: string;
  displayName?: string;
  model?: string;
  isDefault?: boolean;
  defaultReasoningEffort?: string;
  supportedReasoningEfforts?: Array<{
    reasoningEffort?: string;
    description?: string;
  }>;
}

interface ModelListResponse {
  data?: CodexModel[];
}

function reasoningVariants(model: CodexModel) {
  const defaultEffort = model.defaultReasoningEffort;

  return Object.fromEntries(
    (model.supportedReasoningEfforts ?? [])
      .map((option) => option.reasoningEffort)
      .filter(
        (effort): effort is string =>
          !!effort && (!defaultEffort || effort !== defaultEffort),
      )
      .map((effort) => [effort, { effort }]),
  );
}

export default defineHandler(async (event) => {
  const port = parsePort(event);
  const client = getCodexClient(port);
  const response = await client.request<ModelListResponse>("model/list", {
    limit: 100,
    includeHidden: false,
  });
  const models = response.data ?? [];
  const defaultModel =
    models.find((model) => model.isDefault)?.id ?? models[0]?.id;

  return {
    providers: [
      {
        id: "openai",
        name: "OpenAI",
        models: Object.fromEntries(
          models.map((model) => [
            model.id,
            {
              id: model.id,
              name: model.displayName || model.model || model.id,
              providerID: "openai",
              variants: reasoningVariants(model),
            },
          ]),
        ),
      },
    ],
    default: defaultModel ? { openai: defaultModel } : {},
  };
});
