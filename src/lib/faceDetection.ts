/**
 * Client-side face detection using face-api.js
 * Provides accurate facial landmark detection with the 68-point model.
 * Runs entirely in the browser — no API calls needed.
 *
 * IMPORTANT coordinate contract:
 *   - boundingBox + every landmark are expressed as PERCENTAGES of the
 *     ORIGINAL image's intrinsic dimensions (x = % of width, y = % of height).
 *   - imageWidth / imageHeight (pixels) are returned so consumers can:
 *       a) size the display container to the real image aspect ratio
 *          (so overlays line up 1:1 with no object-cover cropping), and
 *       b) convert % coords back to an aspect-correct space for geometry
 *          (angles/ratios are wrong if you treat x% and y% as equal units).
 */

import * as faceapi from 'face-api.js';

export interface Point {
  x: number; // % of image width
  y: number; // % of image height
}

export interface FaceDetectionResult {
  detected: boolean;
  confidence: number;
  /** intrinsic pixel size of the analysed image */
  imageWidth: number;
  imageHeight: number;
  boundingBox: {
    x: number; // % of image width
    y: number; // % of image height
    width: number; // % of image width
    height: number; // % of image height
  };
  landmarks: {
    foreheadCenter: Point;
    leftEye: Point;
    rightEye: Point;
    noseTip: Point;
    leftCheek: Point;
    rightCheek: Point;
    mouthCenter: Point;
    chinBottom: Point;
    leftJaw: Point;
    rightJaw: Point;
  };
  /** all 68 landmark points in % space — powers the geometry engine */
  points: Point[];
}

/**
 * Honest fallback used when NO face can be found. `detected` is false so the
 * UI can prompt the user instead of silently drawing zones in the wrong place.
 * Coordinates are a neutral centered guess only used for non-critical layout.
 */
function makeUndetected(imageWidth = 0, imageHeight = 0): FaceDetectionResult {
  return {
    detected: false,
    confidence: 0,
    imageWidth,
    imageHeight,
    boundingBox: { x: 25, y: 8, width: 50, height: 80 },
    landmarks: {
      foreheadCenter: { x: 50, y: 18 },
      leftEye: { x: 38, y: 33 },
      rightEye: { x: 62, y: 33 },
      noseTip: { x: 50, y: 48 },
      leftCheek: { x: 32, y: 50 },
      rightCheek: { x: 68, y: 50 },
      mouthCenter: { x: 50, y: 63 },
      chinBottom: { x: 50, y: 80 },
      leftJaw: { x: 26, y: 64 },
      rightJaw: { x: 74, y: 64 },
    },
    points: [],
  };
}

let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

/** Load face-api.js models (only once, cached after that) */
export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelsLoading) return modelsLoading;

  modelsLoading = (async () => {
    try {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
      console.log('[FaceAPI] Models loaded successfully');
    } catch (err) {
      console.error('[FaceAPI] Failed to load models:', err);
      modelsLoading = null; // allow a retry on next call
      throw err;
    }
  })();

  return modelsLoading;
}

/**
 * Run detection at several input sizes / thresholds and keep the best result.
 * Tiny detector is fast but resolution-sensitive; sweeping a few sizes makes
 * detection far more reliable across close-ups, wide shots and odd aspect ratios.
 */
async function bestDetection(img: HTMLImageElement) {
  const attempts: Array<{ inputSize: number; scoreThreshold: number }> = [
    { inputSize: 416, scoreThreshold: 0.3 },
    { inputSize: 512, scoreThreshold: 0.25 },
    { inputSize: 320, scoreThreshold: 0.2 },
    { inputSize: 608, scoreThreshold: 0.15 },
  ];

  let best: Awaited<ReturnType<typeof detectOnce>> | null = null;
  for (const opt of attempts) {
    const det = await detectOnce(img, opt);
    if (det && (!best || det.detection.score > best.detection.score)) {
      best = det;
      // Strong, confident hit — stop early.
      if (det.detection.score > 0.7) break;
    }
  }
  return best;
}

function detectOnce(
  img: HTMLImageElement,
  opt: { inputSize: number; scoreThreshold: number }
) {
  return faceapi
    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions(opt))
    .withFaceLandmarks();
}

/**
 * Detect face and landmarks from an image data URL.
 * Returns a FaceDetectionResult; `detected` is false (not fabricated) on miss.
 */
