// Profile photos. A chosen picture is cut to a centred square and shrunk before it is saved, so a large phone photo
// (several MB) becomes a few tens of KB and never fills the browser's storage.

/** Output side length in pixels (sharp for the 64 px profile picture and the ID card). */
const SIDE = 400;
/** Largest file accepted before shrinking. */
const MAX_MB = 10;

/**
 * Read an image file chosen by the user. Input: the file. Output: a square JPEG as a data: URL.
 * Throws an Error with a message to show the user when the file is not a usable picture.
 */
export async function readPhoto(file: File): Promise<string> {
  if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) throw new Error('415 Unsupported Media Type · Use a JPG, PNG or WebP picture.');
  if (file.size > MAX_MB * 1024 * 1024) throw new Error(`413 Content Too Large · Use a picture under ${MAX_MB} MB.`);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    // decode() fails for a damaged file or one that only claims to be a picture.
    await img.decode().catch(() => { throw new Error('That picture could not be opened. Try another one.'); });
    const cut = Math.min(img.naturalWidth, img.naturalHeight);
    const side = Math.min(SIDE, cut);
    const c = document.createElement('canvas'); c.width = side; c.height = side;
    const g = c.getContext('2d');
    if (!g) throw new Error('This browser could not prepare the picture.');
    g.fillStyle = '#fff'; g.fillRect(0, 0, side, side); // see-through PNGs get a white background
    g.drawImage(img, (img.naturalWidth - cut) / 2, (img.naturalHeight - cut) / 2, cut, cut, 0, 0, side, side);
    return c.toDataURL('image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}
