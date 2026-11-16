/**
 * Client-side face-api loader for the office Face Verification desk.
 * Models load once from jsDelivr; descriptors are 128-d Float32 arrays.
 */

const FACE_API_SRC = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js";
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";

type FaceApi = {
  nets: {
    tinyFaceDetector: { loadFromUri: (url: string) => Promise<void> };
    faceLandmark68Net: { loadFromUri: (url: string) => Promise<void> };
    faceRecognitionNet: { loadFromUri: (url: string) => Promise<void> };
  };
  TinyFaceDetectorOptions: new (opts?: { inputSize?: number; scoreThreshold?: number }) => unknown;
  detectSingleFace: (
    input: HTMLVideoElement | HTMLCanvasElement,
    options: unknown,
  ) => {
    withFaceLandmarks: () => {
      withFaceDescriptor: () => Promise<{ descriptor: Float32Array } | undefined>;
    };
  };
};

declare global {
  interface Window {
    faceapi?: FaceApi;
  }
}

let loadPromise: Promise<FaceApi> | null = null;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-face-api="1"]`);
    if (existing && window.faceapi) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.faceApi = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load face recognition library"));
    document.head.appendChild(script);
  });
}

export async function ensureFaceApi(): Promise<FaceApi> {
  if (typeof window === "undefined") {
    throw new Error("Face recognition only runs in the browser");
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      await loadScript(FACE_API_SRC);
      const api = window.faceapi;
      if (!api) throw new Error("Face recognition library did not initialize");
      await Promise.all([
        api.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        api.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        api.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      return api;
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }
  return loadPromise;
}

export async function descriptorFromVideo(video: HTMLVideoElement): Promise<number[]> {
  const api = await ensureFaceApi();
  const options = new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  const detection = await api.detectSingleFace(video, options).withFaceLandmarks().withFaceDescriptor();
  if (!detection?.descriptor) {
    throw new Error("No face detected — face the camera with good light");
  }
  return Array.from(detection.descriptor);
}

export function snapshotFromVideo(video: HTMLVideoElement, maxWidth = 480): string {
  const scale = Math.min(1, maxWidth / Math.max(1, video.videoWidth));
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not capture webcam frame");
  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.72);
}
