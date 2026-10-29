"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: "When does my 5% member discount start?",
    answer:
      "Immediately upon joining! Your 5% discount (up to $30 per order) is linked to your account and applied automatically to eligible items at checkout. You can also add membership directly during checkout to discount that very purchase.",
  },
  {
    question: "Can I use my member discount with promo coupons?",
    answer:
      "Yes! Your member discount automatically applies at the product level, and you can still apply eligible promotional coupon codes to your cart at checkout for compound savings.",
  },
  {
    question: "How does the 3-Year Extended Warranty work?",
    answer:
      "Every piece of furniture purchased while your VIP membership is active receives a full 3-year warranty covering timber frames, structural joints, springs, and craftsmanship defects — double our standard 1-year coverage.",
  },
  {
    question: "Can I cancel auto-renewal anytime?",
    answer:
      "Yes, 100%. You have complete control in your account dashboard. You can switch off auto-renewal anytime with one click — no questions asked, no phone calls required. You will continue to enjoy your full VIP benefits until your term concludes.",
  },
  {
    question: "Is there a limit to how many times I can save?",
    answer:
      "No! There is no limit on the number of orders you can place. You save up to $30 on every single eligible furniture and decor order throughout your entire 365-day membership period.",
  },
];

export function MembershipFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="space-y-3">
      {FAQS.map((faq, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={faq.question}
            className={`border rounded-2xl transition-all overflow-hidden ${
              isOpen
                ? "bg-white border-amber-500/40 shadow-sm"
                : "bg-white/80 border-slate-200 hover:border-slate-300"
            }`}
          >
            <button
              type="button"
              onClick={() => toggle(idx)}
              className="w-full flex items-center justify-between text-left p-5 sm:p-6 gap-4 focus:outline-none"
              aria-expanded={isOpen}
            >
              <span className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-3">
                <HelpCircle className={`h-4 w-4 shrink-0 transition-colors ${isOpen ? "text-amber-500" : "text-slate-400"}`} />
                {faq.question}
              </span>
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
                  isOpen ? "bg-amber-100 text-amber-700 rotate-180" : "bg-slate-100 text-slate-500"
                }`}
              >
                <ChevronDown className="h-4 w-4" />
              </div>
            </button>

            {isOpen && (
              <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-0 text-slate-600 text-xs sm:text-sm leading-relaxed border-t border-slate-100">
                <p className="pt-3">{faq.answer}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
