"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { UserPlus, X, Mail } from "lucide-react";

interface CollaboratorManagerProps {
  cardId: string;
}

interface Collaborator {
  id: string;
  user_email: string;
}

export default function CollaboratorManager({ cardId }: CollaboratorManagerProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCollaborators() {
      setLoading(true);
      const { data, error } = await supabase
        .from("card_collaborators")
        .select("id, user_email")
        .eq("card_id", cardId);
      if (error) setError(error.message);
      else setCollaborators(data || []);
      setLoading(false);
    }
    fetchCollaborators();
  }, [cardId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Введите корректный email");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("card_collaborators")
      .insert([{ card_id: cardId, user_email: email }]);
    if (error) setError(error.message);
    else {
      setEmail("");
      const { data } = await supabase
        .from("card_collaborators")
        .select("id, user_email")
        .eq("card_id", cardId);
      setCollaborators(data || []);
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    setLoading(true);
    const { error } = await supabase
      .from("card_collaborators")
      .delete()
      .eq("id", id);
    if (error) setError(error.message);
    else {
      setCollaborators(collaborators.filter(c => c.id !== id));
    }
    setLoading(false);
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 mt-8">
      <h3 className="text-[10px] font-semibold text-white mb-4 flex items-center gap-2 opacity-50">
        <UserPlus className="h-5 w-5 text-blue-400" /> Управление доступом
      </h3>
      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email пользователя"
            className="w-full pl-10 pr-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white focus:outline-none focus:border-blue-400"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          className={`px-4 py-2 rounded-lg bg-slate-800 text-white font-semibold transition ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700'}`}
          disabled={loading}
        >
          {loading ? 'Добавление...' : 'Добавить'}
        </button>
      </form>
      {error && <div className="text-red-400 mb-4 text-sm">{error}</div>}
      <ul className="flex flex-wrap gap-2">
        {collaborators.map(c => (
          <li key={c.id} className="flex items-center bg-white/10 rounded-lg px-4 py-2">
            <span className="text-white text-sm">{c.user_email}</span>
            <button
              onClick={() => handleDelete(c.id)}
              className="ml-2 p-2 rounded-lg hover:bg-red-500/20 transition"
              disabled={loading}
              title="Удалить пользователя"
            >
              <X className="h-4 w-4 text-red-400" />
            </button>
          </li>
        ))}
      </ul>
      {loading && <div className="mt-4 text-blue-400">Загрузка...</div>}
    </div>
  );
}
