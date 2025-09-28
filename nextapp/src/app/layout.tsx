import type React from "react"
import type { Metadata } from "next"
import { Inter, JetBrains_Mono, Instrument_Serif } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import { V0Provider } from "@/lib/context"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
})

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
})

const isV0 = process.env["VERCEL_URL"]?.includes("vusercontent.net") ?? false

export const metadata: Metadata = {
  title: {
    template: "%s | Parrot: AI Phonetics Coach",
    default: "Parrot: AI Phonetics Coach",
  },
  description:
    "We stand at the forefront of a new era, where creativity meets technology to redefine what's possible. Our mission is to empower individuals and businesses alike with groundbreaking solutions that inspire change and drive progress.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={cn(inter.variable, jetbrainsMono.variable, instrumentSerif.variable)}>
        <V0Provider isV0={isV0}>{children}</V0Provider>
      </body>
    </html>
  )
}
