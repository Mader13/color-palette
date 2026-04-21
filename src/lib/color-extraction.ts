interface RGB {
  r: number;
  g: number;
  b: number;
}

interface ColorSwatch {
  hex: string;
  rgb: RGB;
  percentage: number;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function getPixelData(imageData: ImageData): RGB[] {
  const pixels: RGB[] = [];
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    // Skip transparent and near-white/near-black pixels for better palette
    if (a < 128) continue;
    pixels.push({ r, g, b });
  }
  return pixels;
}

function getColorRange(pixels: RGB[]): { channel: keyof RGB; range: number } {
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;

  for (const pixel of pixels) {
    if (pixel.r < rMin) rMin = pixel.r;
    if (pixel.r > rMax) rMax = pixel.r;
    if (pixel.g < gMin) gMin = pixel.g;
    if (pixel.g > gMax) gMax = pixel.g;
    if (pixel.b < bMin) bMin = pixel.b;
    if (pixel.b > bMax) bMax = pixel.b;
  }

  const rRange = rMax - rMin;
  const gRange = gMax - gMin;
  const bRange = bMax - bMin;

  if (rRange >= gRange && rRange >= bRange) return { channel: 'r', range: rRange };
  if (gRange >= rRange && gRange >= bRange) return { channel: 'g', range: gRange };
  return { channel: 'b', range: bRange };
}

function medianCut(pixels: RGB[], depth: number): RGB[] {
  if (depth === 0 || pixels.length === 0) {
    // Return average color
    const avg: RGB = { r: 0, g: 0, b: 0 };
    for (const pixel of pixels) {
      avg.r += pixel.r;
      avg.g += pixel.g;
      avg.b += pixel.b;
    }
    const count = pixels.length || 1;
    return [{
      r: Math.round(avg.r / count),
      g: Math.round(avg.g / count),
      b: Math.round(avg.b / count),
    }];
  }

  const { channel } = getColorRange(pixels);
  const sorted = [...pixels].sort((a, b) => a[channel] - b[channel]);
  const mid = Math.floor(sorted.length / 2);

  return [
    ...medianCut(sorted.slice(0, mid), depth - 1),
    ...medianCut(sorted.slice(mid), depth - 1),
  ];
}

function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt(
    (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2
  );
}

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

interface QuantizedBucket extends RGB {
  count: number;
}

function mergeBucket(clusters: QuantizedBucket[], bucket: QuantizedBucket, threshold: number): void {
  let bestIndex = -1;
  let bestDistance = threshold;

  for (let i = 0; i < clusters.length; i++) {
    const dist = colorDistance(clusters[i], bucket);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestIndex = i;
    }
  }

  if (bestIndex === -1) {
    clusters.push({ ...bucket });
    return;
  }

  const cluster = clusters[bestIndex];
  const total = cluster.count + bucket.count;
  cluster.r = Math.round((cluster.r * cluster.count + bucket.r * bucket.count) / total);
  cluster.g = Math.round((cluster.g * cluster.count + bucket.g * bucket.count) / total);
  cluster.b = Math.round((cluster.b * cluster.count + bucket.b * bucket.count) / total);
  cluster.count = total;
}

export function estimatePaletteCapacity(imageData: ImageData): number {
  const data = imageData.data;
  const totalPixels = data.length / 4;
  const step = Math.max(1, Math.floor(totalPixels / 4000));
  const bucketSize = 24;
  const buckets = new Map<string, QuantizedBucket>();
  let sampled = 0;

  for (let p = 0; p < totalPixels; p += step) {
    const i = p * 4;
    if (data[i + 3] < 128) continue;

    sampled++;
    const r = Math.min(255, Math.round(data[i] / bucketSize) * bucketSize);
    const g = Math.min(255, Math.round(data[i + 1] / bucketSize) * bucketSize);
    const b = Math.min(255, Math.round(data[i + 2] / bucketSize) * bucketSize);
    const key = `${r}-${g}-${b}`;
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.count++;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  if (sampled === 0) return 1;

  const minCount = Math.max(4, Math.ceil(sampled * 0.005));
  const clusters: QuantizedBucket[] = [];
  const sortedBuckets = [...buckets.values()]
    .filter(bucket => bucket.count >= minCount)
    .sort((a, b) => b.count - a.count);

  for (const bucket of sortedBuckets) {
    mergeBucket(clusters, bucket, 28);
  }

  return Math.max(1, clusters.length);
}

export function extractPalette(imageData: ImageData, colorCount: number = 6): ColorSwatch[] {
  const pixels = getPixelData(imageData);
  
  if (pixels.length === 0) return [];

  // Calculate depth needed for desired color count (2^depth = colorCount)
  const depth = Math.ceil(Math.log2(colorCount));
  let colors = medianCut(pixels, depth);

  // Sort by luminance for a pleasing visual order
  colors.sort((a, b) => luminance(b.r, b.g, b.b) - luminance(a.r, a.g, a.b));

  // Remove very similar colors
  const filtered: RGB[] = [colors[0]];
  for (let i = 1; i < colors.length; i++) {
    const isSimilar = filtered.some(c => colorDistance(c, colors[i]) < 25);
    if (!isSimilar) {
      filtered.push(colors[i]);
    }
  }

  // If we lost too many, fill back from original
  for (const color of colors) {
    if (filtered.length >= colorCount) break;
    if (!filtered.some(c => colorDistance(c, color) < 15)) {
      filtered.push(color);
    }
  }

  // Trim to exact count
  const finalColors = filtered.slice(0, colorCount);

  // Calculate percentage by nearest-neighbor
  const totalPixels = pixels.length;
  const buckets = new Array(finalColors.length).fill(0);

  for (const pixel of pixels) {
    let minDist = Infinity;
    let minIdx = 0;
    for (let i = 0; i < finalColors.length; i++) {
      const dist = colorDistance(pixel, finalColors[i]);
      if (dist < minDist) {
        minDist = dist;
        minIdx = i;
      }
    }
    buckets[minIdx]++;
  }

  const result: ColorSwatch[] = finalColors.map((color, i) => ({
    hex: rgbToHex(color.r, color.g, color.b),
    rgb: color,
    percentage: Math.round((buckets[i] / totalPixels) * 100),
  }));

  // Sort by percentage descending
  result.sort((a, b) => b.percentage - a.percentage);

  return result;
}

export function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = luminance(r, g, b);
  return lum > 0.179 ? '#000000' : '#ffffff';
}
