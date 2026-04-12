import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = localFont({
  src: [
    { path: "../../public/fonts/geist-latin.woff2", weight: "100 900" },
    { path: "../../public/fonts/geist-latin-ext.woff2", weight: "100 900" },
  ],
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: [
    { path: "../../public/fonts/geist-mono-latin.woff2", weight: "100 900" },
    { path: "../../public/fonts/geist-mono-latin-ext.woff2", weight: "100 900" },
  ],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Sidequests",
  description: "Local developer portfolio dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Anti-FOUC: set data-theme before first paint so dark-mode users
            never see a flash of the light theme on load. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');document.documentElement.dataset.theme=t||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}catch(e){}})()`,
          }}
        />
        {children}
        <Toaster position="bottom-right" duration={1500} />
      </body>
    </html>
  );
}
