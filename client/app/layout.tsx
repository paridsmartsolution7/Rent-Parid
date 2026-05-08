import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import ThemeApplier from "./components/ThemeApplier";
import VisitTracker from "./components/VisitTracker";
import FaviconRefresher from "./components/FaviconRefresher";
import VersionGuard from "./components/VersionGuard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rent Parid — Qira Makinash",
  description: "Qira makinash ne te gjithe Shqiperine — flota moderne, cmime te qarta dhe rezervim i shpejte online.",
  // Browser-tab favicon: trimmed + re-rendered at 256x256 so the logo fills
  // the favicon canvas (was looking small because the source PNG had
  // transparent padding around the mark).
  icons: {
    icon: [{ url: '/favicon-large.png', type: 'image/png', sizes: '256x256' }],
    shortcut: '/favicon-large.png',
    apple: '/favicon-large.png',
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

// iOS Safari < 15.4 is missing Array.prototype.at, Object.hasOwn, and
// Array.prototype.findLast. Without these the app bundle throws at first
// call and the page stays stuck on the loading skeleton. ES5 syntax only
// so this inline script parses on Safari 14.
const iosCompatScript = `
(function(){
  try {
    if (!Object.hasOwn) {
      Object.hasOwn = function(obj, key){ return Object.prototype.hasOwnProperty.call(obj, key); };
    }
    function at(n){ n = Math.trunc(n) || 0; if (n < 0) n += this.length; if (n < 0 || n >= this.length) return undefined; return this[n]; }
    if (!Array.prototype.at) Object.defineProperty(Array.prototype, 'at', { value: at, writable: true, configurable: true });
    if (!String.prototype.at) Object.defineProperty(String.prototype, 'at', { value: at, writable: true, configurable: true });
    if (!Array.prototype.findLast) {
      Object.defineProperty(Array.prototype, 'findLast', {
        value: function(cb){ for (var i = this.length - 1; i >= 0; i--) { if (cb(this[i], i, this)) return this[i]; } return undefined; },
        writable: true, configurable: true
      });
    }
    if (!Array.prototype.findLastIndex) {
      Object.defineProperty(Array.prototype, 'findLastIndex', {
        value: function(cb){ for (var i = this.length - 1; i >= 0; i--) { if (cb(this[i], i, this)) return i; } return -1; },
        writable: true, configurable: true
      });
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sq"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Raw inline script (NOT next/script) so it runs on Safari 14 even
            if Next's modern script loader fails to parse. Uses only ES5 syntax. */}
        <script dangerouslySetInnerHTML={{ __html: iosCompatScript }} />
        <ThemeApplier />
        <VisitTracker />
        <FaviconRefresher />
        <VersionGuard />
        {children}
        <Footer />
        <ScrollToTop />
      </body>
    </html>
  );
}
