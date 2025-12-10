/**
 * Hook for aggregating token usage data from session messages.
 *
 * Token data is stored per-message (on assistant messages) and needs
 * to be aggregated client-side since there's no dedicated API endpoint for this.
 */

export interface TokenUsage {
  input: number;
  output: number;
  reasoning: number;
  cache: {
    read: number;
    write: number;
  };
}

export interface SessionUsage {
  tokens: TokenUsage;
  totalTokens: number;
}

export interface MessageTokens {
  input?: number;
  output?: number;
  reasoning?: number;
  cache?: {
    read?: number;
    write?: number;
  };
}

export interface MessageWithUsage {
  info: {
    role: "user" | "assistant";
    tokens?: MessageTokens;
  };
}

/**
 * Aggregates token usage from an array of messages.
 * Only assistant messages contain usage data.
 */
export function aggregateSessionUsage(
  messages: MessageWithUsage[],
): SessionUsage {
  const usage: SessionUsage = {
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: {
        read: 0,
        write: 0,
      },
    },
    totalTokens: 0,
  };

  for (const message of messages) {
    if (message.info.role === "assistant" && message.info.tokens) {
      usage.tokens.input += message.info.tokens.input || 0;
      usage.tokens.output += message.info.tokens.output || 0;
      usage.tokens.reasoning += message.info.tokens.reasoning || 0;
      usage.tokens.cache.read += message.info.tokens.cache?.read || 0;
      usage.tokens.cache.write += message.info.tokens.cache?.write || 0;
    }
  }

  usage.totalTokens =
    usage.tokens.input + usage.tokens.output + usage.tokens.reasoning;

  return usage;
}
