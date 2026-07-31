import React, { useState, useEffect } from "react";
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc 
} from "firebase/firestore";
import { db } from "../firebase";
import { UsuarioPerfil, UserRole } from "../types";
import { 
  Users, 
  Shield, 
  User, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Lock,
  AlertTriangle,
  X
} from "lucide-react";

interface GerenciadorUsuariosProps {
  currentEmail: string;
}

export default function GerenciadorUsuarios({ currentEmail }: GerenciadorUsuariosProps) {
  const [usuarios, setUsuarios] = useState<UsuarioPerfil[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // New user form
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("comum");
  const [newNome, setNewNome] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Custom modals for safety against accidental clicks (works reliably in iframe)
  const [confirmModal, setConfirmModal] = useState<{
    type: "toggle" | "delete";
    user: UsuarioPerfil;
  } | null>(null);
  const [alertModal, setAlertModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const fetchUsuarios = async () => {
    setLoading(true);
    setFormError(null);
    try {
      const snap = await getDocs(collection(db, "usuarios"));
      const list: UsuarioPerfil[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data() as UsuarioPerfil);
      });
      
      // Ensure the current user is in the list if not already
      if (!list.some(u => u.email.toLowerCase() === currentEmail.toLowerCase())) {
        list.push({
          email: currentEmail,
          role: "admin",
          dataCadastro: new Date().toISOString(),
          ultimoAcesso: new Date().toISOString()
        });
      }

      // Sort: admins first, then alphabetical by email
      list.sort((a, b) => {
        if (a.role === "admin" && b.role !== "admin") return -1;
        if (a.role !== "admin" && b.role === "admin") return 1;
        return a.email.localeCompare(b.email);
      });

      setUsuarios(list);
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
      setFormError("Não foi possível carregar a lista de usuários no Firebase.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setFormError("Informe um e-mail válido para o cadastro.");
      return;
    }

    try {
      const newPerfil: UsuarioPerfil = {
        email: cleanEmail,
        role: newRole,
        nome: newNome.trim() || cleanEmail.split("@")[0],
        dataCadastro: new Date().toISOString()
      };

      await setDoc(doc(db, "usuarios", cleanEmail), newPerfil);
      
      setFormSuccess(`Permissão para ${cleanEmail} (${newRole.toUpperCase()}) salva com sucesso!`);
      setNewEmail("");
      setNewNome("");
      setNewRole("comum");
      fetchUsuarios();
    } catch (err) {
      console.error("Erro ao salvar permissão:", err);
      setFormError("Erro ao salvar permissão no banco de dados.");
    }
  };

  const handleToggleRole = (user: UsuarioPerfil) => {
    setFormError(null);
    setFormSuccess(null);
    if (user.email.toLowerCase() === currentEmail.toLowerCase()) {
      setAlertModal({
        title: "Ação Não Permitida",
        message: "Você não pode alterar seu próprio nível de acesso enquanto logado no sistema."
      });
      return;
    }
    setConfirmModal({ type: "toggle", user });
  };

  const handleDeleteUser = (user: UsuarioPerfil) => {
    setFormError(null);
    setFormSuccess(null);
    if (user.email.toLowerCase() === currentEmail.toLowerCase()) {
      setAlertModal({
        title: "Ação Não Permitida",
        message: "Você não pode remover sua própria conta de administrador do sistema."
      });
      return;
    }
    setConfirmModal({ type: "delete", user });
  };

  const executeConfirmAction = async () => {
    if (!confirmModal) return;
    const { type, user } = confirmModal;
    setConfirmModal(null);
    setFormError(null);
    setFormSuccess(null);

    if (type === "toggle") {
      const nextRole: UserRole = user.role === "admin" ? "comum" : "admin";
      const actionName = nextRole === "admin" ? "Administrador (Total)" : "Comum (Apenas Lançamento)";
      try {
        const updated: UsuarioPerfil = {
          ...user,
          role: nextRole
        };
        await setDoc(doc(db, "usuarios", user.email), updated, { merge: true });
        setFormSuccess(`Acesso de ${user.email} alterado para ${actionName} com sucesso!`);
        fetchUsuarios();
      } catch (err) {
        console.error("Erro ao alterar nível de acesso:", err);
        setFormError("Erro ao alterar nível de acesso no banco de dados.");
      }
    } else if (type === "delete") {
      try {
        await deleteDoc(doc(db, "usuarios", user.email));
        setFormSuccess(`Permissão do usuário ${user.email} removida com sucesso.`);
        fetchUsuarios();
      } catch (err) {
        console.error("Erro ao remover usuário:", err);
        setFormError("Erro ao remover usuário do banco.");
      }
    }
  };

  const filteredUsuarios = usuarios.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.nome && u.nome.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Controle de Acesso & Níveis de Usuário</h2>
              <p className="text-xs text-slate-500">
                Gerencie quem pode acessar apenas o módulo de Lançamento (Comum) ou o sistema completo (Admin).
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={fetchUsuarios}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar Lista
          </button>
        </div>
      </div>

      {/* Two columns: Form to Add & User List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form to pre-configure user */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4 h-fit">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Plus className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Autorizar Novo Usuário</h3>
          </div>

          {formError && (
            <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleAddUser} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-mail de Login *
              </label>
              <input
                type="email"
                required
                placeholder="ex: operador@porto.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded border border-slate-300 py-2 px-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome do Operador (Opcional)
              </label>
              <input
                type="text"
                placeholder="ex: Carlos Silva"
                value={newNome}
                onChange={(e) => setNewNome(e.target.value)}
                className="w-full rounded border border-slate-300 py-2 px-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nível de Permissão *
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setNewRole("comum")}
                  className={`p-2.5 rounded border text-left flex flex-col gap-1 cursor-pointer transition-all ${
                    newRole === "comum"
                      ? "border-blue-500 bg-blue-50/60 text-blue-900 ring-1 ring-blue-500"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <User className="h-3.5 w-3.5 text-slate-500" />
                    <span>Comum</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Apenas Lançamento de estoque</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewRole("admin")}
                  className={`p-2.5 rounded border text-left flex flex-col gap-1 cursor-pointer transition-all ${
                    newRole === "admin"
                      ? "border-blue-500 bg-blue-50/60 text-blue-900 ring-1 ring-blue-500"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-blue-600">
                    <Shield className="h-3.5 w-3.5 text-blue-500" />
                    <span>Admin</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Acesso Total ao sistema</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase rounded transition-colors shadow-sm cursor-pointer mt-2"
            >
              Conceder Acesso
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <strong>Observação:</strong> O nível <em>Comum</em> esconde o Dashboard e a Gerência de Tabelas. O usuário verá apenas a tela de registro de cargas.
            </p>
          </div>
        </div>

        {/* User list table */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span>Usuários com Acesso Configurado</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-mono">
                {usuarios.length}
              </span>
            </h3>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por e-mail ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-blue-500 bg-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Operador / E-mail</th>
                  <th className="py-3 px-4">Nível de Acesso</th>
                  <th className="py-3 px-4">Último Acesso</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 font-mono">
                      Carregando lista do Firebase...
                    </td>
                  </tr>
                ) : filteredUsuarios.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      Nenhum usuário encontrado para "{searchTerm}".
                    </td>
                  </tr>
                ) : (
                  filteredUsuarios.map((u) => {
                    const isSelf = u.email.toLowerCase() === currentEmail.toLowerCase();
                    return (
                      <tr key={u.email} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span>{u.nome || u.email.split("@")[0]}</span>
                            {isSelf && (
                              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase rounded">
                                Você
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                        </td>

                        <td className="py-3 px-4">
                          {u.role === "admin" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <Shield className="h-3 w-3 text-blue-600" />
                              Admin (Total)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                              <User className="h-3 w-3 text-slate-500" />
                              Comum (Lançamento)
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-[11px] text-slate-500 font-mono">
                          {u.ultimoAcesso 
                            ? new Date(u.ultimoAcesso).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit"
                              })
                            : "Nunca acessou"}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggleRole(u)}
                              disabled={isSelf}
                              title={
                                isSelf
                                  ? "Não é possível alterar seu próprio nível"
                                  : `Alterar para ${u.role === "admin" ? "Comum" : "Admin"}`
                              }
                              className={`p-1.5 rounded border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                isSelf
                                  ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                                  : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-xs"
                              }`}
                            >
                              <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
                              <span className="hidden sm:inline">
                                {u.role === "admin" ? "Tornar Comum" : "Tornar Admin"}
                              </span>
                            </button>

                            <button
                              onClick={() => handleDeleteUser(u)}
                              disabled={isSelf}
                              title={isSelf ? "Não é possível excluir seu próprio acesso" : "Excluir permissão"}
                              className={`p-1.5 rounded border transition-colors cursor-pointer ${
                                isSelf
                                  ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                                  : "bg-white hover:bg-red-50 text-red-600 border-slate-300 hover:border-red-300 shadow-xs"
                              }`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirmation Modal (Anti-Acidental Click) */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5 font-bold text-sm">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <span>Confirmar Ação no Sistema</span>
              </div>
              <button
                onClick={() => setConfirmModal(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-700 font-medium leading-relaxed">
                {confirmModal.type === "toggle" ? (
                  <>
                    Deseja realmente alterar o nível de acesso de <strong className="text-slate-900">{confirmModal.user.email}</strong> para{" "}
                    <strong className="text-blue-600 uppercase">
                      {confirmModal.user.role === "admin" ? "Comum (Apenas Lançamento)" : "Administrador (Total)"}
                    </strong>?
                  </>
                ) : (
                  <>
                    Deseja realmente remover as permissões de acesso e excluir o usuário <strong className="text-red-600">{confirmModal.user.email}</strong> do sistema?
                  </>
                )}
              </p>
              <p className="text-xs text-slate-500 bg-amber-50 p-2.5 rounded border border-amber-200/80">
                <strong>Atenção:</strong> Esta medida de segurança protege contra cliques acidentais e altera imediatamente as permissões no Firestore.
              </p>
            </div>
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded text-xs font-bold text-slate-600 hover:bg-slate-200/80 transition-colors cursor-pointer uppercase"
              >
                Cancelar
              </button>
              <button
                onClick={executeConfirmAction}
                className={`px-4 py-2 rounded text-xs font-bold text-white transition-colors cursor-pointer uppercase shadow-xs ${
                  confirmModal.type === "delete"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {confirmModal.type === "toggle" ? "Sim, Alterar Acesso" : "Sim, Excluir Usuário"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden">
            <div className="bg-amber-500 text-white p-4 flex items-center gap-2.5 font-bold text-sm">
              <AlertCircle className="h-5 w-5" />
              <span>Aviso de Segurança</span>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-700">{alertModal.message}</p>
            </div>
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setAlertModal(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded uppercase cursor-pointer transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
