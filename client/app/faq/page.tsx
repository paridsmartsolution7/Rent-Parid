"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Mail } from "lucide-react";

const primaryColor = "#1F3E76";

const faqs = [
  {
    question: "Si te krijoj nje llogari?",
    answer: "Klikoni mbi ikonen e perdoruesit ne kendin e siperm djathtas dhe zgjidhni 'Regjistrohu'. Plotesoni te dhenat tuaja dhe verifikoni email-in me kodin 4-shifror. Mund te regjistroheni menjehere edhe me llogarinë tuaj Google.",
  },
  {
    question: "Si te bej nje porosi?",
    answer: "Shfletoni produktet tona, shtoni artikuj ne shporte dhe klikoni 'Perfundo porosine'. Do te merrni nje email konfirmimi pasi porosia te vendoset.",
  },
  {
    question: "Cilat metoda pagese pranoni?",
    answer: "Pranojme metoda te ndryshme pagese duke perfshire transferta bankare dhe pagese ne dorezim. Opsionet e pageses mund te ndryshojne sipas vendndodhjes suaj.",
  },
  {
    question: "Si mund ta ndjek porosine time?",
    answer: "Pasi porosia juaj te konfirmohet, do te merrni nje email me detajet e porosise. Mund te kontrolloni gjithashtu statusin duke kontaktuar ekipin tone te mbeshtjetjes.",
  },
  {
    question: "A mund ta anuloj ose ndryshoj porosine?",
    answer: "Mund te kerkoni anulim ose ndryshim duke kontaktuar ekipin tone sa me shpejt. Pasi porosia te procesohej per dergese, ndryshimet mund te mos jene te mundshme.",
  },
  {
    question: "Si t'i shtoj produktet ne te preferuarat?",
    answer: "Klikoni ikonen e zemres ne cdo karte produkti per ta shtuar ne te preferuarat. Shikoni te gjitha produktet e preferuara duke klikuar 'Te preferuarat' ne shiritin e navigimit.",
  },
  {
    question: "A eshte i sigurt informacioni im personal?",
    answer: "Po, ne e marrim seriozisht privatesine tuaj. Fjalekalimi juaj eshte i enkriptuar dhe te dhenat personale ruhen ne menyre te sigurt. Nuk i ndajme kurre informacionet tuaja me pale te treta.",
  },
  {
    question: "Si te kontaktoj mbeshtjetjen e klientit?",
    answer: "Na kontaktoni me email ne paridsmartsolution7@gmail.com ose na telefononi ne +355 69 202 0818. Ekipi yne eshte i disponueshem gjate orarit te punes.",
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition"
      >
        <span className="font-medium text-gray-900 pr-4">{question}</span>
        <ChevronDown
          size={20}
          className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-6 pb-4 pt-0">
          <p className="text-sm text-gray-600 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div
        className="text-white py-16 px-4 text-center"
        style={{ background: `linear-gradient(to right, ${primaryColor}, ${primaryColor})` }}
      >
        <h1 className="text-4xl font-bold mb-3">Pyetje te Shpeshta</h1>
        <p className="text-blue-100 text-lg">Gjeni pergjigje per pyetjet me te zakonshme rreth dyqanit tone</p>
      </div>

      {/* FAQ List */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <FAQItem key={i} question={faq.question} answer={faq.answer} />
          ))}
        </div>

        {/* Still have questions */}
        <div className="mt-12 bg-white rounded-2xl shadow-sm p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Keni ende pyetje?</h2>
          <p className="text-gray-600 mb-4">Ekipi yne i mbeshtjetjes eshte ketu per t'ju ndihmuar.</p>
          <a
            href="mailto:paridsmartsolution7@gmail.com"
            className="inline-flex items-center gap-2 text-white font-semibold px-6 py-3 rounded-full transition hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            <Mail size={16} />
            Na kontaktoni
          </a>
        </div>

        <div className="text-center mt-8">
          <Link href="/" className="text-sm text-gray-500 hover:underline">
            Kthehu ne Kryefaqje
          </Link>
        </div>
      </div>
    </div>
  );
}
