import { UserPlus, Building2, Banknote, ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "Sign Up & Set Up",
    description: "Create your account in minutes. Add your properties, units, and import existing tenant data.",
    color: "bg-primary text-primary-foreground"
  },
  {
    number: "02",
    icon: Building2,
    title: "Add Properties & Tenants",
    description: "Configure your units, set rent amounts, and invite tenants to their self-service portal.",
    color: "bg-accent text-accent-foreground"
  },
  {
    number: "03",
    icon: Banknote,
    title: "Collect Rent Automatically",
    description: "Tenants pay via M-Pesa. Payments are matched and recorded automatically. Get paid faster!",
    color: "bg-success text-success-foreground"
  }
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
            How It Works
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Get Started in 3 Simple Steps
          </h2>
          <p className="text-lg text-muted-foreground">
            From sign-up to collecting your first rent payment in under 30 minutes.
          </p>
        </div>
        
        {/* Steps */}
        <div className="relative">
          {/* Connection line - desktop only */}
          <div className="hidden lg:block absolute top-24 left-1/2 -translate-x-1/2 w-2/3 h-0.5 bg-border" />
          
          <div className="grid lg:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                {/* Step Card */}
                <div className="bg-card rounded-2xl p-8 shadow-sm border border-border text-center relative z-10">
                  {/* Number badge */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-block px-4 py-1 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      Step {step.number}
                    </span>
                  </div>
                  
                  {/* Icon */}
                  <div className={`w-20 h-20 rounded-2xl ${step.color} flex items-center justify-center mx-auto mt-4 mb-6`}>
                    <step.icon className="w-10 h-10" />
                  </div>
                  
                  {/* Content */}
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {step.description}
                  </p>
                </div>
                
                {/* Arrow - mobile */}
                {index < steps.length - 1 && (
                  <div className="lg:hidden flex justify-center my-4">
                    <ArrowRight className="w-6 h-6 text-muted-foreground rotate-90" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
