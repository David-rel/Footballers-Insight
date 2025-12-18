import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SessionProvider from "@/components/providers/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Footballers Insight",
  description:
    "Performance intelligence for players, coaches, and clubs powered by Footballers Insight.",
  icons: {
    icon: [{ url: "/icondark-rounded.png", type: "image/png" }],
    shortcut: "/icondark-rounded.png",
    apple: "/icondark-rounded.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[radial-gradient(circle_at_20%_-10%,rgba(var(--gold-rgb),0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(var(--gold-rgb),0.05),transparent_25%),#050505]`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            <div className="relative min-h-screen overflow-hidden">
              <div className="glow" />
              <div className="grain" />
              <div className="relative z-10 flex min-h-screen flex-col">
                {children}
              </div>
            </div>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
