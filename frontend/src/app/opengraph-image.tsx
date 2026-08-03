import { ImageResponse } from "next/og";

export const alt = "Rolebolt — AI recruiting software and job search workspace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          color: "white",
          background:
            "linear-gradient(120deg, #061225 0%, #0b2f59 52%, #173c78 100%)",
          fontFamily: "Arial",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: 34, fontWeight: 700 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              color: "#0a66c2",
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            R
          </div>
          Rolebolt
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 930 }}>
          <div style={{ color: "#74c9ff", fontSize: 20, fontWeight: 700, letterSpacing: 3 }}>
            CLEARER HIRING. CONFIDENT JOB SEARCHES.
          </div>
          <div style={{ marginTop: 20, fontSize: 64, lineHeight: 1.08, fontWeight: 800 }}>
            AI recruiting software for the whole hiring journey.
          </div>
          <div style={{ marginTop: 24, color: "#c6d9ec", fontSize: 27 }}>
            Applicant tracking, candidate evaluation, job discovery and career tools in one workspace.
          </div>
        </div>
        <div style={{ color: "#9ec2df", fontSize: 22 }}>www.rolebolt.tech</div>
      </div>
    ),
    size,
  );
}