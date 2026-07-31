import React, { useState, useMemo } from "react";
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  writeBatch 
} from "firebase/firestore";
import { db } from "../firebase";
import { EstoquePrevisto, EstoqueRecebido } from "../types";
import { 
  Table, 
  Database, 
  Plus, 
  Upload, 
  Download, 
  Trash2, 
  Check, 
  AlertTriangle, 
  Copy,
  Layers,
  FileSpreadsheet,
  X,
  RefreshCw,
  Search,
  Ship,
  ChevronRight,
  ChevronDown,
  FileText,
  FolderTree,
  Package
} from "lucide-react";

interface TabelaGerenciadorProps {
  userEmail: string;
  estoquePrevisto: EstoquePrevisto[];
  estoqueRecebido: EstoqueRecebido[];
  onRefreshData: () => Promise<void> | void;
  isOffline?: boolean;
}

export default function TabelaGerenciador({
  userEmail,
  estoquePrevisto,
  estoqueRecebido,
  onRefreshData,
  isOffline = false
}: TabelaGerenciadorProps) {
  // Tabs for the data manager
  const [subTab, setSubTab] = useState<"previsto" | "recebido">("previsto");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"navios" | "plano">("navios");
  const [selectedNavioModalName, setSelectedNavioModalName] = useState<string | null>(null);
  const [confirmDeleteCoilId, setConfirmDeleteCoilId] = useState<string | null>(null);

  // Search & Accordion State for Modal Popup
  const [modalSearchTerm, setModalSearchTerm] = useState("");
  const [modalOpenBLs, setModalOpenBLs] = useState<{ [key: string]: boolean }>({});
  
  // Single insert form state
  const [coilNumber, setCoilNumber] = useState("");
  const [bl, setBl] = useState("");
  const [navio, setNavio] = useState("");
  const [viagem, setViagem] = useState("");
  
  // Received stock single insert state (if subTab === "recebido")
  const [observacoes, setObservacoes] = useState("");

  // Excel paste state
  const [pasteText, setPasteText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [pasteError, setPasteError] = useState<string | null>(null);

  // General state feedback
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Confirmation modals
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Filtering list based on search
  const filteredPrevisto = estoquePrevisto.filter(item => 
    item.coilNumber.toUpperCase().includes(searchTerm.toUpperCase()) ||
    item.BL.toUpperCase().includes(searchTerm.toUpperCase()) ||
    item.navio.toUpperCase().includes(searchTerm.toUpperCase()) ||
    item.viagem.toUpperCase().includes(searchTerm.toUpperCase())
  );

  const filteredRecebido = estoqueRecebido.filter(item => 
    item.coilNumber.toUpperCase().includes(searchTerm.toUpperCase()) ||
    item.BL.toUpperCase().includes(searchTerm.toUpperCase()) ||
    item.navio.toUpperCase().includes(searchTerm.toUpperCase()) ||
    item.viagem.toUpperCase().includes(searchTerm.toUpperCase()) ||
    (item.usuarioRecebimento && item.usuarioRecebimento.toUpperCase().includes(searchTerm.toUpperCase())) ||
    (item.observacoes && item.observacoes.toUpperCase().includes(searchTerm.toUpperCase()))
  );

  const groupedByNavio = useMemo(() => {
    const items = subTab === "previsto" ? filteredPrevisto : filteredRecebido;
    const groups: { [navioName: string]: { navio: string; viagens: Set<string>; bls: Set<string>; items: any[] } } = {};
    
    items.forEach(item => {
      const navioName = item.navio || "Sem Navio";
      if (!groups[navioName]) {
        groups[navioName] = { navio: navioName, viagens: new Set(), bls: new Set(), items: [] };
      }
      if (item.viagem) groups[navioName].viagens.add(item.viagem);
      if (item.BL) groups[navioName].bls.add(item.BL);
      groups[navioName].items.push(item);
    });

    return Object.values(groups).map(g => ({
      navio: g.navio,
      viagens: Array.from(g.viagens),
      bls: Array.from(g.bls),
      items: g.items
    }));
  }, [subTab, filteredPrevisto, filteredRecebido]);

  const currentNavioModalData = useMemo(() => {
    if (!selectedNavioModalName) return null;
    return groupedByNavio.find(g => g.navio === selectedNavioModalName) || null;
  }, [selectedNavioModalName, groupedByNavio]);

  // Filter items inside modal by Coil Number, BL, Viagem or Observacoes
  const filteredModalItems = useMemo(() => {
    if (!currentNavioModalData) return [];
    if (!modalSearchTerm.trim()) return currentNavioModalData.items;

    const term = modalSearchTerm.toUpperCase().trim();
    return currentNavioModalData.items.filter(item => 
      item.coilNumber.toUpperCase().includes(term) ||
      (item.BL && item.BL.toUpperCase().includes(term)) ||
      (item.viagem && item.viagem.toUpperCase().includes(term)) ||
      (item.observacoes && item.observacoes.toUpperCase().includes(term))
    );
  }, [currentNavioModalData, modalSearchTerm]);

  // Group filtered modal items hierarchically by BL
  const modalHierarchy = useMemo(() => {
    const blMap: { [blName: string]: { blName: string; viagens: Set<string>; coils: any[] } } = {};
    
    filteredModalItems.forEach(item => {
      const blName = item.BL || "SEM BL";
      if (!blMap[blName]) {
        blMap[blName] = { blName, viagens: new Set(), coils: [] };
      }
      if (item.viagem) blMap[blName].viagens.add(item.viagem);
      blMap[blName].coils.push(item);
    });

    return Object.values(blMap).sort((a, b) => a.blName.localeCompare(b.blName));
  }, [filteredModalItems]);

  const toggleModalBL = (blName: string) => {
    setModalOpenBLs(prev => ({ ...prev, [blName]: !prev[blName] }));
  };

  const handleToggleAllModalBLs = (expand: boolean) => {
    const nextState: { [key: string]: boolean } = {};
    modalHierarchy.forEach(bl => {
      nextState[bl.blName] = expand;
    });
    setModalOpenBLs(nextState);
  };

  const triggerFeedback = (type: "success" | "error" | "info", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 5000);
  };

  // Add a single row manually
  const handleAddSingleRow = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanCoil = coilNumber.trim().toUpperCase();
    const cleanBL = bl.trim().toUpperCase();
    const cleanNavio = navio.trim();
    const cleanViagem = viagem.trim().toUpperCase();

    if (!cleanCoil || !cleanBL || !cleanNavio || !cleanViagem) {
      triggerFeedback("error", "Preencha todos os campos obrigatórios da tabela.");
      return;
    }

    setLoading(true);

    try {
      if (subTab === "previsto") {
        // Build payload
        const payload: EstoquePrevisto = {
          coilNumber: cleanCoil,
          BL: cleanBL,
          navio: cleanNavio,
          viagem: cleanViagem
        };

        if (isOffline) {
          // Save in localStorage
          const localPrev = JSON.parse(localStorage.getItem("local_estoque_previsto") || "[]");
          // check duplicate
          const exists = localPrev.some((x: any) => x.coilNumber.toUpperCase() === cleanCoil);
          if (exists) {
            triggerFeedback("error", `Duplicidade detectada! Bobina ${cleanCoil} já cadastrada na tabela.`);
            setLoading(false);
            return;
          }
          localPrev.push(payload);
          localStorage.setItem("local_estoque_previsto", JSON.stringify(localPrev));
        } else {
          // Write to Firestore
          const docRef = doc(db, "estoque_previsto", cleanCoil);
          await setDoc(docRef, payload);
        }

        triggerFeedback("success", `Bobina ${cleanCoil} inserida com sucesso no Planejamento (Estoque Previsto)!`);
      } else {
        // Recebido payload
        const payload: EstoqueRecebido = {
          coilNumber: cleanCoil,
          BL: cleanBL,
          navio: cleanNavio,
          viagem: cleanViagem,
          dataRecebimento: new Date().toISOString(),
          usuarioRecebimento: userEmail
        };
        if (observacoes.trim()) {
          payload.observacoes = observacoes.trim();
        }

        if (isOffline) {
          const localRec = JSON.parse(localStorage.getItem("local_estoque_recebido") || "[]");
          const exists = localRec.some((x: any) => x.coilNumber.toUpperCase() === cleanCoil);
          if (exists) {
            triggerFeedback("error", `Duplicidade detectada! Bobina ${cleanCoil} já marcada como recebida.`);
            setLoading(false);
            return;
          }
          localRec.push(payload);
          localStorage.setItem("local_estoque_recebido", JSON.stringify(localRec));
        } else {
          const docRef = doc(db, "estoque_recebido", cleanCoil);
          await setDoc(docRef, payload);
        }

        triggerFeedback("success", `Bobina ${cleanCoil} inserida com sucesso no Estoque Recebido físico!`);
      }

      // Reset form fields
      setCoilNumber("");
      setBl("");
      setNavio("");
      setViagem("");
      setObservacoes("");
      
      // Sync parent state
      await onRefreshData();
    } catch (err: any) {
      console.error(err);
      triggerFeedback("error", "Erro ao inserir dados no servidor: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete a specific row
  const handleDeleteRow = (id: string) => {
    setConfirmDeleteCoilId(id);
  };

  const executeDeleteRow = async (id: string) => {
    setConfirmDeleteCoilId(null);
    setLoading(true);
    try {
      if (subTab === "previsto") {
        if (isOffline) {
          const localPrev = JSON.parse(localStorage.getItem("local_estoque_previsto") || "[]");
          const updated = localPrev.filter((x: any) => x.coilNumber.toUpperCase() !== id.toUpperCase());
          localStorage.setItem("local_estoque_previsto", JSON.stringify(updated));
        } else {
          await deleteDoc(doc(db, "estoque_previsto", id));
        }
        triggerFeedback("success", `Bobina ${id} removida com sucesso do Planejamento!`);
      } else {
        if (isOffline) {
          const localRec = JSON.parse(localStorage.getItem("local_estoque_recebido") || "[]");
          const updated = localRec.filter((x: any) => x.coilNumber.toUpperCase() !== id.toUpperCase());
          localStorage.setItem("local_estoque_recebido", JSON.stringify(updated));
        } else {
          await deleteDoc(doc(db, "estoque_recebido", id));
        }
        triggerFeedback("success", `Bobina ${id} desmarcada do estoque recebido.`);
      }

      await onRefreshData();
    } catch (err: any) {
      console.error(err);
      triggerFeedback("error", "Erro ao excluir o registro: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Clear/Truncate database table
  const handleClearTable = async () => {
    setLoading(true);
    setShowClearConfirm(false);

    try {
      if (subTab === "previsto") {
        if (isOffline) {
          localStorage.setItem("local_estoque_previsto", JSON.stringify([]));
        } else {
          // Truncate online collection
          const snap = await getDocs(collection(db, "estoque_previsto"));
          const batch = writeBatch(db);
          snap.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
        triggerFeedback("success", "Tabela de Estoque Previsto (Planejamento) limpa com sucesso!");
      } else {
        if (isOffline) {
          localStorage.setItem("local_estoque_recebido", JSON.stringify([]));
        } else {
          const snap = await getDocs(collection(db, "estoque_recebido"));
          const batch = writeBatch(db);
          snap.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
        triggerFeedback("success", "Tabela de Estoque Recebido (Lançamentos Físicos) limpa com sucesso!");
      }

      await onRefreshData();
    } catch (err: any) {
      console.error(err);
      triggerFeedback("error", "Erro ao limpar tabela do servidor: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Parse Excel Clipboard Paste data
  // Spreadsheet data copied from Excel has columns separated by TABs (\t) and rows by newlines (\n)
  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPasteText(text);
    setPasteError(null);

    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    const lines = text.split("\n");
    const rows: any[] = [];
    
    // Parse each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // split by tabs or semicolons/commas as fallback
      let cols = line.split("\t");
      if (cols.length <= 1) {
        cols = line.split(";");
      }
      if (cols.length <= 1) {
        cols = line.split(",");
      }

      // We expect columns: Coil Number, BL, Navio, Viagem
      // Skip headers if the row contains "coil" or "bobina" or "BL"
      const lowerFirstCol = cols[0].toLowerCase();
      if (lowerFirstCol.includes("coil") || lowerFirstCol.includes("bobina") || lowerFirstCol.includes("número") || lowerFirstCol.includes("plano")) {
        continue;
      }

      if (cols.length < 4) {
        setPasteError(`Linha ${i + 1} inválida: Esperado no mínimo 4 colunas (Coil, BL, Navio, Viagem). Linha atual contém apenas ${cols.length} colunas.`);
        setParsedRows([]);
        return;
      }

      rows.push({
        coilNumber: cols[0].trim().toUpperCase(),
        BL: cols[1].trim().toUpperCase(),
        navio: cols[2].trim(),
        viagem: cols[3].trim().toUpperCase(),
        observacoes: cols[4] ? cols[4].trim() : undefined
      });
    }

    setParsedRows(rows);
  };

  // Bulk import parsed spreadsheet rows
  const handleBulkImport = async () => {
    if (parsedRows.length === 0) {
      triggerFeedback("error", "Nenhuma linha válida analisada para importar.");
      return;
    }

    setLoading(true);
    let successCount = 0;
    let duplicateCount = 0;

    try {
      if (subTab === "previsto") {
        if (isOffline) {
          const localPrev = JSON.parse(localStorage.getItem("local_estoque_previsto") || "[]");
          
          parsedRows.forEach(row => {
            const exists = localPrev.some((x: any) => x.coilNumber.toUpperCase() === row.coilNumber.toUpperCase());
            if (exists) {
              duplicateCount++;
            } else {
              localPrev.push({
                coilNumber: row.coilNumber,
                BL: row.BL,
                navio: row.navio,
                viagem: row.viagem
              });
              successCount++;
            }
          });

          localStorage.setItem("local_estoque_previsto", JSON.stringify(localPrev));
        } else {
          // Bulk import to Firestore in chunks/batches
          const batch = writeBatch(db);
          for (const row of parsedRows) {
            const docRef = doc(db, "estoque_previsto", row.coilNumber);
            batch.set(docRef, {
              coilNumber: row.coilNumber,
              BL: row.BL,
              navio: row.navio,
              viagem: row.viagem
            });
            successCount++;
          }
          await batch.commit();
        }
        
        triggerFeedback(
          "success", 
          `Importação concluída! ${successCount} registros adicionados ao planejamento de descarregamento.${
            duplicateCount > 0 ? ` ${duplicateCount} duplicidades foram ignoradas.` : ""
          }`
        );
      } else {
        // Bulk import to recebido
        if (isOffline) {
          const localRec = JSON.parse(localStorage.getItem("local_estoque_recebido") || "[]");
          
          parsedRows.forEach(row => {
            const exists = localRec.some((x: any) => x.coilNumber.toUpperCase() === row.coilNumber.toUpperCase());
            if (exists) {
              duplicateCount++;
            } else {
              const recPayload: any = {
                coilNumber: row.coilNumber,
                BL: row.BL,
                navio: row.navio,
                viagem: row.viagem,
                dataRecebimento: new Date().toISOString(),
                usuarioRecebimento: userEmail
              };
              if (row.observacoes) {
                recPayload.observacoes = row.observacoes;
              }
              localRec.push(recPayload);
              successCount++;
            }
          });

          localStorage.setItem("local_estoque_recebido", JSON.stringify(localRec));
        } else {
          const batch = writeBatch(db);
          for (const row of parsedRows) {
            const docRef = doc(db, "estoque_recebido", row.coilNumber);
            const recPayload: any = {
              coilNumber: row.coilNumber,
              BL: row.BL,
              navio: row.navio,
              viagem: row.viagem,
              dataRecebimento: new Date().toISOString(),
              usuarioRecebimento: userEmail
            };
            if (row.observacoes) {
              recPayload.observacoes = row.observacoes;
            }
            batch.set(docRef, recPayload);
            successCount++;
          }
          await batch.commit();
        }

        triggerFeedback(
          "success", 
          `Lançamento em lote concluído! ${successCount} registros gravados diretamente no banco de recebimento físico.`
        );
      }

      setPasteText("");
      setParsedRows([]);
      setIsImporting(false);
      await onRefreshData();
    } catch (err: any) {
      console.error(err);
      triggerFeedback("error", "Erro ao executar importação em lote: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Export current table to CSV
  const handleExportCSV = () => {
    let headers: string[] = [];
    let csvRows: string[] = [];

    if (subTab === "previsto") {
      headers = ["Coil Number", "BL", "Navio", "Viagem"];
      csvRows = filteredPrevisto.map(item => 
        `"${item.coilNumber}","${item.BL}","${item.navio}","${item.viagem}"`
      );
    } else {
      headers = ["Coil Number", "BL", "Navio", "Viagem", "Data Recebimento", "Operador", "Observacoes"];
      csvRows = filteredRecebido.map(item => 
        `"${item.coilNumber}","${item.BL}","${item.navio}","${item.viagem}","${item.dataRecebimento}","${item.usuarioRecebimento}","${item.observacoes || ""}"`
      );
    }

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...csvRows].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `logistock_tabela_${subTab}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerFeedback("success", "Exportação CSV iniciada com sucesso!");
  };

  return (
    <div className="space-y-4">
      {/* Tab Header explanation */}
      <div className="rounded-lg bg-slate-900 px-4 py-3 text-white border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold tracking-tight">Painel de Administração de Tabelas Portuárias</h2>
            <p className="text-[11px] text-slate-400">
              Gerencie as tabelas de planejamento (<code className="text-slate-300">estoque_previsto</code>) e descarga conferida (<code className="text-slate-300">estoque_recebido</code>) diretamente por grades relacionais.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30 uppercase font-mono font-bold">
              Modo Tabela Relacional
            </span>
          </div>
        </div>
      </div>

      {/* Database/Table Tab Selection & Bulk Import Trigger */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSubTab("previsto");
              setSearchTerm("");
              setPasteText("");
              setParsedRows([]);
              setIsImporting(false);
              setSelectedNavioModalName(null);
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all uppercase flex items-center gap-1.5 cursor-pointer ${
              subTab === "previsto"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            Tabela: Planejamento (Estoque Previsto)
            <span className="bg-slate-500/30 text-[10px] px-1.5 py-0.2 rounded ml-1 font-mono">{estoquePrevisto.length}</span>
          </button>

          <button
            onClick={() => {
              setSubTab("recebido");
              setSearchTerm("");
              setPasteText("");
              setParsedRows([]);
              setIsImporting(false);
              setSelectedNavioModalName(null);
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all uppercase flex items-center gap-1.5 cursor-pointer ${
              subTab === "recebido"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Table className="h-3.5 w-3.5" />
            Tabela: Recebidos (Lançamento Físico)
            <span className="bg-slate-500/30 text-[10px] px-1.5 py-0.2 rounded ml-1 font-mono">{estoqueRecebido.length}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsImporting(!isImporting)}
            className="px-3 py-1.5 rounded text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors uppercase flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            {isImporting ? "Esconder Importador" : "Colar Planilha Excel"}
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors uppercase flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>

          <button
            onClick={() => setShowClearConfirm(true)}
            className="px-3 py-1.5 rounded text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 transition-colors uppercase flex items-center gap-1.5 cursor-pointer"
            title="Limpar todos os dados desta tabela"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar Tabela
          </button>
        </div>
      </div>

      {/* Confirmation Modals & feedback */}
      {feedback && (
        <div className={`p-3 rounded border text-xs font-medium flex items-center gap-3 ${
          feedback.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
            : feedback.type === "error"
              ? "bg-red-50 text-red-800 border-red-100"
              : "bg-blue-50 text-blue-800 border-blue-100"
        }`}>
          <div className="flex-1">{feedback.message}</div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 font-bold uppercase">
            [Ok]
          </button>
        </div>
      )}

      {/* CLEAR DATABASE TABLE DOUBLE CONFIRMATION MODAL */}
      {showClearConfirm && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-extrabold text-red-800 uppercase tracking-tight">Confirmação Crítica de Exclusão de Tabela</h4>
              <p className="text-[11px] text-red-700 mt-1">
                Atenção: Você está prestes a apagar permanentemente todos os registros da tabela <strong className="font-mono font-bold">{subTab === "previsto" ? "estoque_previsto" : "estoque_recebido"}</strong>. 
                Esta ação é irreversível e afetará em tempo real a base de dados sincronizada no Firebase.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-2.5 py-1 text-[11px] font-bold text-slate-500 uppercase hover:bg-slate-100 rounded"
            >
              Cancelar
            </button>
            <button
              onClick={handleClearTable}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold uppercase rounded flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Apagar Toda a Tabela de Carga
            </button>
          </div>
        </div>
      )}

      {/* Excel Spreadsheet Paste Area */}
      {isImporting && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/20 p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="text-xs font-extrabold text-blue-800 uppercase tracking-tight flex items-center gap-1.5">
                <FileSpreadsheet className="h-4.5 w-4.5" />
                Importador Direto de Planilhas (Excel / Sheets)
              </h3>
              <p className="text-[11px] text-slate-500">
                Copie a tabela do seu Excel (selecione as colunas sem o cabeçalho) e cole diretamente no campo abaixo.
                O formato deve conter as colunas nesta ordem: <strong className="font-mono bg-white px-1 py-0.2 rounded border border-slate-200">Coil Number | BL | Navio | Viagem</strong>.
              </p>
            </div>
            <button onClick={() => setIsImporting(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            <textarea
              className="w-full h-36 font-mono text-xs p-3 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 bg-white outline-none"
              placeholder="Cole aqui as linhas copiadas do seu Excel...&#10;Ex:&#10;COIL-M201&#9;BL-SAD4930&#9;MS Aliança&#9;V-102&#10;COIL-M202&#9;BL-SAD4930&#9;MS Aliança&#9;V-102"
              value={pasteText}
              onChange={handlePasteChange}
            />

            {pasteError && (
              <p className="text-[11px] text-red-600 font-semibold bg-red-50 p-2 rounded border border-red-100 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {pasteError}
              </p>
            )}

            {parsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
                  <span>Visualização de Carga da Planilha ({parsedRows.length} linhas detectadas)</span>
                  <span className="text-blue-600">Formato Correto</span>
                </div>

                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded bg-white text-[11px] font-mono">
                  <table className="w-full border-collapse">
                    <thead className="bg-slate-50 text-[10px] text-slate-400 font-bold uppercase border-b sticky top-0">
                      <tr>
                        <th className="py-1 px-3 text-left">Coil Number</th>
                        <th className="py-1 px-3 text-left">BL</th>
                        <th className="py-1 px-3 text-left">Navio</th>
                        <th className="py-1 px-3 text-left">Viagem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {parsedRows.slice(0, 10).map((row, idx) => (
                        <tr key={idx}>
                          <td className="py-1 px-3 font-bold text-blue-600">{row.coilNumber}</td>
                          <td className="py-1 px-3">{row.BL}</td>
                          <td className="py-1 px-3 font-sans">{row.navio}</td>
                          <td className="py-1 px-3">{row.viagem}</td>
                        </tr>
                      ))}
                      {parsedRows.length > 10 && (
                        <tr>
                          <td colSpan={4} className="py-1.5 px-3 text-center bg-slate-50 text-slate-400 italic text-[10px]">
                            ... e mais {parsedRows.length - 10} linha(s) ...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setPasteText("");
                      setParsedRows([]);
                    }}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded font-bold uppercase"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={handleBulkImport}
                    disabled={loading}
                    className="px-4 py-1.5 bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold rounded uppercase flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Importar e Gravar {parsedRows.length} Linhas na Tabela
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Table Interface Grid (Add Manual Row + Table Grid View) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left column: Add/Modify single record manually */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-3">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-slate-500" />
                {subTab === "previsto" ? "Cadastrar Carga Prevista" : "Inserir Recebimento Físico"}
              </h3>
            </div>

            <form onSubmit={handleAddSingleRow} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Coil Number (Chave Primária)
                </label>
                <input
                  type="text"
                  required
                  placeholder="EX: COIL-Z100"
                  value={coilNumber}
                  onChange={(e) => setCoilNumber(e.target.value)}
                  className="w-full text-xs font-mono rounded border border-slate-300 px-3 py-2 uppercase outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  BL (Bill of Lading)
                </label>
                <input
                  type="text"
                  required
                  placeholder="EX: BL-SAD4930"
                  value={bl}
                  onChange={(e) => setBl(e.target.value)}
                  className="w-full text-xs font-mono rounded border border-slate-300 px-3 py-2 uppercase outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Navio
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="EX: MS Aliança"
                    value={navio}
                    onChange={(e) => setNavio(e.target.value)}
                    className="w-full text-xs rounded border border-slate-300 px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Viagem
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="EX: V-102"
                    value={viagem}
                    onChange={(e) => setViagem(e.target.value)}
                    className="w-full text-xs font-mono rounded border border-slate-300 px-3 py-2 uppercase outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {subTab === "recebido" && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Observações / Avarias (Opcional)
                  </label>
                  <textarea
                    placeholder="Registrar estado da descarga..."
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    className="w-full text-xs rounded border border-slate-300 p-2 outline-none focus:ring-1 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-slate-800 hover:bg-black text-white text-xs font-bold uppercase rounded shadow transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Gravar Linha na Tabela
              </button>
            </form>
          </div>

          <div className="bg-slate-100 p-3.5 rounded-lg border border-slate-200 text-xs space-y-1.5">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Regras Relacionais Portuárias</h4>
            <p className="text-slate-600 text-[11px] font-sans leading-relaxed">
              O sistema utiliza validações estritas contra duplicações. Toda inserção de linha na grade atualiza instantaneamente as outras seções do painel, fornecendo segurança operacional em tempo real contra perdas de dados.
            </p>
          </div>
        </div>

        {/* Right column: High-density spreadsheet-like grid view */}
        <div className="lg:col-span-8 flex flex-col bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden min-h-[420px]">
          
          {/* Grid control bar */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={`Pesquisar por Bobina, BL, Navio ou Viagem...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs rounded border border-slate-300 py-1.5 pl-9 pr-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            
            <div className="flex items-center justify-between sm:justify-end gap-3">
              <div className="flex bg-slate-200 p-0.5 rounded text-[10px] font-bold uppercase">
                <button
                  onClick={() => setViewMode("navios")}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                    viewMode === "navios" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Ship className="h-3 w-3" />
                  Por Navio ({groupedByNavio.length})
                </button>
                <button
                  onClick={() => setViewMode("plano")}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                    viewMode === "plano" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Layers className="h-3 w-3" />
                  Lista Plana
                </button>
              </div>

              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider hidden lg:inline">
                {subTab === "previsto" 
                  ? `${filteredPrevisto.length} de ${estoquePrevisto.length} bobinas` 
                  : `${filteredRecebido.length} de ${estoqueRecebido.length} bobinas`}
              </span>
            </div>
          </div>

          {/* Table proper / Ship view */}
          <div className="flex-1 overflow-auto max-h-[500px]">
            {viewMode === "navios" ? (
              groupedByNavio.length === 0 ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                  {subTab === "previsto" ? (
                    <>
                      <Database className="h-10 w-10 text-slate-300 mb-2" />
                      <p className="text-xs font-bold text-slate-500 uppercase">Tabela de Planejamento Vazia</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                        Não há registros nesta tabela. Use o formulário à esquerda ou cole uma planilha do Excel para popular.
                      </p>
                    </>
                  ) : (
                    <>
                      <Table className="h-10 w-10 text-slate-300 mb-2" />
                      <p className="text-xs font-bold text-slate-500 uppercase">Tabela de Recebimento Vazia</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                        Nenhuma bobina foi conferida fisicamente ou cadastrada na base de descarga física ainda.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {groupedByNavio.map((group) => (
                    <div
                      key={group.navio}
                      onClick={() => setSelectedNavioModalName(group.navio)}
                      className="bg-white border border-slate-200 hover:border-blue-500 rounded-lg p-4 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              <Ship className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="font-extrabold text-sm text-slate-800 group-hover:text-blue-600 transition-colors">
                                {group.navio}
                              </h4>
                              <p className="text-[11px] text-slate-400 font-mono">
                                Viagem: {group.viagens.slice(0, 2).join(", ")}{group.viagens.length > 2 ? ` (+${group.viagens.length - 2})` : ""}
                              </p>
                            </div>
                          </div>
                          <span className="bg-blue-50 text-blue-700 font-bold text-xs font-mono px-2.5 py-1 rounded-full border border-blue-200 shrink-0">
                            {group.items.length} {group.items.length === 1 ? "Coil" : "Coils"}
                          </span>
                        </div>

                        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-bold">
                              {group.bls.length} BL(s)
                            </span>
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-bold">
                              {group.viagens.length} Viagem(ns)
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-blue-600 font-extrabold text-[11px] uppercase tracking-wider group-hover:translate-x-0.5 transition-transform">
                            <span>Abrir Coils</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : subTab === "previsto" ? (
              filteredPrevisto.length === 0 ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                  <Database className="h-10 w-10 text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-500 uppercase">Tabela de Planejamento Vazia</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                    Não há registros nesta tabela. Use o formulário à esquerda ou cole uma planilha do Excel para popular.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-4">Coil Number (Chave)</th>
                      <th className="py-2.5 px-4">BL (Bill of Lading)</th>
                      <th className="py-2.5 px-4">Navio</th>
                      <th className="py-2.5 px-4">Viagem</th>
                      <th className="py-2.5 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                    {filteredPrevisto.map((row) => (
                      <tr key={row.coilNumber} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-bold text-blue-600">{row.coilNumber}</td>
                        <td className="py-2.5 px-4 text-slate-500">{row.BL}</td>
                        <td className="py-2.5 px-4 font-sans text-slate-600 font-medium">{row.navio}</td>
                        <td className="py-2.5 px-4">{row.viagem}</td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => handleDeleteRow(row.coilNumber)}
                            className="text-red-500 hover:text-red-700 font-bold hover:underline text-[10px] uppercase cursor-pointer"
                          >
                            [Excluir]
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              filteredRecebido.length === 0 ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                  <Table className="h-10 w-10 text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-500 uppercase">Tabela de Recebimento Vazia</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                    Nenhuma bobina foi conferida fisicamente ou cadastrada na base de descarga física ainda.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-4">Coil (Chave)</th>
                      <th className="py-2.5 px-4">BL</th>
                      <th className="py-2.5 px-4">Navio / Viagem</th>
                      <th className="py-2.5 px-4">Data / Operador</th>
                      <th className="py-2.5 px-4">Observações</th>
                      <th className="py-2.5 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                    {filteredRecebido.map((row) => (
                      <tr key={row.coilNumber} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-bold text-blue-600">{row.coilNumber}</td>
                        <td className="py-2.5 px-4 text-slate-400">{row.BL}</td>
                        <td className="py-2.5 px-4 font-sans text-slate-600 font-medium truncate max-w-[150px]">
                          {row.navio} • {row.viagem}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-sans text-[11px]">
                          <div>{new Date(row.dataRecebimento).toLocaleDateString()}</div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase">{row.usuarioRecebimento.split("@")[0]}</div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-sans italic truncate max-w-[150px]" title={row.observacoes}>
                          {row.observacoes || "-"}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => handleDeleteRow(row.coilNumber)}
                            className="text-red-500 hover:text-red-700 font-bold hover:underline text-[10px] uppercase cursor-pointer"
                          >
                            [Excluir]
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>

      </div>

      {/* Pop-up Modal with Coil Numbers list for the selected Navio */}
      {currentNavioModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 rounded-lg text-white shadow-md">
                  <Ship className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      Navio: {currentNavioModalData.navio}
                    </h3>
                    <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-mono font-bold uppercase">
                      {subTab === "previsto" ? "Planejamento" : "Recebimento Físico"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Viagem(ns): <span className="text-slate-200 font-mono">{currentNavioModalData.viagens.join(", ")}</span> • BL(s): <span className="text-slate-200 font-mono">{currentNavioModalData.bls.join(", ")}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedNavioModalName(null);
                  setModalSearchTerm("");
                }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Search Toolbar */}
            <div className="p-4 bg-slate-100 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar por BL (ex: BL-SAD4930) ou Coil Number (ex: COIL-Z100)..."
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 py-2 pl-9 pr-8 text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 shadow-2xs font-medium"
                />
                {modalSearchTerm && (
                  <button
                    onClick={() => setModalSearchTerm("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Stats & Expand/Collapse Controls */}
              <div className="flex items-center justify-between sm:justify-end gap-2.5">
                <span className="text-xs text-slate-600 font-bold bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                  {filteredModalItems.length} {filteredModalItems.length === 1 ? "bobina" : "bobinas"} em {modalHierarchy.length} BL(s)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleAllModalBLs(true)}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-200 transition-colors cursor-pointer uppercase"
                    title="Expandir todas as pastas de BL"
                  >
                    Expandir
                  </button>
                  <button
                    onClick={() => handleToggleAllModalBLs(false)}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-200 transition-colors cursor-pointer uppercase"
                    title="Recolher todas as pastas de BL"
                  >
                    Recolher
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Body / Hierarchical View */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-slate-50/80 space-y-4">
              {modalHierarchy.length === 0 ? (
                <div className="p-10 bg-white rounded-xl border border-slate-200 text-center text-slate-400 space-y-2">
                  <FolderTree className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600 uppercase">
                    Nenhum resultado encontrado
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Não encontramos bobinas ou BLs correspondentes à pesquisa "<strong className="text-slate-600 font-mono">{modalSearchTerm}</strong>" neste navio.
                  </p>
                </div>
              ) : (
                modalHierarchy.map((blGroup) => {
                  const isExpanded = modalSearchTerm.trim() !== "" || modalOpenBLs[blGroup.blName] !== false;

                  return (
                    <div
                      key={blGroup.blName}
                      className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden transition-all"
                    >
                      {/* Hierarchical Level 1 Header: BL Node */}
                      <div
                        onClick={() => toggleModalBL(blGroup.blName)}
                        className="px-4 py-3 bg-gradient-to-r from-slate-100 to-slate-50 hover:bg-slate-100/90 border-b border-slate-200 flex items-center justify-between cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-blue-600 text-white rounded-md shadow-2xs">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">BL:</span>
                              <h4 className="text-sm font-black font-mono text-slate-800 uppercase tracking-tight">
                                {blGroup.blName}
                              </h4>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                              <span>Viagem: <strong className="font-mono text-slate-700">{Array.from(blGroup.viagens).join(", ") || "-"}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 font-mono">
                            {blGroup.coils.length} {blGroup.coils.length === 1 ? "Bobina" : "Bobinas"}
                          </span>
                          <div className="text-slate-400 hover:text-slate-600 p-1">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-blue-600" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Hierarchical Level 2: Coil Numbers list nested inside BL */}
                      {isExpanded && (
                        <div className="p-3 bg-slate-50/50">
                          <div className="border-l-2 border-blue-400/80 ml-2 pl-3 py-1 space-y-2">
                            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-2xs">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead className="bg-slate-100/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b">
                                  <tr>
                                    <th className="py-2 px-3">Coil Number (Chave)</th>
                                    <th className="py-2 px-3">Viagem</th>
                                    {subTab === "recebido" && (
                                      <>
                                        <th className="py-2 px-3">Data / Operador</th>
                                        <th className="py-2 px-3">Observações / Avarias</th>
                                      </>
                                    )}
                                    <th className="py-2 px-3 text-right">Ação</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                                  {blGroup.coils.map((row) => (
                                    <tr key={row.coilNumber} className="hover:bg-blue-50/30 transition-colors">
                                      <td className="py-2 px-3 font-bold text-blue-600 text-xs">
                                        <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-mono">
                                          {row.coilNumber}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-slate-600">
                                        {row.viagem || "-"}
                                      </td>
                                      {subTab === "recebido" && (
                                        <>
                                          <td className="py-2 px-3 text-slate-500 font-sans text-[11px]">
                                            <div>{new Date(row.dataRecebimento).toLocaleDateString()}</div>
                                            <div className="text-[9px] text-slate-400 font-bold uppercase">{row.usuarioRecebimento?.split("@")[0] || "-"}</div>
                                          </td>
                                          <td className="py-2 px-3 text-slate-500 font-sans italic max-w-[200px] truncate" title={row.observacoes}>
                                            {row.observacoes || "-"}
                                          </td>
                                        </>
                                      )}
                                      <td className="py-2 px-3 text-right">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteRow(row.coilNumber);
                                          }}
                                          className="text-red-500 hover:text-red-700 font-bold hover:underline text-[10px] uppercase cursor-pointer px-2 py-1"
                                        >
                                          [Excluir]
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-white px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500 hidden sm:inline">
                Filtre por <strong>BL</strong> ou <strong>Coil Number</strong> no campo superior. Clique em <strong>[Excluir]</strong> para remover a bobina.
              </span>
              <button
                onClick={() => {
                  setSelectedNavioModalName(null);
                  setModalSearchTerm("");
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition-colors cursor-pointer uppercase text-xs shadow-sm ml-auto"
              >
                Fechar Pop-up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal (Anti-Acidental Click) */}
      {confirmDeleteCoilId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5 font-bold text-sm">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <span>Confirmar Exclusão de Bobina</span>
              </div>
              <button
                onClick={() => setConfirmDeleteCoilId(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-700 font-medium leading-relaxed">
                Deseja realmente excluir permanentemente o registro da bobina{" "}
                <strong className="text-red-600 font-mono text-base">{confirmDeleteCoilId}</strong> do banco de dados?
              </p>
              <p className="text-xs text-slate-500 bg-amber-50 p-2.5 rounded border border-amber-200/80">
                <strong>Atenção:</strong> Esta medida de segurança protege contra cliques por engano. A remoção não poderá ser desfeita e atualizará o estoque imediatamente.
              </p>
            </div>
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setConfirmDeleteCoilId(null)}
                className="px-4 py-2 rounded text-xs font-bold text-slate-600 hover:bg-slate-200/80 transition-colors cursor-pointer uppercase"
              >
                Cancelar
              </button>
              <button
                onClick={() => executeDeleteRow(confirmDeleteCoilId)}
                className="px-4 py-2 rounded text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer uppercase shadow-xs"
              >
                Sim, Excluir Bobina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
