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

interface WeightedColor extends RGB {
  count: number;
}

interface ColorBucket extends WeightedColor {
  sumR: number;
  sumG: number;
  sumB: number;
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

    if (a < 128) continue;
    pixels.push({ r, g, b });
  }

  return pixels;
}

function samplePixels(imageData: ImageData, maxSamples: number = 5000): RGB[] {
  const pixels: RGB[] = [];
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  const stride = Math.max(1, Math.ceil(Math.sqrt(totalPixels / maxSamples)));

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a < 128) continue;

      pixels.push({
        r: data[i],
        g: data[i + 1],
        b: data[i + 2],
      });
    }
  }

  return pixels;
}

function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt(
    (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2,
  );
}

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function saturation({ r, g, b }: RGB): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === 0) return 0;
  return (max - min) / max;
}

function quantizeChannel(value: number, bucketSize: number): number {
  return Math.min(255, Math.round(value / bucketSize) * bucketSize);
}

function createBuckets(
  pixels: RGB[],
  bucketSize: number,
  minBucketShare = 0,
): WeightedColor[] {
  const histogram = new Map<string, ColorBucket>();
  const minBucketCount = Math.max(1, Math.ceil(pixels.length * minBucketShare));

  for (const pixel of pixels) {
    const r = quantizeChannel(pixel.r, bucketSize);
    const g = quantizeChannel(pixel.g, bucketSize);
    const b = quantizeChannel(pixel.b, bucketSize);
    const key = `${r}-${g}-${b}`;
    const bucket = histogram.get(key);

    if (bucket) {
      bucket.count++;
      bucket.sumR += pixel.r;
      bucket.sumG += pixel.g;
      bucket.sumB += pixel.b;
    } else {
      histogram.set(key, {
        r,
        g,
        b,
        count: 1,
        sumR: pixel.r,
        sumG: pixel.g,
        sumB: pixel.b,
      });
    }
  }

  return [...histogram.values()]
    .filter(bucket => bucket.count >= minBucketCount)
    .map(bucket => ({
      r: Math.round(bucket.sumR / bucket.count),
      g: Math.round(bucket.sumG / bucket.count),
      b: Math.round(bucket.sumB / bucket.count),
      count: bucket.count,
    }))
    .sort((a, b) => b.count - a.count);
}

function shouldMergeColors(a: RGB, b: RGB): boolean {
  const satAvg = (saturation(a) + saturation(b)) / 2;
  const dist = colorDistance(a, b);
  const lumDiff = Math.abs(luminance(a.r, a.g, a.b) - luminance(b.r, b.g, b.b)) * 255;

  const maxDistance = satAvg < 0.12 ? 18 : satAvg < 0.35 ? 24 : 30;
  const maxLuminanceDiff = satAvg < 0.12 ? 18 : 28;

  return dist <= maxDistance && lumDiff <= maxLuminanceDiff;
}

function mergeIntoClusters(clusters: WeightedColor[], color: WeightedColor): void {
  let bestIndex = -1;
  let bestDistance = Infinity;

  for (let i = 0; i < clusters.length; i++) {
    if (!shouldMergeColors(clusters[i], color)) continue;

    const dist = colorDistance(clusters[i], color);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestIndex = i;
    }
  }

  if (bestIndex === -1) {
    clusters.push({ ...color });
    return;
  }

  const cluster = clusters[bestIndex];
  const total = cluster.count + color.count;
  cluster.r = Math.round((cluster.r * cluster.count + color.r * color.count) / total);
  cluster.g = Math.round((cluster.g * cluster.count + color.g * color.count) / total);
  cluster.b = Math.round((cluster.b * cluster.count + color.b * color.count) / total);
  cluster.count = total;
}

function getDominantClusters(pixels: RGB[]): WeightedColor[] {
  if (pixels.length === 0) return [];

  const buckets = createBuckets(pixels, 18, 0.0015);
  const clusters: WeightedColor[] = [];

  for (const bucket of buckets) {
    mergeIntoClusters(clusters, bucket);
  }

  return clusters
    .filter(cluster => cluster.count / pixels.length >= 0.002)
    .sort((a, b) => b.count - a.count);
}

