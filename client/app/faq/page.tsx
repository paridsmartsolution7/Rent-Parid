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
    question: "Si te rezervoj nje makine?",
    answer: "Shfletoni floten tone, zgjidhni makinen qe ju pelqen, shtojeni ne rezervim dhe klikoni 'Konfirmo rezervimin'. Do te merrni nje email me detajet e qirase pasi rezervimi te vendoset.",
  },
  {
    question: "Cfare dokumentash me duhen per te marre nje makine me qira?",
    answer: "Ju duhet nje patente shoferi e vlefshme (te pakten 1 vit), nje dokument identifikimi (karte ID ose pasaporte) dhe nje karte krediti ose debiti per garancine. Mosha minimale eshte 21 vjec.",
  },
  {
    question: "Cilat metoda pagese pranoni?",
    answer: "Pranojme pagese me karte (Visa, Mastercard), transferte bankare dhe kesh ne marrjen e makines. Garancia ngrihet zakonisht me karte krediti dhe lirohet pasi te ktheni makinen pa demtime.",
  },
  {
    question: "A perfshihet sigurimi ne cmim?",
    answer: "Cdo cmim ditor perfshin sigurimin baze (TPL + CDW). Mund te shtoni edhe sigurim te plote pa franshize si opsion shtese ne momentin e rezervimit.",
  },
  {
    question: "A mund ta anuloj ose ndryshoj rezervimin?",
    answer: "Anulimi eshte falas deri 24 ore para fillimit te qirase. Per ndryshime ne data ose model na kontaktoni sa me shpejt — mundesia varet nga disponueshmeria e flotes.",
  },
  {
    question: "A mund te marr makinen ne aeroport?",
    answer: "Po. Ofrojme dorezim dhe terheqje pa pagese ne Aeroportin Nene Tereza (Tirane Rinas) si dhe ne hotelet e qytetit. Vetem na njoftoni numrin e fluturimit dhe oren e mberritjes.",
  },
  {
    question: "A ka kufizim per kilometrat?",
    answer: "Pjesa me e madhe e tarifave perfshijne kilometra te pakufizuara brenda Shqiperise. Per udhetime jashte vendit duhet nje miratim paraprak dhe mund te aplikohet nje tarife shtese.",
  },
  {
    question: "Si te kontaktoj mbeshtjetjen e klientit?",
    answer: "Na kontaktoni me email ne info@rentparid.al ose na telefononi ne +355 68 600 5016. Sherbimi i ndihmes ne rruge eshte i disponueshem 24/7 per cdo klient aktiv.",
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
        <p className="text-blue-100 text-lg">Pergjigjet per pyetjet me te zakonshme rreth qirase se makinave</p>
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
