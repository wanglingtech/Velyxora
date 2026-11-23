import fs from "node:fs";
import path from "node:path";
import { directMediaProvider } from "./src/providers/DirectMediaProvider";

async function main() {
  const url = "https://picsum.photos/seed/velyxora/800/600";
  const analysis = await directMediaProvider.analyze(url);
  console.log("ANALYZE", JSON.stringify({
    title: analysis.title,
    platform: analysis.platform,
    contentType: analysis.contentType,
    format: analysis.formats[0],
  }));
  const format = analysis.formats[0];
  const stem = path.join(process.cwd(), "tmp-direct-media-check");
  const output = await directMediaProvider.download(url, format.formatId, format.extension, "image", stem);
  console.log("DOWNLOAD", JSON.stringify({ output, size: fs.statSync(output).size }));
  fs.unlinkSync(output);
}

main().catch((error) => { console.error("FAILED", error); process.exit(1); });
