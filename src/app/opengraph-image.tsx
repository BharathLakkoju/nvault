import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const alt = siteConfig.ogImageAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default social-share card for the whole site. Individual pages inherit this
// unless they define their own `opengraph-image`.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#020617",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5l-8-3Z" fill="#818cf8" />
            <circle cx="12" cy="10" r="2.4" fill="#020617" />
            <rect x="10.8" y="10" width="2.4" height="5" rx="1.2" fill="#020617" />
          </svg>
          <span style={{ fontSize: 40, fontWeight: 700 }}>{siteConfig.name}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 }}>
            Your development environment, available anywhere.
          </div>
          <div style={{ fontSize: 32, color: "#94a3b8", maxWidth: 900 }}>
            Zero-knowledge vault for .env files — client-side encryption, versioned history,
            one-command restore.
          </div>
        </div>

        <div style={{ fontSize: 26, color: "#64748b" }}>{siteConfig.url.replace("https://", "")}</div>
      </div>
    ),
    { ...size },
  );
}
