import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WalletProvider } from "../contexts/WalletContext";
import SiteNav from "../components/SiteNav";
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
  title: "Квитки на ІТ-заходи",
  description: "Квитки на ІТ-заходи з верифікацією покупця через самосуверенну ідентичність",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="uk"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        <WalletProvider>
          <SiteNav />
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
