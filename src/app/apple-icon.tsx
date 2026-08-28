import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        }}
      >
        <svg width="118" height="118" viewBox="0 0 24 24" fill="none">
          <path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5l-8-3Z" fill="#ffffff" />
          <circle cx="12" cy="10" r="2.4" fill="#4f46e5" />
          <rect x="10.8" y="10" width="2.4" height="5" rx="1.2" fill="#4f46e5" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
