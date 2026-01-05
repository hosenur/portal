import { ImageResponse } from "@takumi-rs/image-response";

function SimpleTemplate({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      tw="flex flex-col w-full h-full bg-zinc-950 text-white p-16"
      style={{ fontFamily: "Geist" }}
    >
      <div tw="flex flex-col flex-1 justify-center relative">
        <div tw="flex items-center mb-8">
          <div
            tw="flex items-center justify-center w-16 h-16 rounded-2xl mr-4"
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
          >
            <span tw="text-3xl">🚀</span>
          </div>
          <span tw="text-2xl font-medium text-zinc-400">OpenCode Portal</span>
        </div>

        <h1 tw="text-6xl font-bold leading-tight mb-6">{title}</h1>

        <p tw="text-2xl text-zinc-400 leading-relaxed max-w-4xl">
          {description}
        </p>
      </div>

      <div tw="flex items-center justify-between text-zinc-500 text-lg">
        <span>openportal.space</span>
        <span>docs</span>
      </div>
    </div>
  );
}

function ReleaseTemplate({
  version,
  features,
}: {
  version: string;
  features: string[];
}) {
  return (
    <div
      tw="flex flex-col w-full h-full bg-zinc-950 text-white p-16"
      style={{ fontFamily: "Geist" }}
    >
      <div tw="flex flex-col flex-1 justify-center relative">
        <div tw="flex items-center mb-6">
          <div
            tw="flex items-center justify-center w-14 h-14 rounded-xl mr-4"
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
          >
            <span tw="text-2xl">🚀</span>
          </div>
          <span tw="text-xl font-medium text-zinc-400">OpenCode Portal</span>
        </div>

        <div tw="flex items-center mb-6">
          <span
            tw="px-4 py-2 rounded-full text-lg font-medium"
            style={{
              backgroundColor: "rgba(34, 197, 94, 0.2)",
              color: "#4ade80",
            }}
          >
            New Release
          </span>
        </div>

        <h1 tw="text-7xl font-bold mb-8">{version}</h1>

        <div tw="flex flex-col">
          {features.slice(0, 4).map((feature) => (
            <div
              key={feature}
              tw="flex items-center text-xl text-zinc-300 mb-3"
            >
              <span tw="mr-3" style={{ color: "#4ade80" }}>
                ✓
              </span>
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </div>

      <div tw="flex items-center justify-between text-zinc-500 text-lg">
        <span>openportal.space</span>
        <span>releases</span>
      </div>
    </div>
  );
}

interface LoaderArgs {
  request: Request;
}

export async function loader({ request }: LoaderArgs) {
  const url = new URL(request.url);
  const template = url.searchParams.get("template") || "simple";

  if (template === "release") {
    const version = url.searchParams.get("version") || "v1.0.0";
    const featuresParam = url.searchParams.get("features") || "";
    const features = featuresParam
      ? featuresParam.split(",").map((f) => f.trim())
      : ["New feature one", "New feature two", "New feature three"];

    return new ImageResponse(
      <ReleaseTemplate version={version} features={features} />,
      {
        width: 1200,
        height: 630,
        format: "webp",
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      },
    );
  }

  const title = url.searchParams.get("title") || "OpenCode Portal";
  const description =
    url.searchParams.get("description") ||
    "The modern developer portal for OpenCode - a mobile-first web UI with isolated workspaces and quick git integration.";

  return new ImageResponse(
    <SimpleTemplate title={title} description={description} />,
    {
      width: 1200,
      height: 630,
      format: "webp",
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
