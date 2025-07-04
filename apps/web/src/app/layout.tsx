import type { Viewport } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import { MeshGradientComponent } from "../components/mesh-gradient";
import "../styles/globals.css";
import { ThemeProvider } from '../components/theme-provider'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: true,
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style:["normal", "italic"],
  preload: true,
});

export const viewport: Viewport = {
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.className} ${instrumentSerif.variable} antialiased max-w-screen min-h-svh bg-transparent text-slate-12 duration-75 transition-opacity`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="max-w-screen-lg mx-auto w-full relative z-[1] flex flex-col min-h-screen">
            <div className="flex flex-col flex-1 items-center justify-center gap-12 px-8">
              <main className="flex items-center justify-center w-full">{children}</main>
            </div>
          </div>
        </ThemeProvider>
        <MeshGradientComponent
          colors={[
            "#667eea", // Purple blue
            "#764ba2", // Purple 
            "#f093fb", // Pink
            "#f5576c"  // Red pink
          ]}
          speed={3}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: -1,
            width: "100%",
            height: "100%",
          }}
        />
      </body>
    </html>
  );
}

export const metadata = {
  title: "TurboRead",
  description: "Speed-read your documents with AI-powered highlighting and voice assistance.",
};
