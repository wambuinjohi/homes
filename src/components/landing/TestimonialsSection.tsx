import { Quote } from "lucide-react";
import { PartnerLogosSection } from "./PartnerLogosSection";

const testimonials = [
  {
    quote: "Zira Homes has completely transformed how I manage my properties. The M-Pesa integration alone saves me hours every week.",
    author: "James Kamau",
    role: "Property Manager",
    location: "Nairobi",
    properties: "45 units"
  },
  {
    quote: "The tenant portal is a game-changer. My tenants love being able to see their invoices and payment history online.",
    author: "Mary Wanjiku",
    role: "Landlord",
    location: "Mombasa",
    properties: "12 units"
  },
  {
    quote: "Best investment I've made for my property business. Rent collection has never been easier. Highly recommend!",
    author: "Peter Ochieng",
    role: "Real Estate Investor",
    location: "Kisumu",
    properties: "80+ units"
  }
];

export function TestimonialsSection() {
  return (
    <section className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Testimonials
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Loved by Property Managers Across Kenya
          </h2>
          <p className="text-lg text-muted-foreground">
            See what our customers have to say about their experience with Zira Homes.
          </p>
        </div>
        
        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="bg-card rounded-2xl p-6 shadow-sm border border-border hover:shadow-lg transition-shadow"
            >
              {/* Quote Icon */}
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Quote className="w-5 h-5 text-primary" />
              </div>
              
              {/* Quote */}
              <blockquote className="text-foreground mb-6 leading-relaxed">
                "{testimonial.quote}"
              </blockquote>
              
              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold">
                  {testimonial.author.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="font-semibold text-foreground">
                    {testimonial.author}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role} • {testimonial.location}
                  </div>
                  <div className="text-xs text-primary font-medium">
                    {testimonial.properties}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Partner Logos - Now managed via admin panel */}
        <PartnerLogosSection />
      </div>
    </section>
  );
}
