import type { Metadata, Viewport } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import Navbar from "@/components/Navbar";
import ConditionalFooter from "@/components/ConditionalFooter";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "CricketGeo — Daily Cricket Geography Game",
  description:
    "Daily sports geography game. Tap where it happened. 5 questions on historic cricket grounds and legendary moments.",
  other: {
    "google-adsense-account": "ca-pub-9834644151403431",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-black text-white flex flex-col antialiased selection:bg-[#38bdf8] selection:text-black overflow-x-hidden">
        <Navbar />
        <main className="flex-1 flex flex-col min-h-0 relative bg-black">{children}</main>
        <ConditionalFooter />
      </body>
    </html>
  );
}
