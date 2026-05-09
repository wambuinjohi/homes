import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLandingSettings } from "@/hooks/useLandingSettings";

const getfaqs = (trialDays: number) => [
  {
    question: "How does the M-Pesa integration work?",
    answer: "Once you set up your M-Pesa Paybill or Till Number in the system, tenants can pay rent directly through M-Pesa. Payments are automatically matched to the correct tenant and invoice using the account reference. You'll see payments reflected in real-time on your dashboard."
  },
  {
    question: "Is there a free trial?",
    answer: `Yes! All plans come with a ${trialDays}-day free trial. No credit card required. You get full access to all features during the trial period so you can fully evaluate the platform.`
  },
  {
    question: "Can tenants see their own invoices and payment history?",
    answer: "Absolutely. Each tenant gets access to their own portal where they can view invoices, payment history, submit maintenance requests, and receive notifications. This reduces the number of inquiries you receive."
  },
  {
    question: "How secure is my data?",
    answer: "We use bank-level encryption (256-bit SSL) for all data transmission and storage. Your data is hosted on secure servers with regular backups. We never share your information with third parties."
  },
  {
    question: "Can I manage multiple properties?",
    answer: "Yes! Zira Homes is designed for property managers with multiple properties. You can organize units by property, block, and floor. The dashboard gives you a unified view across all your properties."
  },
  {
    question: "What payment methods do you accept for subscriptions?",
    answer: "We accept M-Pesa for subscription payments. Simply pay via our Paybill number. We're also working on adding card payments soon."
  },
  {
    question: "Can I import my existing tenant data?",
    answer: "Yes! We provide a bulk import feature that lets you upload tenant data from Excel or CSV files. Our team can also help you with the initial data migration at no extra cost."
  },
  {
    question: "What kind of support do you offer?",
    answer: "All plans include email support. Professional and Enterprise plans get priority support with faster response times. We also have a comprehensive knowledge base and regular webinars."
  }
];

export function FAQSection() {
  const { trialDays } = useLandingSettings();
  const faqs = getfaqs(trialDays);
  
  return (
    <section id="faq" className="py-20 bg-secondary/50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
            FAQ
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-muted-foreground">
            Got questions? We've got answers.
          </p>
        </div>
        
        {/* FAQ Accordion */}
        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem 
              key={index} 
              value={`faq-${index}`}
              className="bg-card rounded-xl border border-border px-6 data-[state=open]:shadow-md transition-shadow"
            >
              <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline py-4">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        
        {/* Contact CTA */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            Still have questions?{" "}
            <a href="mailto:support@zirahomes.com" className="text-primary hover:underline font-medium">
              Contact our support team
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
