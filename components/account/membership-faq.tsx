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
    <div className="space-y-2.5">
      {FAQS.map((faq, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={faq.question}
            className={`rounded-xl border transition-colors ${
              isOpen
                ? "bg-white border-primary/30 shadow-xs"
                : "bg-white border-border hover:border-border/80"
            }`}
          >
            <button
              type="button"
              onClick={() => toggle(idx)}
              className="w-full flex items-center justify-between text-left p-4 sm:p-5 gap-3 focus:outline-none"
              aria-expanded={isOpen}
            >
              <span className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2.5">
                <HelpCircle
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    isOpen ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                {faq.question}
              </span>
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
                  isOpen ? "bg-primary/10 text-primary rotate-180" : "bg-secondary text-muted-foreground"
                }`}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 text-muted-foreground text-xs sm:text-sm leading-relaxed border-t border-border/50">
                <p className="pt-3">{faq.answer}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
