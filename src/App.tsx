import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "./firebase";
import { EstoquePrevisto, EstoqueRecebido } from "./types";
import Login from "./components/Login";
import Lancamento from "./components/Lancamento";
import Dashboard from "./components/Dashboard";
import TabelaGerenciador from "./components/TabelaGerenciador";
import { 
  LogOut, 
  Ship, 
  Package, 
  BarChart3, 
  RefreshCw, 
  User,
  ExternalLink,
  Database
} from "lucide-react";

export default function App() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const isOffline = false; // System simulation disabled, always online
  const [activeTab, setActiveTab] = useState<"lancamento" | "dashboard" | "banco">("lancamento");
  
  // Data State
  const [estoquePrevisto, setEstoquePrevisto] = useState<EstoquePrevisto[]>([]);
  const [estoqueRecebido, setEstoqueRecebido] = useState<EstoqueRecebido[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Helper to fetch online data
  const fetchData = async () => {
    setLoadingData(true);
    try {
      // Online Fetch
      const previstoList: EstoquePrevisto[] = [];
      const previstoSnap = await getDocs(collection(db, "estoque_previsto"));
      previstoSnap.forEach(doc => {
        previstoList.push(doc.data() as EstoquePrevisto);
      });
      setEstoquePrevisto(previstoList);
      localStorage.setItem("local_estoque_previsto", JSON.stringify(previstoList));

      const recebidoList: EstoqueRecebido[] = [];
      const recebidoSnap = await getDocs(collection(db, "estoque_recebido"));
      recebidoSnap.forEach(doc => {
        recebidoList.push(doc.data() as EstoqueRecebido);
      });
      setEstoqueRecebido(recebidoList);
      localStorage.setItem("local_estoque_recebido", JSON.stringify(recebidoList));
    } catch (error) {
      console.error("Error fetching collections: ", error);
    } finally {
      setLoadingData(false);
    }
  };

  // 1. Observe Authentication State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          setUserEmail(user.email);
          localStorage.setItem("isOfflineMode", "false");
          localStorage.setItem("loggedInUserEmail", user.email || "");
          
          // Fetch stock lists
          await fetchData();
        } else {
          setUserEmail(null);
          setEstoquePrevisto([]);
          setEstoqueRecebido([]);
        }
      } catch (err) {
        console.error("Auth observer error: ", err);
      } finally {
        setAuthChecked(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = (email: string) => {
    setUserEmail(email);
    localStorage.setItem("isOfflineMode", "false");
    localStorage.setItem("loggedInUserEmail", email);
    fetchData();
  };

  // 3. Handle Logout
  const handleLogout = async () => {
    try {
      localStorage.removeItem("isOfflineMode");
      localStorage.removeItem("loggedInUserEmail");
      await signOut(auth);
      setUserEmail(null);
    } catch (error) {
      console.error("Logout error: ", error);
    }
  };

  // Loading Screen during initialization
  if (!authChecked) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600 border border-blue-100">
            <Ship className="h-9 w-9 animate-bounce" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Iniciando Terminal</h3>
            <p className="text-xs text-slate-400 font-mono">Conectando ao banco de dados...</p>
          </div>
          <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  // Login Screen if not authenticated
  if (!userEmail) {
    return (
      <main className="min-h-screen bg-slate-50 font-sans antialiased text-slate-900">
        <Login onLoginSuccess={handleLoginSuccess} />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-[#f8f9fa] font-sans antialiased text-slate-800">
      
      {/* Top Banner Navigation Bar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 py-3 bg-[#1e293b] text-white border-b border-slate-700 shrink-0 gap-3">
        
        {/* Top brand row & user actions on mobile */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center font-extrabold text-white shrink-0">
              ⚓
            </div>
            <h1 className="text-sm md:text-base font-semibold tracking-tight uppercase">
              LogiStock <span className="text-slate-400 font-normal">| Receiver v2.4</span>
              {isOffline && (
                <span className="ml-2 px-1.5 py-0.5 text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded uppercase font-bold font-mono tracking-wider">
                  Simulador Local
                </span>
              )}
            </h1>
          </div>

          {/* Quick profile / sync buttons for mobile */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => fetchData()}
              disabled={loadingData}
              className="p-2.5 rounded bg-slate-800 text-slate-300 active:bg-slate-700 hover:text-white transition-colors cursor-pointer"
              title="Sincronizar dados"
            >
              <RefreshCw className={`h-4 w-4 ${loadingData ? "animate-spin text-blue-400" : ""}`} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2.5 rounded bg-slate-800 text-red-400 active:bg-slate-700 hover:text-red-500 transition-colors cursor-pointer"
              title="Sair do sistema"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main Tabs Selection - Fully responsive, scrollable or split equally on mobile */}
        <nav className="grid grid-cols-3 md:flex gap-1 md:gap-6 text-xs md:text-sm font-medium w-full md:w-auto bg-slate-800/40 md:bg-transparent p-1 md:p-0 rounded-lg">
          <button
            onClick={() => setActiveTab("lancamento")}
            className={`py-2 px-3 md:pb-1 text-center transition-all rounded-md md:rounded-none cursor-pointer ${
              activeTab === "lancamento" 
                ? "bg-slate-800 text-blue-400 md:bg-transparent md:text-blue-400 md:border-b-2 md:border-blue-400 font-bold" 
                : "text-slate-300 hover:text-white"
            }`}
          >
            Lançamento
          </button>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`py-2 px-3 md:pb-1 text-center transition-all rounded-md md:rounded-none cursor-pointer ${
              activeTab === "dashboard" 
                ? "bg-slate-800 text-blue-400 md:bg-transparent md:text-blue-400 md:border-b-2 md:border-blue-400 font-bold" 
                : "text-slate-300 hover:text-white"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("banco")}
            className={`py-2 px-3 md:pb-1 text-center transition-all rounded-md md:rounded-none cursor-pointer ${
              activeTab === "banco" 
                ? "bg-slate-800 text-blue-400 md:bg-transparent md:text-blue-400 md:border-b-2 md:border-blue-400 font-bold" 
                : "text-slate-300 hover:text-white"
            }`}
          >
            Tabelas
          </button>
        </nav>

        {/* User Profile & Logout - Hidden on mobile, shown on desktop */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={() => fetchData()}
            disabled={loadingData}
            className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Sincronizar dados"
          >
            <RefreshCw className={`h-4 w-4 ${loadingData ? "animate-spin text-blue-400" : ""}`} />
          </button>

          <div className="text-right">
            <p className="text-xs font-bold">{userEmail?.split("@")[0] || "Operador"}</p>
            <p className="text-[10px] text-slate-400">{userEmail}</p>
          </div>

          <button
            onClick={handleLogout}
            className="p-1 rounded text-red-400 hover:text-red-500 transition-colors cursor-pointer"
            title="Sair do sistema"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 max-w-7xl w-full mx-auto">
        
        {/* Dynamic loading indicator */}
        {loadingData && estoquePrevisto.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mb-4" />
            <p className="text-sm font-medium text-slate-600">Sincronizando registros de estoque...</p>
          </div>
        ) : (
          <div className="transition-all duration-300">
            {activeTab === "lancamento" ? (
              <Lancamento 
                userEmail={userEmail} 
                onRefreshData={fetchData}
                estoquePrevisto={estoquePrevisto}
                estoqueRecebido={estoqueRecebido}
                isOffline={isOffline}
              />
            ) : activeTab === "dashboard" ? (
              <Dashboard 
                estoquePrevisto={estoquePrevisto}
                estoqueRecebido={estoqueRecebido}
              />
            ) : (
              <TabelaGerenciador
                userEmail={userEmail}
                estoquePrevisto={estoquePrevisto}
                estoqueRecebido={estoqueRecebido}
                onRefreshData={fetchData}
                isOffline={isOffline}
              />
            )}
          </div>
        )}

      </div>

      {/* Status Bar Footer */}
      <footer className="h-8 bg-white border-t border-slate-200 flex items-center px-6 justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mt-auto">
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isOffline ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`}></div>
            <span>{isOffline ? "Simulador Local Ativo" : "Firebase Conectado"}</span>
          </div>
          <div className="flex items-center gap-1.5 border-l pl-4 border-slate-200">
            <span>Previsto: <span className="text-slate-600 font-mono">{estoquePrevisto.length}</span></span>
            <span className="text-slate-300">|</span>
            <span>Recebido: <span className="text-emerald-600 font-mono">{estoqueRecebido.length}</span></span>
          </div>
        </div>
        <div className="flex gap-4">
          <span>SESSÃO: <span className="font-mono text-slate-600">#920E-STUDIO</span></span>
          <span>STATUS: <span className="font-mono text-slate-600">{isOffline ? "MOCK / OFFLINE" : "ONLINE"}</span></span>
        </div>
      </footer>
    </main>
  );
}
