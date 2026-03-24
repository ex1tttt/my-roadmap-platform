import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar"
import { ThemeProvider } from "@/components/theme-provider"
import I18nProvider from "@/components/I18nProvider"
import SupportChat from "@/components/SupportChat"
import { ThemeAwareToaster } from "@/components/ThemeAwareToaster"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Roadmap Platform — Платформа для роста и обучения",
  description: "Современная платформа для развития, обучения и достижения новых высот. Стройте свои дорожные карты, отслеживайте прогресс и достигайте целей вместе с нами!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`}
          strategy="lazyOnload"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-white dark:bg-[#020617] text-slate-900 dark:text-slate-50 transition-colors duration-300`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider>
            <Navbar />
            {children}
            <SupportChat />
            <ThemeAwareToaster />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
