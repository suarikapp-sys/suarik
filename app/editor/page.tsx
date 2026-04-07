"use client";

/**
 * /editor — legacy route, replaced by /storyboard.
 * Redirect immediately, preserving any sessionStorage state.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EditorPage() {
  const router = useRouter();

  useEffect(() => {
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
