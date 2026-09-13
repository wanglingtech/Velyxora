import { TOOL_REGISTRY } from "../registry/tools";
import { DetectedFileInfo } from "../types";

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
};

export const formatDuration = (seconds: number): string => {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
};

const getExtension = (name: string): string => {
  const extension = name.split(".").pop();
  return extension && extension !== name ? extension.toLowerCase() : "";
};

const inspectDimensions = (
  file: File,
): Promise<Pick<DetectedFileInfo, "width" | "height" | "aspectRatio">> =>
  new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve({});
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
        aspectRatio: `${image.naturalWidth}:${image.naturalHeight}`,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    image.src = url;
  });

export const detectFile = async (file: File): Promise<DetectedFileInfo> => {
  const dimensions = await inspectDimensions(file);
  const matchingToolIds = TOOL_REGISTRY.filter((tool) =>
    tool.inputTypes.some((type) => type === file.type || type === "*/*"),
  ).map((tool) => tool.id);

  return {
    file,
    name: file.name,
    size: file.size,
    formattedSize: formatFileSize(file.size),
    mimeType: file.type || "application/octet-stream",
    extension: getExtension(file.name),
    previewUrl: file.type.startsWith("image/")
      ? URL.createObjectURL(file)
      : undefined,
    recommendedToolIds: matchingToolIds,
    ...dimensions,
  };
};
