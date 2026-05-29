import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    q: "What are fuzzy wire flowers?",
    a: "Fuzzy wire flowers are handcrafted artificial flowers made from chenille wire. They are soft, durable, and last forever — perfect as keepsakes or gifts."
  },
  {
    q: "How long do fuzzy wire flowers last?",
    a: "With proper care, they last indefinitely. Unlike fresh flowers, they never wilt or die."
  },
  {
    q: "How do I care for my fuzzy wire flowers?",
    a: "Keep them away from water and direct sunlight. Gently fluff the petals if needed. Dust lightly with a soft dry cloth."
  },
  {
    q: "How far in advance should I order?",
    a: "We recommend ordering at least 3–5 days in advance. For bulk or event orders, please contact us at least 2 weeks ahead."
  },
  {
    q: "Do you offer delivery?",
    a: "Yes! We offer both pickup and delivery. Delivery fee is ₱80. Coverage area may vary — contact us to confirm."
  },
  {
    q: "Can I request a custom design not shown on the website?",
    a: "Absolutely! Use our Customize page to build your own, or message us directly on WhatsApp for special requests."
  },
  {
    q: "How do I pay?",
    a: "We accept GCash and cash on pickup. Payment details will be provided after your order is confirmed."
  }
];

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="py-8 md:py-16 bg-astraea-blush/20 min-h-screen animate-fade-in">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-10 md:mb-16">
          <h1 className="font-heading text-2xl md:text-4xl font-bold text-astraea-darkgray mb-4">
            Frequently Asked Questions
          </h1>
          <div className="w-24 h-1 bg-astraea-pink mx-auto mt-6 rounded-full"></div>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div 
              key={idx} 
              className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
                openIndex === idx ? 'border-astraea-pink shadow-md' : 'border-astraea-rosegold/20 hover:border-astraea-pink/50'
              }`}
            >
              <button 
                onClick={() => setOpenIndex(openIndex === idx ? -1 : idx)}
                className="w-full min-h-12 text-left px-4 md:px-6 py-4 md:py-5 flex justify-between items-center gap-4 focus:outline-none"
              >
                <span className={`font-bold text-base md:text-lg ${openIndex === idx ? 'text-astraea-pink' : 'text-astraea-darkgray'}`}>
                  {faq.q}
                </span>
                <ChevronDown className={`w-5 h-5 text-astraea-rosegold transition-transform duration-300 ${
                  openIndex === idx ? 'transform rotate-180 text-astraea-pink' : ''
                }`} />
              </button>
              
              <div 
                className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === idx ? 'max-h-40 pb-5 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="text-astraea-darkgray/80 leading-relaxed border-t border-astraea-rosegold/10 pt-4">
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default FAQ;
