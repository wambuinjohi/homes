import React, { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Building2, AlertCircle, CheckCircle, CreditCard, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import apartmentBuilding from "@/assets/apartment-building.jpg";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

const Auth = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Persist last signup email to enable resending confirmation even after clearing the form
  const [lastSignupEmail, setLastSignupEmail] = useState<string>("");
  const [resendLoading, setResendLoading] = useState(false);

  // Controlled tabs and helpful UX states
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [existingAccountEmail, setExistingAccountEmail] = useState<string | null>(null);
  const [loginEmailSuggestion, setLoginEmailSuggestion] = useState<string | null>(null);
  const [signupEmailSuggestion, setSignupEmailSuggestion] = useState<string | null>(null);

  // Simple email typo suggestions for common domains
  const getEmailSuggestion = (email: string): string | null => {
    const lower = (email || '').toLowerCase().trim();
    if (!lower.includes('@')) return null;
    const [local, domainRaw] = lower.split('@');
    if (!domainRaw) return null;
    let domain = domainRaw.replace(/[,;]+/g, '.').replace(/\s+/g, '');

    // Common corrections
    const fixes: Record<string, string> = {
      'gmailicom': 'gmail.com',
      'gmail.con': 'gmail.com',
      'gamil.com': 'gmail.com',
      'gnail.com': 'gmail.com',
      'gmal.com': 'gmail.com',
      'gmailcom': 'gmail.com',
      'yahoo.con': 'yahoo.com',
      'yahooo.com': 'yahoo.com',
      'yaho.com': 'yahoo.com',
      'yhoo.com': 'yahoo.com',
      'outlok.com': 'outlook.com',
      'outlook.con': 'outlook.com',
      'hotmail.con': 'hotmail.com',
      'iclod.com': 'icloud.com',
      'icloud.con': 'icloud.com'
    };

    if (fixes[domain]) {
      return `${local}@${fixes[domain]}`;
    }

    // Missing dot before TLD pattern like gmailcom, outlookcom
    const missingDotMatch = domain.match(/^(gmail|yahoo|outlook|hotmail|icloud)(com)$/);
    if (missingDotMatch) {
      return `${local}@${missingDotMatch[1]}.com`;
    }

    return null;
  };

  // Check if we're in password reset mode using URL params or auth state
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hasRecoveryParam = urlParams.get('type') === 'recovery' || hashParams.get('type') === 'recovery';
    const hasAccessToken = hashParams.get('access_token');
    const hasRefreshToken = hashParams.get('refresh_token');
    const hasErrorDescription = hashParams.get('error_description');
    
    // Debug logging
    console.log('Current URL:', window.location.href);
    console.log('URL params:', window.location.search);
    console.log('Hash params:', window.location.hash);
    console.log('Has access token:', !!hasAccessToken);
    console.log('Has refresh token:', !!hasRefreshToken);
    console.log('Error description:', hasErrorDescription);
    
    // If user came from password reset email with valid tokens, show reset form
    if (hasAccessToken && hasRefreshToken && !hasErrorDescription) {
      console.log('Valid password reset tokens detected - showing password reset form');
      setIsPasswordReset(true);
      return;
    }
    
    // If user manually navigated with type=recovery, show reset form
    if (hasRecoveryParam) {
      console.log('Manual recovery param found - showing password reset form');
      setIsPasswordReset(true);
    }
  }, []);

  // Restore last signup email from localStorage and keep it up to date
  useEffect(() => {
    const saved = localStorage.getItem('lastSignupEmail');
    if (saved) setLastSignupEmail(saved);
  }, []);

  useEffect(() => {
    if (lastSignupEmail) {
      localStorage.setItem('lastSignupEmail', lastSignupEmail);
    }
  }, [lastSignupEmail]);

  // Login form state
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  // Signup form state
  const [signupData, setSignupData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    phone: "",
    role: "Landlord" as "Landlord" | "Tenant",
    accountType: "landlord" as "landlord" | "agency",
  });

  const normalizePhoneForSignup = (phone: string): string | null => {
    const trimmed = (phone || "").replace(/\s+/g, "");
    if (!trimmed) {
      return "+254700000000";
    }

    if (/^\+[1-9]\d{7,14}$/.test(trimmed)) {
      return trimmed;
    }

    if (/^0\d{8,14}$/.test(trimmed)) {
      return `+254${trimmed.slice(1)}`;
    }

    if (/^[1-9]\d{7,14}$/.test(trimmed)) {
      return `+254${trimmed}`;
    }

    return null;
  };

  // Show password reset form if in recovery mode
  if (isPasswordReset) {
    return (
      <ResetPasswordForm 
        onSuccess={() => {
          window.location.href = '/';
        }}
        onCancel={() => {
          window.location.href = '/auth';
        }}
      />
    );
  }

  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setError("Invalid email or password. Please check your credentials and try again.");
        } else if (error.message.includes("Email not confirmed")) {
          setError("Please check your email and click the confirmation link before signing in.");
        } else {
          setError(error.message);
        }
        return;
      }

      toast({
        title: "Welcome back!",
        description: "You have been successfully logged in.",
      });
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    // Validation
    if (signupData.password !== signupData.confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    if (signupData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setIsLoading(false);
      return;
    }

    try {
      const redirectUrl = `${window.location.origin}/`;
      console.log("Signup: creating user", signupData.email, "redirect:", redirectUrl);

      const normalizedPhone = normalizePhoneForSignup(signupData.phone);
      if (!normalizedPhone) {
        setError("Please enter a valid phone number in international format, for example +254712345678.");
        setIsLoading(false);
        return;
      }

      const metadata = {
        first_name: signupData.firstName.trim(),
        last_name: signupData.lastName.trim(),
        phone: normalizedPhone,
        role: signupData.role,
        account_type: signupData.accountType,
      } as const;

      const { error } = await supabase.auth.signUp({
        email: signupData.email.trim(),
        password: signupData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: metadata,
        },
      });

      if (error) {
        console.error('Signup error details:', {
          message: error.message,
          status: error.status,
          name: error.name,
          email: signupData.email
        });
        
        // Provide specific error messages
        if (error.message.includes("User already registered")) {
          setExistingAccountEmail(signupData.email);
          setActiveTab('login');
          setLoginData((prev) => ({ ...prev, email: signupData.email }));
          setError("An account with this email already exists. You can sign in, reset your password, or resend confirmation below.");
        } else if (error.message.includes("Database error") || error.message.includes("profile") || error.message.includes("handle_new_user")) {
          setError("We encountered an issue creating your account. Our team has been notified. Please try again in a few moments, or contact support if the issue persists.");
        } else if (error.message.includes("Invalid phone")) {
          setError("Please enter a valid phone number in international format (e.g., +254712345678).");
        } else if (error.message.includes("Failed to create")) {
          setError("Account creation failed due to a technical issue. Please try again or contact support.");
        } else {
          setError(error.message || "An unexpected error occurred. Please try again.");
        }
        return;
      }

      // Save email so user can resend confirmation later
      setLastSignupEmail(signupData.email);

      setSuccess(`Account created for ${signupData.email}. Please check your inbox at ${signupData.email} for a confirmation email from support@ziratech.com. If you can't find it, check Updates/Promotions or Spam/Junk and mark it as 'Not spam'.`);
      
      // Clear form fields but keep lastSignupEmail for resend
      setSignupData({
        email: "",
        password: "",
        confirmPassword: "",
        firstName: "",
        lastName: "",
        phone: "",
        role: "Landlord",
        accountType: "landlord",
      });

      toast({
        title: "Account created!",
        description: `Confirmation sent to ${signupData.email}. From support@ziratech.com. Check Inbox, Updates/Promotions, or Spam/Junk.`,
      });
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Signup error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (email: string) => {
    if (!email || !email.trim()) {
      setError("Please enter your email address first");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");
    
    try {
      const { data, error } = await supabase.functions.invoke('send-password-reset', {
        body: {
          email: email,
          redirectTo: `${window.location.origin}/auth?type=recovery`
        }
      });

      if (error) {
        throw error;
      }

      const result = data;
      
      if (result.success) {
        const disclaimer = " If you can't find it, check your Spam/Junk or Updates/Promotions tabs and mark it as 'Not spam'.";
        setSuccess(result.message + disclaimer);
        toast({
          title: "Password Reset Sent",
          description: result.message + disclaimer,
        });
        
        // Close the reset form and clear the email
        setShowResetForm(false);
        setResetEmail("");
      } else {
        setError(result.message || "Failed to send password reset");
        toast({
          title: "Error",
          description: result.message || "Failed to send password reset",
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error("Password reset error:", error);
      const errorMessage = error.message || "Failed to send reset email. Please try again.";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
  } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async (email: string) => {
    let targetEmail = (email || '').trim();
    if (!targetEmail) {
      const prompted = window.prompt('Enter your signup email to resend the confirmation link:') || '';
      targetEmail = prompted.trim();
    }
    if (!targetEmail) {
      setError('Please provide a valid email address to resend the confirmation link.');
      return;
    }

    setResendLoading(true);
    setError('');
    setSuccess('');

    try {
      const redirectUrl = `${window.location.origin}/`;
      console.log('Resend: sending confirmation', { email: targetEmail, redirectUrl });
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: { emailRedirectTo: redirectUrl }
      });
      if (error) {
        console.error('Resend error:', error);
        setError(error.message);
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      setLastSignupEmail(targetEmail);
      const msg = `A new confirmation email was sent to ${targetEmail} from support@ziratech.com. If it's not in your Inbox, check Updates/Promotions or Spam/Junk and mark it as 'Not spam'.`;
      setSuccess(msg);
      toast({ title: 'Confirmation resent', description: msg });
    } catch (err) {
      console.error('Resend confirmation error:', err);
      setError('Failed to resend confirmation. Please try again.');
      toast({ title: 'Error', description: 'Failed to resend confirmation. Please try again.', variant: 'destructive' });
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex">
      {/* Left Side - Elevator Pitch */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-12 flex-col justify-center relative overflow-hidden">
        {/* Background Apartment Building Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${apartmentBuilding})` }}
        ></div>
        
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-32 h-32 bg-white rounded-full"></div>
          <div className="absolute bottom-32 right-16 w-24 h-24 bg-accent rounded-full"></div>
          <div className="absolute top-1/2 right-32 w-16 h-16 bg-white rounded-full"></div>
        </div>
        
        <div className="relative z-10 text-white space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <img 
                  src="/lovable-uploads/5143fc86-0273-406f-b5f9-67cc9d4bc7f6.png" 
                  alt="Zira Homes Logo" 
                  className="w-8 h-8 object-contain"
                />
              </div>
              <h1 className="text-3xl font-bold">Zira Homes</h1>
            </div>
            
            <h2 className="text-4xl font-bold leading-tight">
              Property Management
              <span className="block text-accent">Made Simple</span>
            </h2>
            
            <p className="text-xl text-primary-foreground/90 leading-relaxed">
              Streamline your property portfolio with our comprehensive platform designed for landlords, agents, and property managers.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Smart Property Management</h3>
                <p className="text-primary-foreground/80">Track properties, units, and tenant information in one central location</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Payment Tracking</h3>
                <p className="text-primary-foreground/80">Monitor payments, generate invoices, and track financial performance</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Multi-User Access</h3>
                <p className="text-primary-foreground/80">Collaborate with property managers, agents, and tenants seamlessly</p>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/20">
            <p className="text-primary-foreground/70 text-sm">
              Trusted by property professionals across Kenya and beyond
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Authentication */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center border border-primary/20">
              <img 
                src="/lovable-uploads/5143fc86-0273-406f-b5f9-67cc9d4bc7f6.png" 
                alt="Zira Homes Logo" 
                className="w-10 h-10 object-contain"
              />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                Zira Homes
              </h1>
              <p className="text-gray-600 mt-2">
                Sign in to manage your properties
              </p>
            </div>
          </div>

          <Card className="shadow-xl border-0 bg-white/95 backdrop-blur-sm">
            <CardHeader className="space-y-2 pb-6 text-center">
              <CardTitle className="text-2xl text-gray-800">Welcome Back</CardTitle>
              <p className="text-gray-600">Choose your preferred sign-in method</p>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 bg-primary/5 p-1">
                  <TabsTrigger 
                    value="login" 
                    className="data-[state=active]:bg-white data-[state=active]:text-accent data-[state=active]:shadow-sm"
                  >
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger 
                    value="signup" 
                    className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
                  >
                    Sign Up
                  </TabsTrigger>
                </TabsList>

              {/* Error/Success Messages */}
              {error && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              )}
              
              {success && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">{success}</AlertDescription>
                </Alert>
              )}

              {existingAccountEmail && (
                <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-gray-700">
                  <p className="mb-2">Quick actions for {existingAccountEmail}:</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setActiveTab('login')}>Go to Sign In</Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowResetForm(true); setResetEmail(existingAccountEmail); }}>Forgot password</Button>
                    <Button size="sm" variant="outline" onClick={() => handleResendConfirmation(existingAccountEmail!)}>Resend confirmation</Button>
                  </div>
                </div>
              )}

              {/* Login Tab */}
              <TabsContent value="login" className="space-y-5">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-gray-700 font-medium">Email Address</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="Enter your email"
                        value={loginData.email}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLoginData({ ...loginData, email: val });
                          setLoginEmailSuggestion(getEmailSuggestion(val));
                        }}
                        className="h-12 border-gray-200 focus:border-primary focus:ring-primary"
                        required
                      />
                      {loginEmailSuggestion && (
                        <p className="text-xs text-gray-600">
                          Did you mean {""}
                          <button
                            type="button"
                            className="underline text-primary"
                            onClick={() => {
                              setLoginData({ ...loginData, email: loginEmailSuggestion! });
                              setLoginEmailSuggestion(null);
                            }}
                          >
                            {loginEmailSuggestion}
                          </button>
                          ?
                        </p>
                      )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-gray-700 font-medium">Password</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={loginData.password}
                        onChange={(e) =>
                          setLoginData({ ...loginData, password: e.target.value })
                        }
                        className="h-12 border-gray-200 focus:border-primary focus:ring-primary pr-12"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>

                  {/* Forgot Password Link */}
                  <div className="text-center pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-600 mb-3">Trouble signing in?</p>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowResetForm(true)}
                      className="text-primary hover:text-primary/80 hover:bg-primary/5 text-sm"
                      disabled={isLoading}
                    >
                      Reset Password
                    </Button>
                  </div>
                </form>
              </TabsContent>

              {/* Signup Tab */}
              <TabsContent value="signup" className="space-y-5">
                <form onSubmit={handleSignup} className="space-y-4">
                  {/* Account Type Selection */}
                  <div className="space-y-2">
                    <Label className="text-gray-700 font-medium">I am a...</Label>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => setSignupData({ ...signupData, accountType: "landlord" })}
                        className={`p-4 border-2 rounded-lg text-left transition-all ${
                          signupData.accountType === "landlord"
                            ? "border-primary bg-primary/5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Building2 className={`w-5 h-5 ${signupData.accountType === "landlord" ? "text-primary" : "text-gray-400"}`} />
                          <div>
                            <span className="text-sm font-medium">Landlord / Property Owner</span>
                            <p className="text-xs text-gray-500 mt-1">I manage my own properties</p>
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSignupData({ ...signupData, accountType: "agency" })}
                        className={`p-4 border-2 rounded-lg text-left transition-all ${
                          signupData.accountType === "agency"
                            ? "border-primary bg-primary/5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Users className={`w-5 h-5 ${signupData.accountType === "agency" ? "text-primary" : "text-gray-400"}`} />
                          <div>
                            <span className="text-sm font-medium">Property Management Agency</span>
                            <p className="text-xs text-gray-500 mt-1">I manage properties for multiple clients</p>
                          </div>
                        </div>
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {signupData.accountType === "agency" 
                        ? "Agencies get team management features and multi-client support."
                        : "Landlords get streamlined tools for managing their own portfolio."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-firstname" className="text-gray-700 font-medium">First Name</Label>
                      <Input
                        id="signup-firstname"
                        placeholder="John"
                        value={signupData.firstName}
                        onChange={(e) =>
                          setSignupData({ ...signupData, firstName: e.target.value })
                        }
                        className="h-11 border-gray-200 focus:border-primary focus:ring-primary"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-lastname" className="text-gray-700 font-medium">Last Name</Label>
                      <Input
                        id="signup-lastname"
                        placeholder="Doe"
                        value={signupData.lastName}
                        onChange={(e) =>
                          setSignupData({ ...signupData, lastName: e.target.value })
                        }
                        className="h-11 border-gray-200 focus:border-primary focus:ring-primary"
                        required
                      />
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-500 mt-2 w-full">
                    Note: Tenant accounts are created by landlords or property managers. If you're a tenant, contact your landlord for login credentials.
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-gray-700 font-medium">Email Address</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="john@example.com"
                      value={signupData.email}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSignupData({ ...signupData, email: val });
                        setSignupEmailSuggestion(getEmailSuggestion(val));
                        setExistingAccountEmail(null);
                      }}
                      className="h-12 border-gray-200 focus:border-primary focus:ring-primary"
                      required
                    />
                    {signupEmailSuggestion && (
                      <p className="text-xs text-gray-600">
                        Did you mean {""}
                        <button
                          type="button"
                          className="underline text-primary"
                          onClick={() => {
                            setSignupData({ ...signupData, email: signupEmailSuggestion! });
                            setSignupEmailSuggestion(null);
                          }}
                        >
                          {signupEmailSuggestion}
                        </button>
                        ?
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-phone" className="text-gray-700 font-medium">Phone (Optional)</Label>
                    <Input
                      id="signup-phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={signupData.phone}
                      onChange={(e) =>
                        setSignupData({ ...signupData, phone: e.target.value })
                      }
                      className="h-12 border-gray-200 focus:border-primary focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-gray-700 font-medium">Password</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        value={signupData.password}
                        onChange={(e) =>
                          setSignupData({ ...signupData, password: e.target.value })
                        }
                        className="h-12 border-gray-200 focus:border-primary focus:ring-primary pr-12"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Must be at least 6 characters long
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password" className="text-gray-700 font-medium">Confirm Password</Label>
                    <Input
                      id="signup-confirm-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={signupData.confirmPassword}
                      onChange={(e) =>
                        setSignupData({ ...signupData, confirmPassword: e.target.value })
                      }
                      className="h-12 border-gray-200 focus:border-primary focus:ring-primary"
                      required
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const emailToUse = signupData.email || lastSignupEmail || window.prompt('Enter your signup email to resend the confirmation link:') || '';
                        handleResendConfirmation(emailToUse);
                      }}
                      className="text-sm text-primary hover:underline disabled:opacity-50 inline-flex items-center"
                      disabled={isLoading || resendLoading}
                      aria-label="Resend confirmation email"
                    >
                      {resendLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                      Didn't receive the email? Resend confirmation
                    </button>
                    <p className="mt-2 text-xs text-gray-500">
                      Sender: support@ziratech.com
                    </p>
                  </div>
                </form>
              </TabsContent>
            </Tabs>

            {/* Password Reset Modal */}
            {showResetForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                  onClick={() => setShowResetForm(false)}
                ></div>
                
                {/* Modal Content */}
                <Card className="relative z-10 w-full max-w-md mx-4 shadow-2xl border-0 bg-white">
                  <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-xl text-gray-800">Reset Password</CardTitle>
                    <p className="text-sm text-gray-600">
                      Enter your email address and we'll send you a link to reset your password.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleForgotPassword(resetEmail);
                      }} 
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="reset-email" className="text-gray-700 font-medium">
                          Email Address
                        </Label>
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="Enter your email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="h-12 border-gray-200 focus:border-primary focus:ring-primary"
                          required
                        />
                      </div>

                      <div className="flex gap-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowResetForm(false);
                            setResetEmail("");
                            setError("");
                            setSuccess("");
                          }}
                          className="flex-1"
                          disabled={isLoading}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-white"
                          disabled={isLoading}
                        >
                          {isLoading ? "Sending..." : "Send Reset Link"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  </div>
  );
};

export default Auth;