export function estimatePaletteCapacity(imageData: ImageData): number {
  const sampledPixels = samplePixels(imageData);
  if (sampledPixels.length === 0) return 1;

  const dominantClusters = getDominantClusters(sampledPixels);
  if (dominantClusters.length <= 1) {
    return dominantClusters.length || 1;
  }

  const total = dominantClusters.reduce((sum, cluster) => sum + cluster.count, 0);
  const shares = dominantClusters.map(cluster => cluster.count / total);

  const entropy = shares.reduce((sum, share) => {
    return share > 0 ? sum - share * Math.log(share) : sum;
  }, 0);

  let effectiveCount = Math.ceil(Math.exp(entropy));

  if (effectiveCount === 1 && shares[1] >= 0.05) {
    effectiveCount = 2;
  }

  return Math.max(1, Math.min(dominantClusters.length, effectiveCount));
}

function nearestColorIndex(color: RGB, palette: RGB[]): number {
  let minDist = Infinity;
  let minIdx = 0;

  for (let i = 0; i < palette.length; i++) {
    const dist = colorDistance(color, palette[i]);
    if (dist < minDist) {
      minDist = dist;
      minIdx = i;
    }
  }

  return minIdx;
}

function pickInitialCenters(buckets: WeightedColor[], colorCount: number): RGB[] {
  const centers: RGB[] = [];
  const sortedByCount = [...buckets].sort((a, b) => b.count - a.count);

  if (sortedByCount.length === 0) return centers;
  centers.push(sortedByCount[0]);

  while (centers.length < colorCount && centers.length < buckets.length) {
    let bestBucket: WeightedColor | null = null;
    let bestScore = -Infinity;

    for (const bucket of buckets) {
      if (centers.some(center => colorDistance(center, bucket) < 18)) continue;

      const nearestDistance = Math.min(...centers.map(center => colorDistance(center, bucket)));
      const vividness = 0.65 + saturation(bucket) * 1.35;
      const score = nearestDistance * vividness * Math.sqrt(bucket.count);

      if (score > bestScore) {
        bestScore = score;
        bestBucket = bucket;
      }
    }

    if (!bestBucket) break;
    centers.push({ r: bestBucket.r, g: bestBucket.g, b: bestBucket.b });
  }

  return centers;
}

function refineCenters(buckets: WeightedColor[], centers: RGB[], iterations = 8): RGB[] {
  let currentCenters = centers;

  for (let iteration = 0; iteration < iterations; iteration++) {
    const sums = currentCenters.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));

    for (const bucket of buckets) {
      const index = nearestColorIndex(bucket, currentCenters);
      sums[index].r += bucket.r * bucket.count;
      sums[index].g += bucket.g * bucket.count;
      sums[index].b += bucket.b * bucket.count;
      sums[index].count += bucket.count;
    }

    currentCenters = currentCenters.map((center, i) => {
      const sum = sums[i];
      if (sum.count === 0) return center;

      return {
        r: Math.round(sum.r / sum.count),
        g: Math.round(sum.g / sum.count),
        b: Math.round(sum.b / sum.count),
      };
    });
  }

  return currentCenters;
}

function fillMissingColors(colors: RGB[], buckets: WeightedColor[], colorCount: number): RGB[] {
  const result = [...colors];

  for (const bucket of buckets) {
    if (result.length >= colorCount) break;
    if (result.some(color => colorDistance(color, bucket) < 18)) continue;
    result.push({ r: bucket.r, g: bucket.g, b: bucket.b });
  }

  return result;
}

export function extractPalette(imageData: ImageData, colorCount: number = 6): ColorSwatch[] {
  const pixels = getPixelData(imageData);

  if (pixels.length === 0) return [];

  const colorBuckets = createBuckets(pixels, 12, 0.0005);
  const initialCenters = pickInitialCenters(colorBuckets, colorCount);
  const refinedCenters = refineCenters(colorBuckets, initialCenters);
  const finalColors = fillMissingColors(refinedCenters, colorBuckets, colorCount).slice(0, colorCount);
  const totalPixels = pixels.length;
  const pixelCounts = new Array(finalColors.length).fill(0);

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

    pixelCounts[minIdx]++;
  }

  const result: ColorSwatch[] = finalColors.map((color, i) => ({
    hex: rgbToHex(color.r, color.g, color.b),
    rgb: color,
    percentage: Math.round((pixelCounts[i] / totalPixels) * 100),
  }));

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
