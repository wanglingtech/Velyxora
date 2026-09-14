const PROVIDERS: Record<string, string[]> = {
  youtube: ['youtube.com', 'youtu.be'], tiktok: ['tiktok.com'], instagram: ['instagram.com'],
  facebook: ['facebook.com', 'fb.watch'], twitter: ['x.com', 'twitter.com'], vimeo: ['vimeo.com'],
  reddit: ['reddit.com', 'redd.it'], twitch: ['twitch.tv'], soundcloud: ['soundcloud.com'],
};
const matches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

export class ProviderPolicyService {
  resolve(rawUrl: string): string | null {
    let host: string;
    try { host = new URL(rawUrl).hostname.toLowerCase().replace(/\.$/, ''); } catch { return null; }
    for (const [provider, domains] of Object.entries(PROVIDERS)) if (domains.some((domain) => matches(host, domain))) return provider;
    return null;
  }
  assertAllowed(rawUrl: string): string {
    const provider = this.resolve(rawUrl);
    if (!provider) throw new Error('Este proveedor no está admitido actualmente.');
    return provider;
  }
  allowedProviders() { return Object.keys(PROVIDERS); }
}
export const providerPolicyService = new ProviderPolicyService();
