"use client";

import Link from "next/link";

const primaryColor = "#1F3E76";

export default function Footer() {
  return (
    <footer className="relative mt-auto bg-gradient-to-t from-blue-50 via-gray-50 to-gray-50 text-gray-600 overflow-hidden">
      {/* Decorative blurs */}
      <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full blur-3xl opacity-10" style={{ backgroundColor: '#1F3E76' }} />
      <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full blur-3xl opacity-20 bg-sky-300" />
      <div className="relative max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <svg height="36" width="36" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet">
                <g transform="translate(0,512) scale(0.1,-0.1)" fill="#1F3E76" stroke="none">
                  <path d="M1420 4478 c-102 -61 -273 -163 -380 -227 l-195 -116 -3 -1567 -2 -1566 222 -133 c123 -73 301 -179 396 -236 95 -56 175 -103 178 -103 5 0 190 107 1069 615 50 29 360 209 690 400 330 191 614 356 630 365 17 10 79 46 138 81 l108 64 0 490 0 490 -143 84 c-79 46 -219 129 -313 184 -93 55 -217 128 -275 162 -58 34 -181 107 -275 162 -236 139 -691 405 -1140 668 -209 122 -407 239 -440 259 -33 20 -64 36 -70 35 -5 0 -93 -51 -195 -111z m294 -287 c143 -83 248 -143 706 -409 223 -129 464 -269 535 -310 72 -41 211 -122 310 -179 99 -58 227 -132 285 -166 58 -33 125 -72 150 -87 25 -15 71 -42 103 -59 31 -18 57 -36 57 -41 0 -6 -822 -482 -859 -498 -4 -1 -7 46 -8 105 -2 245 -103 464 -278 606 -33 26 -105 71 -160 98 -153 78 -1335 763 -1335 774 0 11 358 223 379 224 7 1 59 -25 115 -58z m-353 -572 c501 -294 579 -341 579 -349 0 -4 -15 -13 -32 -21 -60 -23 -165 -97 -222 -154 -76 -78 -139 -182 -177 -295 l-32 -95 -4 -885 c-2 -487 -7 -887 -9 -889 -3 -3 -17 3 -32 12 -15 9 -91 54 -169 99 -78 46 -145 90 -148 98 -9 21 6 2610 15 2610 4 0 108 -59 231 -131z m1010 -575 c164 -48 300 -175 353 -329 79 -227 -36 -520 -246 -623 -82 -40 -134 -51 -241 -52 -199 0 -365 99 -452 269 -74 148 -74 325 0 477 99 203 369 322 586 258z m1597 -605 l-3 -232 -100 -57 c-55 -32 -188 -108 -295 -170 -107 -62 -337 -195 -510 -295 -358 -207 -598 -345 -768 -444 -64 -37 -208 -120 -319 -184 -111 -64 -207 -117 -213 -117 -7 0 -10 161 -10 500 0 344 3 500 11 500 5 0 40 -18 76 -40 84 -50 158 -78 253 -96 98 -17 158 -17 261 1 113 19 156 36 269 101 900 519 1327 762 1338 763 10 1 12 -48 10 -230z"/>
                  <path d="M2151 2784 c-143 -50 -205 -209 -137 -347 63 -130 213 -174 346 -101 189 103 141 408 -71 453 -65 14 -85 13 -138 -5z"/>
                </g>
              </svg>
              <span className="text-xl font-bold text-gray-900">Rent Parid</span>
            </div>
            <p className="text-sm leading-relaxed text-gray-400">
              Partneri juaj per qira makinash ne Shqiperi. Flota moderne, cmime te qarta dhe rezervim online ne pak klikime.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-gray-900 font-semibold mb-4 text-sm uppercase tracking-wider">Linqe</h3>
            <ul className="space-y-2.5">
              {[
                { href: "/", label: "Kryefaqja" },
                { href: "/shop", label: "Makinat" },
                { href: "/favorites", label: "Te preferuarat" },
                { href: "/auth", label: "Llogaria ime" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-500 hover:text-[#1F3E76] transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="text-gray-900 font-semibold mb-4 text-sm uppercase tracking-wider">Sherbimi ndaj klientit</h3>
            <ul className="space-y-2.5">
              <li>
                <Link href="/faq" className="text-sm text-gray-500 hover:text-[#1F3E76] transition-colors">
                  Pyetje te shpeshta
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-gray-500 hover:text-[#1F3E76] transition-colors">
                  Na kontaktoni
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-gray-900 font-semibold mb-4 text-sm uppercase tracking-wider">Na kontaktoni</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-gray-500"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <a href="mailto:info@paridsmartsolution.al" className="text-sm text-gray-500 hover:text-[#1F3E76] transition-colors">info@paridsmartsolution.al</a>
              </li>
              <li className="flex items-start gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-gray-500"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <div className="flex flex-col">
                  <a href="tel:+355686005016" className="text-sm text-gray-500 hover:text-[#1F3E76] transition-colors">+355 68 600 5016</a>
                  <a href="tel:+355686005025" className="text-sm text-gray-500 hover:text-[#1F3E76] transition-colors">+355 68 600 5025</a>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-gray-500"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <a
                  href="https://www.google.com/maps/place/Parid+Smart+Solution/@41.318977,19.8146535,17z/data=!4m14!1m7!3m6!1s0x135031b04e8b72c3:0xf7f4a7a8e9cc57a5!2sParid+Smart+Solution!8m2!3d41.318973!4d19.8172284!16s%2Fg%2F11t5h4zxmx!3m5!1s0x135031b04e8b72c3:0xf7f4a7a8e9cc57a5!8m2!3d41.318973!4d19.8172284!16s%2Fg%2F11t5h4zxmx?entry=ttu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-500 hover:text-[#1F3E76] transition-colors"
                >
                  Rr. Abdyl Frasheri, Tirane
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-200 mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Rent Parid. Te gjitha te drejtat e rezervuara.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">Mundesuar nga</span>
            <span className="text-xs font-semibold" style={{ color: primaryColor }}>Rent Parid</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
