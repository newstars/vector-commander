import "maplibre-gl/dist/maplibre-gl.css";
import "../styles/globals.css";

export const metadata = {
  title: "Vector Commander",
  description: "Seoul mosquito ABM strategy game"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
