import React, { useState } from "react";
import { 
  signInWithEmailAndPassword 
} from "firebase/auth";
import { auth } from "../firebase";
import { LogIn, Ship, Lock, Mail, AlertTriangle } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (userEmail: string, isOffline?: boolean) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Por favor, preencha todos os campos.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve conter no mínimo 6 caracteres.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Sign in only, registration is disabled on the frontend
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      onLoginSuccess(userCredential.user.email || email, false);
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/operation-not-allowed") {
        setError(
          "O provedor 'E-mail/Senha' está desativado no Firebase Console. Entre em contato com o administrador."
        );
      } else if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Acesso negado: E-mail ou senha incorretos ou usuário não cadastrado.");
      } else if (err.code === "auth/invalid-email") {
        setError("Formato de e-mail inválido.");
      } else {
        setError("Erro ao autenticar. Detalhes: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] items-center justify-center p-4">
      <div className="w-full max-w-sm overflow-hidden rounded border border-slate-200 bg-white shadow-md">
        {/* Header / Brand */}
        <div className="bg-[#1e293b] p-6 text-center text-white border-b border-slate-700">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded bg-blue-500 font-extrabold text-white text-lg">
            ⚓
          </div>
          <h1 className="text-sm font-extrabold tracking-wider uppercase">LogiStock</h1>
          <p className="mt-1 text-[10px] text-slate-400 uppercase tracking-widest font-mono">
            Terminal de Bobinas v2.4
          </p>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Autenticação Requerida
            </h2>
          </div>

          {error && (
            <div className="p-3 rounded text-xs bg-red-50 text-red-700 border border-red-100 flex items-start gap-2">
              <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-red-500 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                E-mail Corporativo
              </label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  placeholder="ex: usuario@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded border border-slate-300 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  placeholder="Sua senha secreta"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded border border-slate-300 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-slate-800 hover:bg-black text-white text-xs font-bold uppercase rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <LogIn className="h-3.5 w-3.5" />
                  Acessar Painel
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Credit */}
        <div className="bg-slate-50 py-2.5 border-t border-slate-150 text-center">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
            SISTEMA INTEGRADO DE DESCARGA
          </span>
        </div>
      </div>
    </div>
  );
}
