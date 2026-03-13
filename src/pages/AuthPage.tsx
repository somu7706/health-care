import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { toast } from "sonner";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t("auth.welcomeToast"));
        navigate("/dashboard");
      }
    } else {
      const { error } = await signUp(email, password, name);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t("auth.accountCreated"));
        navigate("/dashboard");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/logo.webp" alt="VitalWave Logo" className="h-10 w-10 object-contain" />
            <span className="text-2xl font-bold">Vital<span className="text-primary">Wave</span></span>
          </Link>
          <h1 className="text-2xl font-bold">{isLogin ? t("auth.welcomeBack") : t("auth.createAccount")}</h1>
          <p className="text-muted-foreground mt-1">
            {isLogin ? t("auth.signIn") : t("auth.startJourney")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 border border-border rounded-xl p-6 bg-card">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="name">{t("auth.fullName")}</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("common.pleaseWait") : isLogin ? t("auth.signInBtn") : t("auth.createAccountBtn")}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? t("auth.noAccount") : t("auth.hasAccount")}{" "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary font-medium hover:underline">
            {isLogin ? t("auth.signUp") : t("auth.signInLink")}
          </button>
        </p>
      </div>
    </div>
  );
}
