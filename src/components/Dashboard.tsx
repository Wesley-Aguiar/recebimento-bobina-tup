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
  Users
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

  // Overall Global KPI Metrics
  const globalKPIs = useMemo(() => {
    const totalPrevisto = estoquePrevisto.length;
    const totalRecebido = estoqueRecebido.length;
    const saldo = totalPrevisto - totalRecebido;
    const percent = totalPrevisto > 0 ? Math.round((totalRecebido / totalPrevisto) * 100) : 0;

    return { totalPrevisto, totalRecebido, saldo, percent };
  }, [estoquePrevisto, estoqueRecebido]);

  return (
    <div className="space-y-4">
      
      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Metric 1 */}
        <div className="rounded border border-slate-200 bg-white p-3.5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estoque Previsto (Total)</span>
            <div className="text-xl font-bold text-slate-800 font-mono leading-none">{globalKPIs.totalPrevisto}</div>
            <p className="text-[10px] text-slate-400">Bobinas planejadas</p>
          </div>
          <div className="rounded bg-blue-50 p-2 text-blue-600">
            <Ship className="h-5 w-5" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded border border-slate-200 bg-white p-3.5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estoque Recebido</span>
            <div className="text-xl font-bold text-emerald-600 font-mono leading-none">{globalKPIs.totalRecebido}</div>
            <p className="text-[10px] text-emerald-600 font-medium">Lançamentos efetuados</p>
          </div>
          <div className="rounded bg-emerald-50 p-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded border border-slate-200 bg-white p-3.5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo Pendente</span>
            <div className="text-xl font-bold text-amber-600 font-mono leading-none">{globalKPIs.saldo}</div>
            <p className="text-[10px] text-amber-600 font-medium">Restante a descarregar</p>
          </div>
          <div className="rounded bg-amber-50 p-2 text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded border border-slate-200 bg-white p-3.5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Progresso Geral</span>
            <span className="text-xs font-bold text-blue-600 font-mono">{globalKPIs.percent}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-1.5">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${globalKPIs.percent}%` }}
            />
          </div>
          <p className="text-[9px] text-slate-400 font-sans mt-1">Eficiência Operacional do Terminal</p>
        </div>

      </div>

      {/* Control Filter Bar */}
      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
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

        {/* Filter by Ship */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-slate-500 font-medium">Navio:</span>
          <select
            value={navioFilter}
            onChange={(e) => setNavioFilter(e.target.value)}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 font-semibold focus:outline-none"
          >
            <option value="TODOS">Todos os Navios</option>
            {listUniqueNavios.map(ship => (
              <option key={ship} value={ship}>{ship}</option>
            ))}
          </select>
        </div>

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

    </div>
  );
}
