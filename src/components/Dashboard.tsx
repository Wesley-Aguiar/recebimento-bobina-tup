import React, { useState, useMemo } from "react";
import { EstoquePrevisto, EstoqueRecebido } from "../types";
import { 
  ChevronDown, 
  ChevronRight, 
  Ship, 
  Compass, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Percent, 
  AlertCircle,
  TrendingUp,
  Search,
  Filter,
  Users,
  Download,
  Award,
  FileSpreadsheet,
  Sparkles,
  X,
  Printer,
  Archive
} from "lucide-react";

interface DashboardProps {
  estoquePrevisto: EstoquePrevisto[];
  estoqueRecebido: EstoqueRecebido[];
}

// Tree interfaces
interface CoilStatus {
  coilNumber: string;
  received: boolean;
  dataRecebimento?: string;
  usuarioRecebimento?: string;
  observacoes?: string;
}

interface BLNode {
  BLName: string;
  coils: CoilStatus[];
  totalPrevisto: number;
  totalRecebido: number;
  saldo: number;
}

interface ViagemNode {
  viagemName: string;
  bls: { [blName: string]: BLNode };
  totalPrevisto: number;
  totalRecebido: number;
  saldo: number;
}

interface NavioNode {
  navioName: string;
  viagens: { [viagemName: string]: ViagemNode };
  totalPrevisto: number;
  totalRecebido: number;
  saldo: number;
}

