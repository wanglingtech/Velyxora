import { IMediaProvider } from "./MediaProvider";
import { YtDlpProvider } from "./YtDlpProvider";
import { YouTubeProvider } from "./YouTubeProvider";

const domain = (name: string) => new RegExp(`(^|\\.)${name.replace(".", "\\.")}$`, "i");

export class ProviderRegistry {
  readonly providers: IMediaProvider[] = [
    new YouTubeProvider(),
    new YtDlpProvider("tiktok", "TikTok", [domain("tiktok.com")]),
    new YtDlpProvider("instagram", "Instagram", [domain("instagram.com")]),
    new YtDlpProvider("facebook", "Facebook", [domain("facebook.com"), domain("fb.watch")]),
    new YtDlpProvider("twitter", "X / Twitter", [domain("x.com"), domain("twitter.com")]),
    new YtDlpProvider("vimeo", "Vimeo", [domain("vimeo.com")]),
    new YtDlpProvider("reddit", "Reddit", [domain("reddit.com"), domain("redd.it")]),
    new YtDlpProvider("twitch", "Twitch", [domain("twitch.tv")]),
    new YtDlpProvider("soundcloud", "SoundCloud", [domain("soundcloud.com")]),
  ];
  readonly generic = new YtDlpProvider("generic", "Proveedor compatible", [/.*/]);
  find(url: string): IMediaProvider { return this.providers.find((provider) => provider.canHandle(url)) || this.generic; }
}

export const providerRegistry = new ProviderRegistry();
