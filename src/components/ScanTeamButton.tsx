"use client";

import { useRef, useState } from "react";

/**
 * Scans a team's printed/on-screen QR code (encoded as {type:"team", teamId, token})
 * and calls onScan with the team id. Falls back to an error message on browsers
 * without BarcodeDetector (notably Safari/iOS) — callers should offer a manual
 * team picker alongside this.
 */
export function ScanTeamButton({
  onScan,
  label = "Scan team QR",
  className,
}: {
  onScan: (teamId: string) => void;
  label?: string;
  className?: string;
}) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function start() {
    setScanning(true);
    setError(null);
    if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
      setError("Camera scanning isn't supported on this device — use the dropdown instead.");
      setScanning(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // @ts-expect-error - global BarcodeDetector
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const interval = setInterval(async () => {
        if (!videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            clearInterval(interval);
            stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
            setScanning(false);
            const raw = codes[0].rawValue;
            try {
              const parsed = JSON.parse(raw);
              if (parsed.teamId) onScan(parsed.teamId);
              else setError("Unrecognized QR code.");
            } catch {
              setError("Unrecognized QR code.");
            }
          }
        } catch {
          /* keep trying */
        }
      }, 400);
    } catch {
      setError("Couldn't access the camera — use the dropdown instead.");
      setScanning(false);
    }
  }

  return (
    <div className={className}>
      <button
        onClick={start}
        className="border border-teal text-teal px-3 py-2 text-sm hover:bg-teal hover:text-paper transition-colors focus-ring"
      >
        {label}
      </button>
      {scanning && (
        <video ref={videoRef} className="w-full mt-4 border border-line" muted playsInline />
      )}
      {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
    </div>
  );
}
