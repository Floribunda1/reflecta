import { useEffect, useState } from "react";

export function useAutoFrame(frameCount: number, intervalMs = 1_200) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (frameCount < 2) return;
    const timer = window.setInterval(
      () => setFrame((current) => (current + 1) % frameCount),
      intervalMs,
    );
    return () => window.clearInterval(timer);
  }, [frameCount, intervalMs]);

  return frame;
}
