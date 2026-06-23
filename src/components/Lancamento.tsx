import React, { useState, useEffect, useRef } from "react";
import { 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  getDoc 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { EstoquePrevisto, EstoqueRecebido } from "../types";
import { 
  Plus, 
  Trash2, 
  CheckCircle, 
  Search, 
  Anchor, 
  Compass, 
  FileText, 
  Package,
  AlertCircle,
  HelpCircle
} from "lucide-react";

interface LancamentoProps {
  userEmail: string;
  onRefreshData: () => void;
  estoquePrevisto: EstoquePrevisto[];
  estoqueRecebido: EstoqueRecebido[];
  isOffline?: boolean;
}

export default function Lancamento({ 
  userEmail, 
  onRefreshData, 
  estoquePrevisto, 
  estoqueRecebido,
  isOffline = false
}: LancamentoProps) {
  // States
  const [coilInput, setCoilInput] = useState("");
  const [suggestions, setSuggestions] = useState<EstoquePrevisto[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCoil, setSelectedCoil] = useState<EstoquePrevisto | null>(null);
  
  const [temporaryList, setTemporaryList] = useState<EstoquePrevisto[]>([]);
  const [observacoes, setObservacoes] = useState("");
  
  // Status and Alerts
  const [alert, setAlert] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [loadingRegister, setLoadingRegister] = useState(false);

  const suggestionRef = useRef<HTMLDivElement>(null);

  // Close suggestions dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Update suggestions based on typing
  useEffect(() => {
    if (!coilInput.trim()) {
      setSuggestions([]);
      return;
    }

    const searchStr = coilInput.toUpperCase();
    
    // Filter planned coils that match input and are NOT yet in estoque_recebido
    const filtered = estoquePrevisto.filter(item => {
      const matchSearch = item.coilNumber.toUpperCase().includes(searchStr);
      const isAlreadyReceived = estoqueRecebido.some(
        received => received.coilNumber.toUpperCase() === item.coilNumber.toUpperCase()
      );
      return matchSearch && !isAlreadyReceived;
    });

    setSuggestions(filtered);
  }, [coilInput, estoquePrevisto, estoqueRecebido]);

  // Handle suggestion selection
  const handleSelectSuggestion = (item: EstoquePrevisto) => {
    setCoilInput(item.coilNumber);
    setSelectedCoil(item);
    setShowSuggestions(false);
    setAlert(null);
  };

  // Manual input field change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCoilInput(val);
    setSelectedCoil(null); // Reset selection since it's manual typing
    setShowSuggestions(true);
    setAlert(null);
  };

  // Add to temporary list (with anti-duplicity locks on frontend)
  const handleAddToTempList = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCoilNumber = coilInput.trim().toUpperCase();

    if (!cleanCoilNumber) {
      setAlert({ type: "error", message: "Digite ou selecione um número de bobina (Coil Number)." });
      return;
    }

    // 1. Check if it's already in the temporary list on screen
    const isAlreadyInTempList = temporaryList.some(
      item => item.coilNumber.toUpperCase() === cleanCoilNumber
    );
    if (isAlreadyInTempList) {
      setAlert({ 
        type: "warning", 
        message: `A bobina ${cleanCoilNumber} já foi adicionada à fila temporária de recebimento.` 
      });
      return;
    }

    // 2. Check if already registered in database (cached received stock)
    const isAlreadyReceived = estoqueRecebido.some(
      item => item.coilNumber.toUpperCase() === cleanCoilNumber
    );
    if (isAlreadyReceived) {
      setAlert({ 
        type: "error", 
        message: `Validação de Segurança: A bobina ${cleanCoilNumber} já foi recebida anteriormente no sistema!` 
      });
      return;
    }

    // Find full details from planned stock
    const plannedDetails = estoquePrevisto.find(
      item => item.coilNumber.toUpperCase() === cleanCoilNumber
    );

    if (!plannedDetails) {
      setAlert({ 
        type: "error", 
        message: `A bobina ${cleanCoilNumber} não consta no estoque previsto. Por favor, verifique o número.` 
      });
      return;
    }

    // Success: Add to temporary list
    setTemporaryList([...temporaryList, plannedDetails]);
    setCoilInput("");
    setSelectedCoil(null);
    setAlert({ 
      type: "success", 
      message: `Bobina ${cleanCoilNumber} adicionada à fila de recebimento.` 
    });

    // Auto-clear success alert after 3 seconds
    setTimeout(() => {
      setAlert(null);
    }, 3000);
  };

  // Remove from temporary list
  const handleRemoveFromTemp = (index: number) => {
    const newList = [...temporaryList];
    const removedItem = newList.splice(index, 1)[0];
    setTemporaryList(newList);
    setAlert({ 
      type: "warning", 
      message: `Bobina ${removedItem.coilNumber} removida da fila.` 
    });
  };

  // Register all items from temporary list to Firestore with double-validation
  const handleRegisterAll = async () => {
    if (temporaryList.length === 0) {
      setAlert({ type: "error", message: "A fila temporária de recebimento está vazia." });
      return;
    }

    setLoadingRegister(true);
    setAlert(null);

    try {
      let successCount = 0;
      let skippedList: string[] = [];

      for (const item of temporaryList) {
        if (isOffline) {
          // Local/offline double-registration validation
          const alreadyReceived = estoqueRecebido.some(
            rec => rec.coilNumber.toUpperCase() === item.coilNumber.toUpperCase()
          );

          if (alreadyReceived) {
            skippedList.push(item.coilNumber);
            continue;
          }

          const recebidoPayload: EstoqueRecebido = {
            coilNumber: item.coilNumber,
            BL: item.BL,
            navio: item.navio,
            viagem: item.viagem,
            dataRecebimento: new Date().toISOString(),
            usuarioRecebimento: userEmail
          };
          if (observacoes.trim()) {
            recebidoPayload.observacoes = observacoes.trim();
          }

          const currentLocal = JSON.parse(localStorage.getItem("local_estoque_recebido") || "[]");
          currentLocal.push(recebidoPayload);
          localStorage.setItem("local_estoque_recebido", JSON.stringify(currentLocal));
          successCount++;
          continue;
        }

        // Online flow: Backend anti-duplicity query: Direct getDoc lookup before insertion
        const docRef = doc(db, "estoque_recebido", item.coilNumber);
        let docSnap;
        try {
          docSnap = await getDoc(docRef);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `estoque_recebido/${item.coilNumber}`);
          throw error;
        }

        if (docSnap.exists()) {
          // Double registration lock!
          skippedList.push(item.coilNumber);
          continue;
        }

        // Prepare received stock payload
        const recebidoPayload: EstoqueRecebido = {
          coilNumber: item.coilNumber,
          BL: item.BL,
          navio: item.navio,
          viagem: item.viagem,
          dataRecebimento: new Date().toISOString(),
          usuarioRecebimento: userEmail
        };
        if (observacoes.trim()) {
          recebidoPayload.observacoes = observacoes.trim();
        }

        // Write to estoque_recebido
        try {
          await setDoc(doc(db, "estoque_recebido", item.coilNumber), recebidoPayload);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `estoque_recebido/${item.coilNumber}`);
          throw error;
        }
        successCount++;
      }

      // Refresh parent dataset
      onRefreshData();

      // Feedback response
      if (skippedList.length > 0) {
        setAlert({
          type: "warning",
          message: `Recebimento concluído parcialmente! ${successCount} bobina(s) salva(s). No entanto, ${skippedList.length} bobina(s) (${skippedList.join(", ")}) foram descartadas pois já tinham sido recebidas por outro operador.`
        });
      } else {
        setAlert({
          type: "success",
          message: `Excelente! Todas as ${successCount} bobinas foram registradas no estoque recebido com sucesso!`
        });
      }

      // Reset local inputs
      setTemporaryList([]);
      setObservacoes("");
    } catch (error: any) {
      console.error("Erro ao registrar estoque:", error);
      setAlert({
        type: "error",
        message: "Ocorreu um erro no servidor ao registrar a carga. Erro: " + error.message
      });
    } finally {
      setLoadingRegister(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header info */}
      <div className="rounded-lg bg-slate-900 px-4 py-3 text-white border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold tracking-tight">Painel de Lançamento e Entrada de Cargas</h2>
            <p className="text-[11px] text-slate-400">
              Terminal 04 - Porto de Santos • Registro físico de descarga de bobinas de aço
            </p>
          </div>
          <div className="bg-slate-800 px-2.5 py-1 rounded text-[10px] font-mono font-bold text-blue-400 border border-slate-700">
            DISPOSITIVO: COLETOR-04A
          </div>
        </div>
      </div>

      {/* Main Grid: Input Form vs Queue List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Column: Entry Input Form */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Package className="h-4 w-4 text-slate-500" />
                Registro de Entrada
              </h3>
            </div>

            {/* General Feedback Alert */}
            {alert && (
              <div className={`p-3 rounded text-xs border flex items-start gap-2.5 ${
                alert.type === "success" 
                  ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
                  : alert.type === "warning"
                    ? "bg-amber-50 text-amber-800 border-amber-100"
                    : "bg-red-50 text-red-800 border-red-100"
              }`}>
                <AlertCircle className={`h-4.5 w-4.5 shrink-0 ${
                  alert.type === "success" 
                    ? "text-emerald-500" 
                    : alert.type === "warning"
                      ? "text-amber-500"
                      : "text-red-500"
                } mt-0.5`} />
                <span className="font-medium">{alert.message}</span>
              </div>
            )}

            <form onSubmit={handleAddToTempList} className="space-y-3">
              {/* Autocomplete Input Container */}
              <div className="relative" ref={suggestionRef}>
                <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                  Coil Number (Primary Key)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Digite ou selecione o Coil Number..."
                    value={coilInput}
                    onChange={handleInputChange}
                    onFocus={() => setShowSuggestions(true)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                    id="coil_number_input"
                  />
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  
                  {/* Status Indicator inside input */}
                  {selectedCoil && (
                    <div className="absolute right-9 top-1/2 -translate-y-1/2 flex items-center text-emerald-600">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                  )}
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-md z-50 max-h-56 overflow-y-auto">
                    <div className="px-2.5 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-150">
                      Bobinas Previstas Encontradas ({suggestions.length})
                    </div>
                    {suggestions.map((item) => (
                      <button
                        key={item.coilNumber}
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className="flex w-full items-center justify-between p-2 text-left hover:bg-blue-50 border-b border-slate-100 last:border-0 cursor-pointer font-mono text-xs transition-colors"
                      >
                        <span className="font-bold text-blue-600">{item.coilNumber}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-sans">
                          {item.navio} | {item.BL}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Info block if no suggestions match */}
                {showSuggestions && coilInput.trim() && suggestions.length === 0 && !selectedCoil && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-slate-50 border border-slate-200 rounded p-2 text-[11px] text-slate-500 font-sans shadow-md">
                    Nenhuma bobina prevista disponível para recebimento. Verifique o código.
                  </div>
                )}
              </div>

              {/* Dynamic Loaded Details Preview Card */}
              {selectedCoil ? (
                <div className="rounded border border-blue-100 bg-blue-50/40 p-3 space-y-1.5 text-xs text-slate-700">
                  <span className="text-[9px] font-bold text-blue-800 uppercase tracking-wider">Metadados da Carga</span>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-sans">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Anchor className="h-3.5 w-3.5 text-slate-400" />
                      <span><strong>Navio:</strong> {selectedCoil.navio}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Compass className="h-3.5 w-3.5 text-slate-400" />
                      <span><strong>Viagem:</strong> {selectedCoil.viagem}</span>
                    </div>
                    <div className="col-span-2 flex items-center gap-1.5 text-slate-600 border-t border-slate-200/50 pt-1.5">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      <span><strong>BL (Bill of Lading):</strong> {selectedCoil.BL}</span>
                    </div>
                  </div>
                </div>
              ) : coilInput.trim() && (
                <div className="text-[11px] text-amber-700 flex items-center gap-1 bg-amber-50 p-2 rounded border border-amber-100">
                  <HelpCircle className="h-4 w-4 shrink-0 text-amber-500" />
                  <span>Selecione uma recomendação para carregar os dados logísticos.</span>
                </div>
              )}

              {/* Add Button */}
              <button
                type="submit"
                className="w-full py-2 bg-slate-800 text-white rounded text-sm font-bold hover:bg-black transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                id="add_to_list_btn"
              >
                <Plus className="h-4 w-4" />
                Adicionar à Fila
              </button>
            </form>
          </div>

          {/* Quick Stats Helper */}
          <div className="rounded-lg bg-slate-100 border border-slate-200 p-4 space-y-2">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Conferência Física do Terminal</h4>
            <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc pl-4 font-sans">
              <li><strong>Pre-matching:</strong> Apenas bobinas constantes na base de planejamento (<code className="bg-white px-1 py-0.5 rounded border border-slate-200">estoque_previsto</code>) são aceitas.</li>
              <li><strong>Proteção Anti-Duplicidade:</strong> Validação automatizada contra duplicidades de registro antes da inserção na base física.</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Temporary List (Fila) */}
        <div className="lg:col-span-7">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-full min-h-[400px]">
            
            {/* List Header */}
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fila Temporária</h3>
                <p className="text-[10px] text-slate-400 uppercase">Fila de lote atual: <strong className="text-slate-700 font-mono">{temporaryList.length} itens</strong></p>
              </div>
              {temporaryList.length > 0 && (
                <button
                  onClick={() => setTemporaryList([])}
                  className="text-[11px] text-red-500 hover:text-red-700 hover:underline flex items-center gap-1 font-bold focus:outline-none cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Limpar Fila
                </button>
              )}
            </div>

            {/* List Body as high density Table */}
            <div className="flex-1 overflow-y-auto">
              {temporaryList.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-12 text-slate-400 h-full">
                  <Package className="h-10 w-10 text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-500 uppercase">A fila está vazia</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                    Digite os códigos das bobinas à esquerda para listar e despachar os registros em lote ao servidor.
                  </p>
                </div>
              ) : (
                <div className="w-full">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="px-4 py-2 font-bold">Coil Number</th>
                        <th className="px-4 py-2 font-bold">Navio / Viagem</th>
                        <th className="px-4 py-2 font-bold">BL correspondente</th>
                        <th className="px-4 py-2 font-bold text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                      {temporaryList.map((item, index) => (
                        <tr key={`${item.coilNumber}-${index}`} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-bold text-blue-600">{item.coilNumber}</td>
                          <td className="px-4 py-2.5 font-sans text-slate-600 text-[11px] uppercase">{item.navio} / {item.viagem}</td>
                          <td className="px-4 py-2.5 text-slate-500 text-[11px]">{item.BL}</td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => handleRemoveFromTemp(index)}
                              className="text-red-500 hover:text-red-700 font-bold hover:underline text-[10px] uppercase cursor-pointer"
                            >
                              [Remover]
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* List Actions Footer */}
            {temporaryList.length > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Observações de Recebimento (Opcional)
                  </label>
                  <textarea
                    placeholder="Ex: Carga ok, sem avarias detectadas..."
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    className="w-full rounded border border-slate-300 p-2 text-xs text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-blue-500 outline-none font-sans"
                    rows={2}
                  />
                </div>

                <button
                  onClick={handleRegisterAll}
                  disabled={loadingRegister}
                  className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold text-base shadow-lg hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase cursor-pointer disabled:opacity-50"
                  id="confirm_register_btn"
                >
                  {loadingRegister ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      REGISTRAR NO BANCO
                    </>
                  )}
                </button>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
