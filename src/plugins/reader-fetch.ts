import { registerPlugin } from '@capacitor/core';

export interface ReaderFetchPlugin {
  fetchHtml(options: { url: string; timeout?: number }): Promise<{ html?: string; error?: string }>;
}

const ReaderFetch = registerPlugin<ReaderFetchPlugin>('ReaderFetch');

export { ReaderFetch };
