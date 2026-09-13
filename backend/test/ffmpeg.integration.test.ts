import test from "node:test";
import { serverFFmpegEngine } from "../src/engines/ServerFFmpegEngine";
import { isFfprobeAvailable } from "../src/utils/mediaProbe";

test("FFmpeg integration prerequisites", async (context) => {
  const ffmpegInstalled = await serverFFmpegEngine.isAvailable();
  const ffprobeInstalled = await isFfprobeAvailable();
  console.log(`FFmpeg installed: ${ffmpegInstalled ? "yes" : "no"}`);
  console.log(`FFprobe installed: ${ffprobeInstalled ? "yes" : "no"}`);
  console.log("Integration tests executed: 0");
  console.log("Passed: 0");
  console.log(`Skipped: ${ffmpegInstalled && ffprobeInstalled ? 0 : 1}`);
  console.log("Failed: 0");
  if (!ffmpegInstalled || !ffprobeInstalled) {
    context.skip("FFmpeg and FFprobe are required for conversion fixtures.");
  }
});
