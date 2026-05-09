import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Play, Building2, Users, CreditCard } from "lucide-react";
import { useLandingSettings } from "@/hooks/useLandingSettings";
import heroImage from "@/assets/hero-landlord-new.png";

export function HeroSection() {
  const { trialDays } = useLandingSettings();

  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
      
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Trusted by 100+ Property Managers in Kenya
            </div>
            
            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Property Management{" "}
              <span className="text-primary">Made Simple</span>
            </h1>
            
            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-muted-foreground max-w-lg">
              Streamline rent collection with M-Pesa integration, automate invoicing, 
              and manage tenants effortlessly. All in one powerful platform.
            </p>
            
            {/* Key benefits */}
            <div className="flex flex-col sm:flex-row gap-4">
              {[
                "Automated Rent Collection",
                "Real-time M-Pesa Payments",
                "Tenant Portal Included"
              ].map((benefit) => (
                <div key={benefit} className="flex items-center gap-2 text-foreground">
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                  <span className="text-sm font-medium">{benefit}</span>
                </div>
              ))}
            </div>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/auth">
                <Button size="lg" className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-8 py-6">
                  Start Free {trialDays}-Day Trial
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 py-6">
                <Play className="mr-2 w-5 h-5" />
                Watch Demo
              </Button>
            </div>
            
            {/* Trust text */}
            <p className="text-sm text-muted-foreground">
              No credit card required • Cancel anytime • Free setup assistance
            </p>
          </div>
          
          {/* Right Content */}
          <div className="relative lg:pl-8 flex flex-col gap-6">
            {/* Hero Image Container */}
            <div className="rounded-2xl overflow-hidden shadow-2xl border">
              <img 
                src={heroImage} 
                alt="Property management dashboard" 
                className="w-full h-auto object-cover"
              />
            </div>
            
            {/* Stats Row - 3 Cards */}
            <div className="grid grid-cols-3 gap-4">
              {/* Card 1: 500+ Properties */}
              <div className="bg-card rounded-xl p-4 shadow-lg border text-center">
                <Building2 className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">500+</p>
                <p className="text-xs text-muted-foreground">Properties</p>
              </div>
              
              {/* Card 2: 10,000+ Tenants */}
              <div className="bg-card rounded-xl p-4 shadow-lg border text-center">
                <Users className="w-6 h-6 text-success mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">10,000+</p>
                <p className="text-xs text-muted-foreground">Tenants</p>
              </div>
              
              {/* Card 3: KES 150M+ Rent/Month */}
              <div className="bg-card rounded-xl p-4 shadow-lg border text-center">
                <CreditCard className="w-6 h-6 text-accent mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">KES 150M+</p>
                <p className="text-xs text-muted-foreground">Rent/Month</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
