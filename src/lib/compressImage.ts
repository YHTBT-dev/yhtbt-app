// Client-side compression for uploaded photos before they're stored as
// base64 — a typical modern phone photo can be 3-8MB, and localStorage's
// per-origin quota (~5-10MB total, shared across every photo/cover image
// on every Experience) fills up fast otherwise. Downscaling to a
// reasonable on-screen size and re-encoding as JPEG shrinks that
// meaningfully without a visible quality hit, since nothing in this app
// displays a photo anywhere near its original resolution.
const MAX_DIMENSION_PX = 1200;
const JPEG_QUALITY = 0.8;

// Resolves with a compressed image as a base64 JPEG data URL. Only ever
// downscales (never upscales a smaller image), and falls back to reading
// the original file as-is if canvas processing fails for any reason
// (e.g. a file type the browser can't decode as an <img>) rather than
// blocking the upload entirely.
export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const originalDataUrl = reader.result as string;
      const image = new Image();

      image.onload = () => {
        const scale = Math.min(
          1,
          MAX_DIMENSION_PX / Math.max(image.naturalWidth, image.naturalHeight)
        );
        const width = Math.round(image.naturalWidth * scale);
        const height = Math.round(image.naturalHeight * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(originalDataUrl);
          return;
        }

        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };

      image.onerror = () => resolve(originalDataUrl);
      image.src = originalDataUrl;
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
