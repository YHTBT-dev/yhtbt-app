// Client-side compression for uploaded photos before they're stored — a
// typical modern phone photo can be 3-8MB. Downscaling to a reasonable
// on-screen size and re-encoding as JPEG shrinks that meaningfully
// without a visible quality hit, since nothing in this app displays a
// photo anywhere near its original resolution.
const MAX_DIMENSION_PX = 1200;
const JPEG_QUALITY = 0.8;

// Falls back to the original file as-is if canvas processing fails for
// any reason (e.g. a file type the browser can't decode as an <img>)
// rather than blocking the upload entirely — the caller gets back
// `original: true` so it can skip a Blob-only path (there's no
// re-encoded Blob to offer in that case, only the original File).
function getResizedCanvas(
  file: File
): Promise<{ canvas: HTMLCanvasElement; original: false } | { original: true }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
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
          resolve({ original: true });
          return;
        }

        ctx.drawImage(image, 0, 0, width, height);
        resolve({ canvas, original: false });
      };

      image.onerror = () => resolve({ original: true });
      image.src = reader.result as string;
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// Resolves with a compressed image as a base64 JPEG data URL. Only ever
// downscales (never upscales a smaller image). Used where the result is
// stored directly (e.g. still-localStorage-backed cover images).
export async function compressImageFile(file: File): Promise<string> {
  const result = await getResizedCanvas(file);

  if (result.original) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  return result.canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

// Same compression, but resolves with a Blob instead of a base64 string —
// for uploading directly to storage (e.g. Supabase) rather than saving
// the encoded string itself. Falls back to the original File (which is
// already a Blob) if canvas processing failed.
export async function compressImageToBlob(file: File): Promise<Blob> {
  const result = await getResizedCanvas(file);

  if (result.original) return file;

  return await new Promise<Blob>((resolve, reject) => {
    result.canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to encode image"));
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}
