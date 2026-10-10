import type { Metadata, Viewport } from "next";
import { Chakra_Petch, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Chakra_Petch({ variable: "--font-display", weight: ["400", "500", "600", "700"], subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", weight: ["400", "500", "600"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SYNAPSE CITY — An Artificial Society That Learns",
  description: "A deterministic multi-agent city where citizens learn through measurable reinforcement learning.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover", themeColor: "#071317" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${display.variable} ${mono.variable}`}><body>{children}</body></html>;
}
