import Anthropic from '@anthropic-ai/sdk';
import type Core from '@anthropic-ai/sdk/core';
import { fetch as undiciFetch, ProxyAgent, type RequestInit as UndiciRequestInit } from 'undici';

function maskProxyUrl(url: string): string {
  return url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
}

/** Anthropic SDK does not read HTTP_PROXY by itself — route fetch through undici ProxyAgent. */
export function createAnthropicClient(apiKey: string): Anthropic {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (!proxyUrl) {
    return new Anthropic({ apiKey });
  }

  const dispatcher = new ProxyAgent(proxyUrl);
  console.log(`Anthropic client via proxy: ${maskProxyUrl(proxyUrl)}`);

  const proxiedFetch: Core.Fetch = (url, init) =>
    undiciFetch(url as string | URL, {
      ...(init as UndiciRequestInit | undefined),
      dispatcher,
    }) as unknown as ReturnType<Core.Fetch>;

  return new Anthropic({
    apiKey,
    fetch: proxiedFetch,
  });
}