export async function detectFace(imageDataUrl: string): Promise<FaceDetectionResult> {
  let imgWidth = 0;
  let imgHeight = 0;
  try {
    await loadFaceModels();

    const img = await loadImage(imageDataUrl);
    imgWidth = img.naturalWidth || img.width;
    imgHeight = img.naturalHeight || img.height;

    if (imgWidth === 0 || imgHeight === 0) {
      console.warn('[FaceAPI] Image has zero dimensions');
      return makeUndetected();
    }

    const detection = await bestDetection(img);

    if (!detection) {
      console.warn('[FaceAPI] No face detected in image');
      return makeUndetected(imgWidth, imgHeight);
    }

    const box = detection.detection.box;
    const pts = detection.landmarks.positions;

    // face-api.js 68-point landmark indices:
    // 0-16:  Jawline (0=left jaw, 8=chin bottom, 16=right jaw)
    // 17-21: Left eyebrow   22-26: Right eyebrow
    // 27-30: Nose bridge (30=tip)   31-35: Nose bottom
    // 36-41: Left eye   42-47: Right eye
    // 48-59: Outer lip (48=left corner, 54=right corner)   60-67: Inner lip

    const pct = (p: faceapi.Point): Point => ({
      x: (p.x / imgWidth) * 100,
      y: (p.y / imgHeight) * 100,
    });

    const avgPct = (indices: number[]): Point => {
      let sx = 0, sy = 0;
      for (const i of indices) { sx += pts[i].x; sy += pts[i].y; }
      return {
        x: (sx / indices.length / imgWidth) * 100,
        y: (sy / indices.length / imgHeight) * 100,
      };
    };

    const points: Point[] = pts.map(pct);

    const leftEyeCenter = avgPct([36, 37, 38, 39, 40, 41]);
    const rightEyeCenter = avgPct([42, 43, 44, 45, 46, 47]);
    const noseTip = pct(pts[30]);
    const chinBottom = pct(pts[8]);
    const leftJaw = pct(pts[0]);
    const rightJaw = pct(pts[16]);

    // Forehead center: above the brows, projected upward from brow midpoint.
    const leftBrowMid = avgPct([17, 18, 19, 20, 21]);
    const rightBrowMid = avgPct([22, 23, 24, 25, 26]);
    const browCenterX = (leftBrowMid.x + rightBrowMid.x) / 2;
    const browCenterY = (leftBrowMid.y + rightBrowMid.y) / 2;
    const eyeMidY = (leftEyeCenter.y + rightEyeCenter.y) / 2;
    const browToEye = Math.abs(browCenterY - eyeMidY);
    const foreheadY = Math.max(0, browCenterY - browToEye * 2.2);
    const foreheadCenter = { x: browCenterX, y: foreheadY };

    const leftCheek = {
      x: (leftJaw.x + leftEyeCenter.x) / 2,
      y: (leftEyeCenter.y + noseTip.y) / 2 + (noseTip.y - leftEyeCenter.y) * 0.1,
    };
    const rightCheek = {
      x: (rightJaw.x + rightEyeCenter.x) / 2,
      y: (rightEyeCenter.y + noseTip.y) / 2 + (noseTip.y - rightEyeCenter.y) * 0.1,
    };

    const mouthCenter = avgPct([48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59]);

    const result: FaceDetectionResult = {
      detected: true,
      confidence: detection.detection.score,
      imageWidth: imgWidth,
      imageHeight: imgHeight,
      boundingBox: {
        x: (box.x / imgWidth) * 100,
        y: (box.y / imgHeight) * 100,
        width: (box.width / imgWidth) * 100,
        height: (box.height / imgHeight) * 100,
      },
      landmarks: {
        foreheadCenter,
        leftEye: leftEyeCenter,
        rightEye: rightEyeCenter,
        noseTip,
        leftCheek,
        rightCheek,
        mouthCenter,
        chinBottom,
        leftJaw,
        rightJaw,
      },
      points,
    };

    console.log('[FaceAPI] Face detected', {
      confidence: result.confidence.toFixed(2),
      img: `${imgWidth}x${imgHeight}`,
      box: `x:${result.boundingBox.x.toFixed(1)} y:${result.boundingBox.y.toFixed(1)} w:${result.boundingBox.width.toFixed(1)} h:${result.boundingBox.height.toFixed(1)}`,
    });

    return result;
  } catch (err) {
    console.error('[FaceAPI] Detection error:', err);
    return makeUndetected(imgWidth, imgHeight);
  }
}

/** Load an image from a data URL and return an HTMLImageElement */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}
