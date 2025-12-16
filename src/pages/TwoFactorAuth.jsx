
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Mail, RefreshCw, Loader2, AlertCircle, CheckCircle } from "lucide-react";

export default function TwoFactorAuth() {
  const [user, setUser] = useState(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    initializeTwoFactor();
  }, []);

  const initializeTwoFactor = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Check if 2FA is enabled
      if (!currentUser.two_fa_enabled) {
        // If 2FA is not enabled, redirect to Dashboard
        navigate(createPageUrl("Dashboard"));
        return;
      }

      // Send initial code
      await sendCode();
    } catch (error) {
      console.error("Error initializing 2FA:", error);
      base44.auth.redirectToLogin("/TwoFactorAuth");
    } finally {
      setIsInitializing(false);
    }
  };

  const sendCode = async () => {
    setSending(true);
    setError("");
    setSuccess("");
    
    try {
      const response = await base44.functions.invoke('generate2FACode', {});
      
      if (response.data.success) {
        setCodeSent(true);
        setSuccess(response.data.message);
      } else {
        setError(response.data.error || 'Er is iets misgegaan');
      }
    } catch (error) {
      console.error('Error sending code:', error);
      setError('Kon geen code versturen. Probeer het opnieuw.');
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    
    if (!code || code.length !== 6) {
      setError('Voer een geldige 6-cijferige code in');
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await base44.functions.invoke('verify2FACode', { code });
      
      if (response.data.success) {
        setSuccess('Verificatie succesvol! Je wordt doorgestuurd...');
        
        // Store session ID in sessionStorage for this session
        sessionStorage.setItem('2fa_session_id', response.data.session_id);
        
        // Use window.location.href to force full page reload (ensures user object is refreshed)
        setTimeout(() => {
          window.location.href = createPageUrl("Dashboard");
        }, 1000);
      } else {
        setError(response.data.error || 'Ongeldige code');
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      setError('Verificatie mislukt. Probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setCode("");
    await sendCode();
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-none shadow-2xl">
        <CardHeader className="text-center border-b border-gray-100 pb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Twee-Factor Authenticatie
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Voer de 6-cijferige code in die naar je email is gestuurd
          </p>
        </CardHeader>

        <CardContent className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {codeSent && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-700 font-medium">Code verzonden!</p>
                <p className="text-xs text-blue-600 mt-1">
                  Controleer je inbox op {user?.email}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <Label htmlFor="code" className="text-sm font-medium text-gray-700">
                Verificatiecode
              </Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="mt-2 text-center text-2xl tracking-widest font-mono"
                autoFocus
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-2">
                De code is 10 minuten geldig
              </p>
            </div>

            <div className="space-y-3">
              <Button
                type="submit"
                disabled={loading || !code || code.length !== 6}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifiëren...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Verifiëren
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleResendCode}
                disabled={sending}
                className="w-full"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verzenden...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Nieuwe Code Aanvragen
                  </>
                )}
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Geen code ontvangen? Controleer je spam folder of vraag een nieuwe code aan
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