export default function Dashboard({ estoquePrevisto, estoqueRecebido }: DashboardProps) {
  // Navigation / Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [navioFilter, setNavioFilter] = useState("TODOS");
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "EM_ANDAMENTO" | "CONCLUIDO">("TODOS");
  const [selectedRelatorioNavio, setSelectedRelatorioNavio] = useState<{
    navioName: string;
    totalPrevisto: number;
    totalRecebido: number;
    saldo: number;
    percent: number;
    viagensCount: number;
    blsCount: number;
    viagens: Set<string>;
    bls: Set<string>;
    status: "CONCLUIDO" | "EM_ANDAMENTO";
  } | null>(null);

  // Accordion Open/Closed States (keys of open nodes)
  const [openNavios, setOpenNavios] = useState<{ [key: string]: boolean }>({});
  const [openViagens, setOpenViagens] = useState<{ [key: string]: boolean }>({});
  const [openBLs, setOpenBLs] = useState<{ [key: string]: boolean }>({});

  const toggleNavio = (navio: string) => {
    setOpenNavios(prev => ({ ...prev, [navio]: !prev[navio] }));
  };

  const toggleViagem = (key: string) => {
    setOpenViagens(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleBL = (key: string) => {
    setOpenBLs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Convert received stock to a map for O(1) lookups
  const receivedMap = useMemo(() => {
    const map = new Map<string, EstoqueRecebido>();
    estoqueRecebido.forEach(item => {
      map.set(item.coilNumber.toUpperCase(), item);
    });
    return map;
  }, [estoqueRecebido]);

  // Extract list of unique Ships for select filter
  const listUniqueNavios = useMemo(() => {
    const ships = new Set<string>();
    estoquePrevisto.forEach(item => ships.add(item.navio));
    return Array.from(ships);
  }, [estoquePrevisto]);

  // Compute Tree with Totals and Balances
  const hierarchyTree = useMemo(() => {
    const tree: { [navioName: string]: NavioNode } = {};

    // 1. Filter original list by Ship and search terms
    const filteredPrevisto = estoquePrevisto.filter(item => {
      const matchShip = navioFilter === "TODOS" || item.navio === navioFilter;
      const matchSearch = 
        item.coilNumber.toUpperCase().includes(searchTerm.toUpperCase()) ||
        item.BL.toUpperCase().includes(searchTerm.toUpperCase()) ||
        item.navio.toUpperCase().includes(searchTerm.toUpperCase());
      return matchShip && matchSearch;
    });

    // 2. Build the tree structure
    filteredPrevisto.forEach(item => {
      const { navio, viagem, BL, coilNumber } = item;
      
      // Initialize Navio
      if (!tree[navio]) {
        tree[navio] = {
          navioName: navio,
          viagens: {},
          totalPrevisto: 0,
          totalRecebido: 0,
          saldo: 0
        };
      }

      // Initialize Viagem
      if (!tree[navio].viagens[viagem]) {
        tree[navio].viagens[viagem] = {
          viagemName: viagem,
          bls: {},
          totalPrevisto: 0,
          totalRecebido: 0,
          saldo: 0
        };
      }

      // Initialize BL
      if (!tree[navio].viagens[viagem].bls[BL]) {
        tree[navio].viagens[viagem].bls[BL] = {
          BLName: BL,
          coils: [],
          totalPrevisto: 0,
          totalRecebido: 0,
          saldo: 0
        };
      }

      // Check receipt status of individual coil
      const receivedInfo = receivedMap.get(coilNumber.toUpperCase());
      const isReceived = !!receivedInfo;

      const status: CoilStatus = {
        coilNumber,
        received: isReceived,
        dataRecebimento: receivedInfo?.dataRecebimento,
        usuarioRecebimento: receivedInfo?.usuarioRecebimento,
        observacoes: receivedInfo?.observacoes
      };

      // Push coil to BL node list
      tree[navio].viagens[viagem].bls[BL].coils.push(status);
    });

    // 3. Compute sums and balances up the hierarchy
    (Object.values(tree) as NavioNode[]).forEach(navioNode => {
      (Object.values(navioNode.viagens) as ViagemNode[]).forEach(viagemNode => {
        (Object.values(viagemNode.bls) as BLNode[]).forEach(blNode => {
          blNode.totalPrevisto = blNode.coils.length;
          blNode.totalRecebido = blNode.coils.filter(c => c.received).length;
          blNode.saldo = blNode.totalPrevisto - blNode.totalRecebido;

          // Add to Viagem
          viagemNode.totalPrevisto += blNode.totalPrevisto;
          viagemNode.totalRecebido += blNode.totalRecebido;
        });
        viagemNode.saldo = viagemNode.totalPrevisto - viagemNode.totalRecebido;

        // Add to Navio
        navioNode.totalPrevisto += viagemNode.totalPrevisto;
        navioNode.totalRecebido += viagemNode.totalRecebido;
      });
      navioNode.saldo = navioNode.totalPrevisto - navioNode.totalRecebido;
    });

    return tree;
  }, [estoquePrevisto, receivedMap, navioFilter, searchTerm]);

  // Per-Ship Summary KPI Metrics (Separado por Navio)
  const naviosSummaryList = useMemo(() => {
    const map = new Map<string, {
      navioName: string;
      totalPrevisto: number;
      totalRecebido: number;
      viagens: Set<string>;
      bls: Set<string>;
    }>();

    const allShips = new Set<string>();
    estoquePrevisto.forEach(item => allShips.add(item.navio || "SEM NAVIO"));
    estoqueRecebido.forEach(item => allShips.add(item.navio || "SEM NAVIO"));

    allShips.forEach(navioName => {
      if (navioFilter !== "TODOS" && navioName !== navioFilter) return;
      map.set(navioName, {
        navioName,
        totalPrevisto: 0,
        totalRecebido: 0,
        viagens: new Set(),
        bls: new Set()
      });
    });

    estoquePrevisto.forEach(item => {
      const navioName = item.navio || "SEM NAVIO";
      if (navioFilter !== "TODOS" && navioName !== navioFilter) return;
      const entry = map.get(navioName);
      if (entry) {
        entry.totalPrevisto += 1;
        if (item.viagem) entry.viagens.add(item.viagem);
        if (item.BL) entry.bls.add(item.BL);
        if (receivedMap.has(item.coilNumber.toUpperCase())) {
          entry.totalRecebido += 1;
        }
      }
    });

    const previstoCoilsSet = new Set(estoquePrevisto.map(p => p.coilNumber.toUpperCase()));
    estoqueRecebido.forEach(item => {
      const navioName = item.navio || "SEM NAVIO";
      if (navioFilter !== "TODOS" && navioName !== navioFilter) return;
      const entry = map.get(navioName);
      if (entry) {
        if (item.viagem) entry.viagens.add(item.viagem);
        if (item.BL) entry.bls.add(item.BL);
        if (!previstoCoilsSet.has(item.coilNumber.toUpperCase())) {
          entry.totalRecebido += 1;
        }
      }
    });

    return Array.from(map.values()).map(entry => {
      const saldo = entry.totalPrevisto - entry.totalRecebido;
      const percent = entry.totalPrevisto > 0
        ? Math.round((entry.totalRecebido / entry.totalPrevisto) * 100)
        : (entry.totalRecebido > 0 ? 100 : 0);
      const status: "CONCLUIDO" | "EM_ANDAMENTO" = (percent >= 100 && entry.totalPrevisto > 0) || (entry.totalPrevisto === 0 && entry.totalRecebido > 0) ? "CONCLUIDO" : "EM_ANDAMENTO";
      return {
        ...entry,
        viagensCount: entry.viagens.size,
        blsCount: entry.bls.size,
        saldo,
        percent,
        status
      };
    }).sort((a, b) => a.navioName.localeCompare(b.navioName));
  }, [estoquePrevisto, estoqueRecebido, receivedMap, navioFilter]);

  // Overall Global KPI Metrics
  const globalKPIs = useMemo(() => {
    const totalPrevisto = estoquePrevisto.length;
    const totalRecebido = estoqueRecebido.length;
    const saldo = totalPrevisto - totalRecebido;
    const percent = totalPrevisto > 0 ? Math.round((totalRecebido / totalPrevisto) * 100) : 0;

    return { totalPrevisto, totalRecebido, saldo, percent };
  }, [estoquePrevisto, estoqueRecebido]);

  // Filtered list by Operational Status (Em Andamento vs Concluído)
  const filteredNaviosList = useMemo(() => {
    return naviosSummaryList.filter(navio => {
      if (statusFilter === "TODOS") return true;
      return navio.status === statusFilter;
    });
  }, [naviosSummaryList, statusFilter]);

  // Status counts for badge tabs
  const countsByStatus = useMemo(() => {
    let emAndamento = 0;
    let concluido = 0;
    naviosSummaryList.forEach(n => {
      if (n.status === "CONCLUIDO") concluido++;
      else emAndamento++;
    });
    return {
      total: naviosSummaryList.length,
      emAndamento,
      concluido
    };
  }, [naviosSummaryList]);

  // Function to export CSV Report for a Specific Ship
  const exportarCSVNavio = (navioName: string) => {
    const coilsForShipPrev = estoquePrevisto.filter(p => (p.navio || "SEM NAVIO") === navioName);
    const coilsForShipRec = estoqueRecebido.filter(r => (r.navio || "SEM NAVIO") === navioName);
    
    const recMap = new Map<string, EstoqueRecebido>();
    coilsForShipRec.forEach(r => recMap.set(r.coilNumber.toUpperCase(), r));

    const lines: string[] = [];
    lines.push("NAVIO;VIAGEM;BL;BOBINA;PESO_BRUTO;STATUS_OPERACAO;DATA_RECEBIMENTO;USUARIO_RECEBIMENTO;OBSERVACOES");

    const processedCoils = new Set<string>();

    coilsForShipPrev.forEach(p => {
      const cNum = p.coilNumber.toUpperCase();
      processedCoils.add(cNum);
      const rec = recMap.get(cNum);
      const status = rec ? "CONCLUIDO / DESCARREGADO" : "PENDENTE NO ESTOQUE";
      const dataRec = rec?.dataRecebimento ? new Date(rec.dataRecebimento).toLocaleString("pt-BR") : "-";
      const userRec = rec?.usuarioRecebimento || "-";
      const obs = (rec?.observacoes || "").replace(/;/g, ",");
      lines.push(`${p.navio};${p.viagem};${p.BL};${p.coilNumber};${p.grossWeight || ""};${status};${dataRec};${userRec};${obs}`);
    });

    coilsForShipRec.forEach(r => {
      const cNum = r.coilNumber.toUpperCase();
      if (!processedCoils.has(cNum)) {
        const dataRec = r.dataRecebimento ? new Date(r.dataRecebimento).toLocaleString("pt-BR") : "-";
        const userRec = r.usuarioRecebimento || "-";
        const obs = (r.observacoes || "").replace(/;/g, ",");
        lines.push(`${r.navio || navioName};${r.viagem || ""};${r.BL || ""};${r.coilNumber};${r.grossWeight || ""};EXTRA / NAO PREVISTO;${dataRec};${userRec};${obs}`);
      }
    });

    const csvContent = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Relatorio_Fechamento_Descarga_${navioName.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      
      {/* Control Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por Coil Number ou BL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded border border-slate-300 py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between md:justify-end gap-3">
          {/* Filter by Ship */}
          <div className="flex items-center gap-2 text-xs">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-500 font-medium">Filtrar Navio:</span>
            <select
              value={navioFilter}
              onChange={(e) => setNavioFilter(e.target.value)}
              className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="TODOS">Todos os Navios ({listUniqueNavios.length})</option>
              {listUniqueNavios.map(ship => (
                <option key={ship} value={ship}>{ship}</option>
              ))}
            </select>
          </div>

          {/* Global Summary Badge */}
          <div className="bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded text-[10px] font-mono font-bold text-slate-600 flex items-center gap-1.5">
            <span>TERMINAL:</span>
            <span className="text-blue-600">{globalKPIs.totalPrevisto} PREV</span>
            <span>•</span>
            <span className="text-emerald-600">{globalKPIs.totalRecebido} REC</span>
            <span>({globalKPIs.percent}%)</span>
          </div>
        </div>

      </div>

      {/* Painéis Operacionais Separados por Navio */}
      <div className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Ship className="h-4 w-4 text-blue-600" />
              <span>Painel Logístico por Navio ({filteredNaviosList.length})</span>
            </h3>
            {navioFilter !== "TODOS" && (
              <button
                onClick={() => setNavioFilter("TODOS")}
                className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>[Ver todos]</span>
              </button>
            )}
          </div>

          {/* Abas de Filtro de Estado Operacional */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-[11px] font-bold">
            <button
              onClick={() => setStatusFilter("TODOS")}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                statusFilter === "TODOS"
                  ? "bg-white text-slate-800 shadow-2xs border border-slate-200/80"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Todos ({countsByStatus.total})
            </button>
            <button
              onClick={() => setStatusFilter("EM_ANDAMENTO")}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === "EM_ANDAMENTO"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-500 hover:text-blue-600"
              }`}
            >
              <Clock className="h-3 w-3" />
              <span>Em Andamento ({countsByStatus.emAndamento})</span>
            </button>
            <button
              onClick={() => setStatusFilter("CONCLUIDO")}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === "CONCLUIDO"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-500 hover:text-emerald-600"
              }`}
            >
              <Award className="h-3 w-3" />
              <span>Finalizados ({countsByStatus.concluído})</span>
            </button>
          </div>
        </div>

        {filteredNaviosList.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">
            <Archive className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-xs font-bold uppercase text-slate-500">
              Nenhum navio encontrado com o filtro "{statusFilter === "CONCLUIDO" ? "Finalizados" : statusFilter === "EM_ANDAMENTO" ? "Em Andamento" : "Todos"}"
            </p>
          </div>
        ) : (
          filteredNaviosList.map((navio) => {
            const isFinished = navio.status === "CONCLUIDO";
            return (
              <div
                key={navio.navioName}
                className={`rounded-xl border shadow-sm overflow-hidden transition-all ${
                  isFinished
                    ? "border-emerald-300 bg-gradient-to-b from-emerald-50/40 to-white shadow-emerald-500/5"
                    : "border-slate-200 bg-white hover:border-blue-300"
                }`}
              >
                {/* Header do Navio no Painel */}
                <div className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${
                  isFinished
                    ? "bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white border-emerald-800"
                    : "bg-slate-900 text-white border-slate-800"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg text-white shadow-xs ${isFinished ? "bg-emerald-600" : "bg-blue-600"}`}>
                      {isFinished ? <Award className="h-5 w-5 animate-pulse" /> : <Ship className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-extrabold tracking-tight uppercase text-white">{navio.navioName}</h4>
                        <span className="text-[10px] bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded font-mono uppercase border border-slate-700">
                          {navio.viagensCount} {navio.viagensCount === 1 ? "Viagem" : "Viagens"}
                        </span>
                        {isFinished ? (
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-emerald-400" /> Operação 100% Finalizada
                          </span>
                        ) : (
                          <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                            <Clock className="h-3 w-3 text-blue-400" /> Descarga Em Andamento
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        BL(s): <span className="text-slate-200">{Array.from(navio.bls).slice(0, 5).join(", ")}{navio.bls.size > 5 ? ` (+${navio.bls.size - 5})` : ""}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                    {navioFilter !== navio.navioName && (
                      <button
                        onClick={() => setNavioFilter(navio.navioName)}
                        className="text-[10px] font-bold uppercase bg-slate-800 hover:bg-slate-700 text-blue-300 px-2.5 py-1.5 rounded border border-slate-700 transition-colors cursor-pointer"
                      >
                        Filtrar Este
                      </button>
                    )}

                    {/* Botão de Fechamento / Relatório */}
                    <button
                      onClick={() => setSelectedRelatorioNavio(navio)}
                      className={`px-3 py-1.5 rounded text-[11px] font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                        isFinished
                          ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                      }`}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span>{isFinished ? "Emitir Relatório de Fechamento" : "Resumo da Operação"}</span>
                    </button>

                    <div className="flex items-center gap-1.5 bg-slate-800/90 px-3 py-1.5 rounded-full border border-slate-700 shadow-inner">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Progresso:</span>
                      <span className={`text-xs font-mono font-extrabold ${
                        isFinished ? "text-emerald-400" : "text-blue-400"
                      }`}>
                        {navio.percent}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mensagem de Celebração Operacional se concluído */}
                {isFinished && (
                  <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs text-emerald-800">
                    <div className="flex items-center gap-2 font-medium">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>Conclusão Operacional:</strong> Todas as bobinas previstas para o navio <strong>{navio.navioName}</strong> foram devidamente recebidas no pátio do terminal. Saldo zerado!</span>
                    </div>
                    <button
                      onClick={() => exportarCSVNavio(navio.navioName)}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-2"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Baixar CSV</span>
                    </button>
                  </div>
                )}

                {/* 4 KPI Cards por Navio */}
                <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/60">
                  
                  {/* Card 1: Previsto */}
                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estoque Previsto</span>
                      <div className="text-xl font-bold text-slate-800 font-mono leading-none">{navio.totalPrevisto}</div>
                      <p className="text-[10px] text-slate-400">Bobinas manifestadas</p>
                    </div>
                    <div className="rounded bg-blue-50 p-2 text-blue-600">
                      <Ship className="h-4.5 w-4.5" />
                    </div>
                  </div>

                  {/* Card 2: Recebido */}
                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estoque Recebido</span>
                      <div className="text-xl font-bold text-emerald-600 font-mono leading-none">{navio.totalRecebido}</div>
                      <p className="text-[10px] text-emerald-600 font-medium">Bobinas descarregadas</p>
                    </div>
                    <div className="rounded bg-emerald-50 p-2 text-emerald-600">
                      <CheckCircle2 className="h-4.5 w-4.5" />
                    </div>
                  </div>

                  {/* Card 3: Saldo */}
                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo Pendente</span>
                      <div className={`text-xl font-bold font-mono leading-none ${isFinished ? "text-emerald-600" : "text-amber-600"}`}>
                        {navio.saldo}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {isFinished ? "Nenhuma pendência" : "Restante a descarregar"}
                      </p>
                    </div>
                    <div className={`rounded p-2 ${isFinished ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                      {isFinished ? <Award className="h-4.5 w-4.5" /> : <Clock className="h-4.5 w-4.5" />}
                    </div>
                  </div>

                  {/* Card 4: Progresso */}
                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Eficiência da Descarga</span>
                      <span className={`text-xs font-bold font-mono ${isFinished ? "text-emerald-600" : "text-blue-600"}`}>
                        {navio.percent}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 mt-1.5">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          isFinished ? "bg-emerald-500" : "bg-blue-600"
                        }`}
                        style={{ width: `${navio.percent}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 font-sans mt-1">
                      {navio.totalRecebido} de {navio.totalPrevisto} bobinas concluídas
                    </p>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Hierarchical Accordion View */}
      <div className="space-y-2">
        <div className="flex items-center justify-between pl-1">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Painel Logístico Hierárquico • Navio &gt; Viagem &gt; BL
          </h3>
          <span className="text-[10px] font-mono text-slate-400">Total: {Object.keys(hierarchyTree).length} Navio(s)</span>
        </div>
        
        {Object.keys(hierarchyTree).length === 0 ? (
          <div className="rounded border border-slate-200 bg-white p-12 text-center text-slate-400">
            <AlertCircle className="mx-auto h-10 w-10 text-slate-300 mb-2" />
            <p className="text-xs font-bold uppercase text-slate-500">Nenhum registro correspondente</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-1">
              Refine os termos de busca ou certifique-se de que os filtros selecionados cobrem bobinas ativas.
            </p>
          </div>
        ) : (
          (Object.values(hierarchyTree) as NavioNode[]).map((navioNode) => {
            const isNavioOpen = !!openNavios[navioNode.navioName];
            const navioPercent = navioNode.totalPrevisto > 0 
              ? Math.round((navioNode.totalRecebido / navioNode.totalPrevisto) * 100) 
              : 0;

            return (
              <div 
                key={navioNode.navioName}
                className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm"
              >
                {/* LEVEL 1: NAVIO HEADER */}
                <div 
                  onClick={() => toggleNavio(navioNode.navioName)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 hover:bg-slate-100/80 px-4 py-2.5 cursor-pointer select-none border-b border-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-slate-400 shrink-0">
                      {isNavioOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                    <div className="text-blue-600 shrink-0">
                      <Ship className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-tight">{navioNode.navioName}</h4>
                      <p className="text-[9px] text-slate-400 uppercase font-mono">Embarcação</p>
                    </div>
                  </div>

                  {/* Navio Stats Block */}
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-slate-500">Previsto: <strong className="text-slate-700 font-mono">{navioNode.totalPrevisto}</strong></span>
                    <span className="text-slate-300">|</span>
                    <span className="text-emerald-600">Recebido: <strong className="font-mono">{navioNode.totalRecebido}</strong></span>
                    <span className="text-slate-300">|</span>
                    <span className="text-amber-600 font-semibold">Saldo: <strong className="font-mono">{navioNode.saldo}</strong></span>
                    <span className="text-slate-300">|</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      navioPercent === 100 
                        ? "bg-emerald-100 text-emerald-800" 
                        : "bg-blue-50 text-blue-700 border border-blue-100"
                    }`}>
                      {navioPercent}%
                    </span>
                  </div>
                </div>

                {/* LEVEL 2: VIAGEM CONTAINER */}
                {isNavioOpen && (
                  <div className="bg-white divide-y divide-slate-100">
                    {(Object.values(navioNode.viagens) as ViagemNode[]).map((viagemNode) => {
                      const viagemKey = `${navioNode.navioName}-${viagemNode.viagemName}`;
                      const isViagemOpen = !!openViagens[viagemKey];
                      const viagemPercent = viagemNode.totalPrevisto > 0
                        ? Math.round((viagemNode.totalRecebido / viagemNode.totalPrevisto) * 100)
                        : 0;

                      return (
                        <div key={viagemNode.viagemName} className="pl-4 border-l-2 border-slate-200">
                          
                          {/* Viagem Header */}
                          <div
                            onClick={() => toggleViagem(viagemKey)}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2 hover:bg-slate-50 cursor-pointer select-none transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">
                                {isViagemOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </span>
                              <div className="text-teal-600">
                                <Compass className="h-4 w-4" />
                              </div>
                              <div className="text-xs">
                                <span className="text-slate-400 font-bold uppercase mr-1">Viagem:</span>
                                <span className="font-bold text-slate-700 font-mono uppercase">{viagemNode.viagemName}</span>
                              </div>
                            </div>

                            {/* Viagem Stats */}
                            <div className="flex items-center gap-3 text-[10px] uppercase font-mono">
                              <span className="text-slate-400">Prev: <strong className="text-slate-600">{viagemNode.totalPrevisto}</strong></span>
                              <span className="text-slate-300">|</span>
                              <span className="text-emerald-600">Rec: <strong className="text-emerald-700">{viagemNode.totalRecebido}</strong></span>
                              <span className="text-slate-300">|</span>
                              <span className="text-amber-600">Saldo: <strong>{viagemNode.saldo}</strong></span>
                              <span className="text-slate-300">|</span>
                              <span className="bg-slate-100 text-slate-600 px-1 rounded font-bold">
                                {viagemPercent}%
                              </span>
                            </div>
                          </div>

                          {/* LEVEL 3: BILL OF LADING (BL) CONTAINER */}
                          {isViagemOpen && (
                            <div className="bg-slate-50/50 divide-y divide-slate-150 pl-4">
                              {(Object.values(viagemNode.bls) as BLNode[]).map((blNode) => {
                                const blKey = `${viagemKey}-${blNode.BLName}`;
                                const isBLOpen = !!openBLs[blKey];
                                const blPercent = blNode.totalPrevisto > 0
                                  ? Math.round((blNode.totalRecebido / blNode.totalPrevisto) * 100)
                                  : 0;

                                return (
                                  <div key={blNode.BLName} className="border-l border-slate-300">
                                    
                                    {/* BL Header */}
                                    <div
                                      onClick={() => toggleBL(blKey)}
                                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-1.5 hover:bg-slate-100/50 cursor-pointer select-none transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-slate-400">
                                          {isBLOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                        </span>
                                        <FileText className="h-3.5 w-3.5 text-slate-400" />
                                        <div className="text-xs">
                                          <span className="text-slate-400 font-bold uppercase mr-1">BL:</span>
                                          <span className="font-extrabold text-slate-700 font-mono">{blNode.BLName}</span>
                                        </div>
                                      </div>

                                      {/* BL Stats */}
                                      <div className="flex items-center gap-3 text-[10px] font-mono">
                                        <span className="text-slate-500">RECEBIDO: <strong>{blNode.totalRecebido}/{blNode.totalPrevisto}</strong></span>
                                        <span className="text-slate-300">|</span>
                                        <span className="text-amber-600">SALDO: <strong>{blNode.saldo}</strong></span>
                                        <span className="text-slate-300">|</span>
                                        <span className="font-bold">({blPercent}%)</span>
                                      </div>
                                    </div>

                                    {/* LEVEL 4: COIL ITEMS DETAILS LIST */}
                                    {isBLOpen && (
                                      <div className="px-4 py-1.5 bg-white border-t border-b border-slate-200">
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                              <tr className="border-b border-slate-200 text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                                                <th className="py-1 px-2">Coil Number</th>
                                                <th className="py-1 px-2">Status</th>
                                                <th className="py-1 px-2">Data / Hora Recebimento</th>
                                                <th className="py-1 px-2">Operador</th>
                                                <th className="py-1 px-2">Observações</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-mono text-slate-700 text-[11px]">
                                              {blNode.coils.map((coil) => (
                                                <tr key={coil.coilNumber} className="hover:bg-slate-50/40">
                                                  <td className="py-1 px-2 font-bold text-blue-600">
                                                    {coil.coilNumber}
                                                  </td>
                                                  <td className="py-1 px-2">
                                                    {coil.received ? (
                                                      <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1 py-0.2 text-[9px] font-bold text-emerald-700 border border-emerald-100">
                                                        RECEBIDO
                                                      </span>
                                                    ) : (
                                                      <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1 py-0.2 text-[9px] font-bold text-slate-400 border border-slate-200">
                                                        PENDENTE
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td className="py-1 px-2 text-slate-500 font-sans">
                                                    {coil.dataRecebimento 
                                                      ? new Date(coil.dataRecebimento).toLocaleString("pt-BR") 
                                                      : "-"
                                                    }
                                                  </td>
                                                  <td className="py-1 px-2 text-slate-600 font-sans font-medium">
                                                    {coil.usuarioRecebimento ? coil.usuarioRecebimento.split("@")[0] : "-"}
                                                  </td>
                                                  <td className="py-1 px-2 text-slate-500 font-sans italic max-w-xs truncate">
                                                    {coil.observacoes || "-"}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}

                                  </div>
                                );
                              })}
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

      {/* Modal de Relatório e Fechamento Operacional por Navio */}
      {selectedRelatorioNavio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            
            {/* Modal Header */}
            <div className={`px-6 py-4 flex items-center justify-between text-white ${
              selectedRelatorioNavio.status === "CONCLUIDO"
                ? "bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-900"
                : "bg-slate-900"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl text-white ${
                  selectedRelatorioNavio.status === "CONCLUIDO" ? "bg-emerald-600" : "bg-blue-600"
                }`}>
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold tracking-tight uppercase">
                      Relatório Logístico de Descarga: {selectedRelatorioNavio.navioName}
                    </h3>
                    {selectedRelatorioNavio.status === "CONCLUIDO" && (
                      <span className="bg-emerald-500 text-slate-950 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase">
                        Concluído
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 font-mono mt-0.5">
                    Terminal Portuário • Resumo Operacional e Balanço de Bobinas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRelatorioNavio(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-slate-800">
              
              {/* Banner de Estado */}
              <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                selectedRelatorioNavio.status === "CONCLUIDO"
                  ? "bg-emerald-50/80 border-emerald-300 text-emerald-900"
                  : "bg-blue-50/80 border-blue-200 text-blue-900"
              }`}>
                {selectedRelatorioNavio.status === "CONCLUIDO" ? (
                  <Award className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Clock className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold uppercase">
                    {selectedRelatorioNavio.status === "CONCLUIDO"
                      ? "Fechamento Operacional 100% Concluído"
                      : "Operação de Descarga em Andamento"}
                  </h4>
                  <p className="text-xs leading-relaxed opacity-90 font-medium">
                    {selectedRelatorioNavio.status === "CONCLUIDO"
                      ? `Todas as ${selectedRelatorioNavio.totalPrevisto} bobinas manifestadas para o navio ${selectedRelatorioNavio.navioName} foram conferidas e recepcionadas com sucesso no pátio do terminal.`
                      : `O navio ${selectedRelatorioNavio.navioName} está atualmente em processo de descarga. Até o momento, foram recepcionadas ${selectedRelatorioNavio.totalRecebido} de ${selectedRelatorioNavio.totalPrevisto} bobinas planejadas (${selectedRelatorioNavio.percent}%).`}
                  </p>
                </div>
              </div>

              {/* Grid de Resumo Matemático */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Manifestado</span>
                  <span className="text-2xl font-black font-mono text-slate-800 mt-1 block">{selectedRelatorioNavio.totalPrevisto}</span>
                  <span className="text-[10px] text-slate-500 block">Bobinas planejadas</span>
                </div>
                <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Recebido</span>
                  <span className="text-2xl font-black font-mono text-emerald-700 mt-1 block">{selectedRelatorioNavio.totalRecebido}</span>
                  <span className="text-[10px] text-emerald-600 block">Bobinas no pátio</span>
                </div>
                <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 text-center">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Pendente</span>
                  <span className="text-2xl font-black font-mono text-amber-700 mt-1 block">{selectedRelatorioNavio.saldo}</span>
                  <span className="text-[10px] text-amber-600 block">Bobinas a descarregar</span>
                </div>
                <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200 text-center">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Eficiência</span>
                  <span className="text-2xl font-black font-mono text-blue-700 mt-1 block">{selectedRelatorioNavio.percent}%</span>
                  <span className="text-[10px] text-blue-600 block">Taxa de conclusão</span>
                </div>
              </div>

              {/* Informações Complementares do Navio */}
              <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Viagens Manifestadas:</span>
                  <span className="font-bold text-white">{Array.from(selectedRelatorioNavio.viagens).join(", ") || "Nenhuma"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Bills of Lading (BLs):</span>
                  <span className="font-bold text-white">{Array.from(selectedRelatorioNavio.bls).join(", ") || "Nenhum"}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-400">Status no Sistema:</span>
                  <span className={`font-bold uppercase ${
                    selectedRelatorioNavio.status === "CONCLUIDO" ? "text-emerald-400" : "text-amber-400"
                  }`}>
                    {selectedRelatorioNavio.status === "CONCLUIDO" ? "OPERACAO FINALIZADA / AUDITADA" : "OPERACAO ATIVA"}
                  </span>
                </div>
              </div>

              {/* Instruções de Auditoria / Exportação */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5 font-sans">
                <h5 className="font-bold text-slate-800 uppercase text-[11px]">Auditoria Logística e Conformidade</h5>
                <p>
                  A emissão da planilha CSV inclui o detalhamento completo bobina a bobina (peso bruto, data e hora de conferência, usuário responsável e observações registradas no pátio). Utilize este arquivo para prestação de contas junto à agência marítima ou importadores.
                </p>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                onClick={() => setSelectedRelatorioNavio(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase cursor-pointer transition-colors"
              >
                Fechar Janela
              </button>
              <button
                onClick={() => exportarCSVNavio(selectedRelatorioNavio.navioName)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
              >
                <Download className="h-4 w-4" />
                <span>Exportar Planilha Completa (CSV)</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
