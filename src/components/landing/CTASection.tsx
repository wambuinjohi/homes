import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useLandingSettings } from "@/hooks/useLandingSettings";

export function CTASection() {
  const { trialDays } = useLandingSettings();
  
  return (
    <section className="py-20 bg-primary relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
          Ready to Simplify Your Property Management?
        </h2>
        
        <p className="text-lg sm:text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
          Join hundreds of property managers who are saving time, collecting rent faster, 
          and growing their portfolios with Zira Homes.
        </p>
        
        {/* Benefits */}
        <div className="flex flex-wrap justify-center gap-6 mb-10">
          {[
            `${trialDays}-day free trial`,
            "No credit card required",
            "Cancel anytime"
          ].map((benefit) => (
            <div key={benefit} className="flex items-center gap-2 text-primary-foreground">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>
        
        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/auth">
            <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-8 py-6">
              Start Your Free Trial
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
          <Link to="/auth">
            <Button size="lg" variant="outline" className="bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 text-lg px-8 py-6">
              Schedule a Demo
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
