"use client";

import { useEffect, useState, type RefObject } from "react";

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  active: boolean;
  onReadyChange?: (ready: boolean) => void;
  className?: string;
};

export function WebcamCapture({ videoRef, active, onReadyChange, className }: Props) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    async function start() {
      setError(null);
      onReadyChange?.(false);
      if (!active) {
        stop();
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser cannot open a webcam.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          onReadyChange?.(true);
        }
      } catch {
        setError("Camera permission denied or unavailable. Allow camera access for this site.");
        onReadyChange?.(false);
      }
    }

    function stop() {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      onReadyChange?.(false);
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [active, onReadyChange, videoRef]);

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
        <video
          ref={videoRef}
          muted
          playsInline
          className="aspect-[4/3] w-full object-cover"
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {!error && active && (
        <p className="mt-2 text-xs text-slate-500">Keep one face centered. Office light works best.</p>
      )}
    </div>
  );
}
