import { Providers } from "@/providers";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { NuqsAdapter } from "nuqs/adapters/next/pages";
import { Toast } from "@/components/ui/toast";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Providers>
      <NuqsAdapter>
        <Component {...pageProps} />
        <Toast />
      </NuqsAdapter>
    </Providers>
  );
}
