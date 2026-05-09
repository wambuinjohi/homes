import { 
  Building2, 
  Users, 
  CreditCard, 
  FileText, 
  Wrench, 
  BarChart3,
  Bell,
  Shield,
  Smartphone
} from "lucide-react";

const features = [
  {
    icon: Building2,
    title: "Property & Unit Management",
    description: "Organize properties by blocks, floors, and units. Track occupancy rates and manage multiple properties from one dashboard.",
    color: "bg-primary/10 text-primary"
  },
  {
    icon: Users,
    title: "Tenant Management & Portal",
    description: "Complete tenant profiles with lease history. Self-service portal for tenants to view invoices and make payments.",
    color: "bg-success/10 text-success"
  },
  {
    icon: CreditCard,
    title: "M-Pesa Payment Integration",
    description: "Accept rent payments via M-Pesa Paybill or Till Number. Automatic payment matching and reconciliation.",
    color: "bg-accent/10 text-accent"
  },
  {
    icon: FileText,
    title: "Automated Invoicing",
    description: "Generate and send invoices automatically. Set up recurring billing and send payment reminders via SMS.",
    color: "bg-card-purple/10 text-[hsl(291,64%,42%)]"
  },
  {
    icon: Wrench,
    title: "Maintenance Tracking",
    description: "Tenants submit requests online. Track status, assign workers, and maintain complete service history.",
    color: "bg-warning/10 text-warning"
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    description: "Real-time insights on rent collection, occupancy, and expenses. Export reports in PDF or Excel format.",
    color: "bg-destructive/10 text-destructive"
  },
  {
    icon: Bell,
    title: "SMS & Email Notifications",
    description: "Automated reminders for rent due dates, overdue payments, and maintenance updates.",
    color: "bg-primary/10 text-primary"
  },
  {
    icon: Shield,
    title: "Secure & Reliable",
    description: "Bank-level encryption for all data. Regular backups and 99.9% uptime guarantee.",
    color: "bg-success/10 text-success"
  },
  {
    icon: Smartphone,
    title: "Mobile Friendly",
    description: "Access your dashboard anywhere. Fully responsive design works on all devices.",
    color: "bg-accent/10 text-accent"
  }
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-secondary/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Features
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Everything You Need to Manage Properties
          </h2>
          <p className="text-lg text-muted-foreground">
            Powerful tools designed specifically for Kenyan property managers and landlords.
          </p>
        </div>
        
        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="group bg-card rounded-2xl p-6 shadow-sm border border-border hover:shadow-lg hover:border-primary/20 transition-all duration-300"
            >
              <div className={`w-14 h-14 rounded-xl ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
