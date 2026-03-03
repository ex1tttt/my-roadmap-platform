"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { UserPlus, X, Mail, Eye, Pencil } from "lucide-react";

interface CollaboratorManagerProps {
  cardId: string;
}

interface Collaborator {
  id: string;
  user_email: string;
  role: "viewer" | "editor";
}

export default function CollaboratorManager({ cardId }: CollaboratorManagerProps) {
  const { t } = useTranslation();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchCollaborators() {
    const { data, error } = await supabase
      .from("card_collaborators")
      .select("id, user_email, role")
      .eq("card_id", cardId);
    if (error) setError(error.message);
    else setCollaborators((data || []) as Collaborator[]);
  }

  useEffect(() => {
    fetchCollaborators();
  // eslint-disable-next-line
  }, [cardId]);

  async function handleAdd(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError(t("collaborator.invalidEmail"));
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("card_collaborators")
      .insert([{ card_id: cardId, user_email: email, role }]);
    if (error) {
      if (error.message?.includes('duplicate key') || error.code === '23505') {
        setError(t('collaborator.alreadyHasAccess'));
      } else {
        setError(error.message);
      }
    } else {
      setEmail("");
      setRole("viewer");
      await fetchCollaborators();
    }
    setLoading(false);
  }

  async function handleRoleChange(id: string, newRole: "viewer" | "editor") {
    setLoading(true);
    const { error } = await supabase
      .from("card_collaborators")
      .update({ role: newRole })
      .eq("id", id);
    if (error) setError(error.message);
    else setCollaborators(prev => prev.map(c => c.id === id ? { ...c, role: newRole } : c));
    setLoading(false);
  }

  async function handleDelete(id: string) {
    setLoading(true);
    const { error } = await supabase
      .from("card_collaborators")
      .delete()
      .eq("id", id);
    if (error) setError(error.message);
    else setCollaborators(prev => prev.filter(c => c.id !== id));
    setLoading(false);
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 mt-8">
      <h3 className="text-xs font-semibold text-white mb-4 flex items-center gap-2 opacity-50">
        <UserPlus className="h-5 w-5 text-blue-400" /> {t("collaborator.manage")}
      </h3>
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="relative flex-1 min-w-50">
          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            placeholder={t("collaborator.emailPlaceholder")}
            className="w-full pl-10 pr-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white focus:outline-none focus:border-blue-400 text-sm"
            disabled={loading}
          />
        </div>
        {/* Выбор роли */}
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          <button
            type="button"
            onClick={() => setRole("viewer")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm transition ${
              role === "viewer" ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <Eye className="h-3.5 w-3.5" /> {t("collaborator.viewerRole")}
          </button>
          <button
            type="button"
            onClick={() => setRole("editor")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-l border-white/10 transition ${
              role === "editor" ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <Pencil className="h-3.5 w-3.5" /> {t("collaborator.editorRole")}
          </button>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className={`px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold transition ${loading ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-700"}`}
          disabled={loading}
        >
          {loading ? "..." : t("collaborator.add")}
        </button>
      </div>
      {error && <div className="text-red-400 mb-4 text-sm">{error}</div>}
      {collaborators.length === 0 && (
        <p className="text-xs text-slate-500">{t("collaborator.noUsers")}</p>
      )}
      <ul className="flex flex-col gap-2">
        {collaborators.map(c => (
          <li key={c.id} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2 gap-3">
            <span className="text-white text-sm truncate flex-1">{c.user_email}</span>
            <div className="flex rounded-md overflow-hidden border border-white/10 shrink-0">
              <button
                onClick={() => handleRoleChange(c.id, "viewer")}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs transition ${
                  c.role === "viewer" ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
                }`}
                disabled={loading}
                title={t("collaborator.viewerOnly")}
              >
                <Eye className="h-3 w-3" /> {t("collaborator.viewerRole")}
              </button>
              <button
                onClick={() => handleRoleChange(c.id, "editor")}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs border-l border-white/10 transition ${
                  c.role === "editor" ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
                }`}
                disabled={loading}
                title={t("collaborator.canEdit")}
              >
                <Pencil className="h-3 w-3" /> {t("collaborator.editorRole")}
              </button>
            </div>
            <button
              onClick={() => handleDelete(c.id)}
              className="p-1.5 rounded-lg hover:bg-red-500/20 transition shrink-0"
              disabled={loading}
              title={t("collaborator.revokeAccess")}
            >
              <X className="h-4 w-4 text-red-400" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
