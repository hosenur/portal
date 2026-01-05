import { useEffect } from "react";
import posthog from "posthog-js";

const POSTHOG_KEY = "phc_eKRAeR03ousQYjM1tyQpzMaiArfAOhxiKeAlwClv045";
const POSTHOG_HOST = "https://us.i.posthog.com";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: "identified_only",
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false,
      persistence: "localStorage",
      disable_session_recording: true,
      mask_all_text: true,
      mask_all_element_attributes: true,
    });

    return () => {
      posthog.reset();
    };
  }, []);

  return <>{children}</>;
}
