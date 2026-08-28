import { ImageResponse } from "next/og";

// Generated app icon (favicon / PWA). Rendered at build/request time so there
// is no binary asset to keep in the repo.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
          borderRadius: 96,
        }}
      >
        <svg width="300" height="300" viewBox="0 0 24 24" fill="none">
          <path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5l-8-3Z" fill="#ffffff" />
          <circle cx="12" cy="10" r="2.4" fill="#4f46e5" />
          <rect x="10.8" y="10" width="2.4" height="5" rx="1.2" fill="#4f46e5" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
