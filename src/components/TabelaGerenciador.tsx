import React, { useState } from "react";
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
  Search
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
  const handleDeleteRow = async (id: string) => {
    if (!confirm(`Deseja realmente remover o registro da bobina ${id}?`)) return;

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
                placeholder={`Pesquisar na tabela de ${subTab === "previsto" ? "planejamento" : "recebimento"}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs rounded border border-slate-300 py-1.5 pl-9 pr-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              {subTab === "previsto" 
                ? `${filteredPrevisto.length} de ${estoquePrevisto.length} registros filtrados` 
                : `${filteredRecebido.length} de ${estoqueRecebido.length} registros filtrados`}
            </span>
          </div>

          {/* Table proper */}
          <div className="flex-1 overflow-auto max-h-[500px]">
            {subTab === "previsto" ? (
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
    </div>
  );
}
