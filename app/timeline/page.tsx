"use client";

/**
 * /timeline — legacy route.
 * All editor functionality was consolidated into /storyboard.
 * This page just redirects there, preserving any sessionStorage state.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TimelinePage() {
  const router = useRouter();

  useEffect(() => {
    // If audio/voiceclone results were stored, signal storyboard to restore and apply them
    const pendingAudio = sessionStorage.getItem("pendingAudio");
    const pendingVideo = sessionStorage.getItem("pendingVideo");

    if (pendingAudio) {
      sessionStorage.setItem("vb_pending_audio", pendingAudio);
      sessionStorage.removeItem("pendingAudio");
    }
    if (pendingVideo) {
      sessionStorage.setItem("vb_pending_video", pendingVideo);
      sessionStorage.removeItem("pendingVideo");
    }

    // Always restore last session if available when coming from another tool
    sessionStorage.setItem("vb_restore_requested", "1");

    router.replace("/storyboard");
  }, [router]);

  return (
    <div style={{
      height: "100vh", background: "#131313", display: "flex",
      alignItems: "center", justifyContent: "center",
      color: "#555", fontFamily: "sans-serif", fontSize: 13,
    }}>
      Redirecionando para o editor…
    </div>
  );
}
