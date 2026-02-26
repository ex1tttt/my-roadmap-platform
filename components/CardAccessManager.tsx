import React, { useState, useEffect } from "react";
import { UserPlus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AccessUser {
  id: number;
  user_email: string;
}

interface CardAccessManagerProps {
  cardId: number | string;
}

export default function CardAccessManager({ cardId }: CardAccessManagerProps) {
  const [email, setEmail] = useState("");
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchUsers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("card_shared_access")
      .select("id, user_email")
      .eq("card_id", cardId);
    if (error) setError(error.message);
    else setUsers(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line
  }, [cardId]);

  function validateEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function inviteUser(email: string, cardId: number | string, fetchAccessList: () => Promise<void>, setError: (msg: string|null) => void) {
    if (!validateEmail(email)) {
      setError('Некорректный email');
      return;
    }
    setError(null);
    const { error } = await supabase
      .from('card_shared_access')
      .insert({ card_id: cardId, user_email: email });
    if (error) {
      setError(error.message);
      return;
    }
    await fetchAccessList();
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email) return;
    setLoading(true);
    await inviteUser(email, cardId, fetchUsers, setError);
    setEmail("");
    setLoading(false);
  }

  async function handleRemove(id: number) {
    setLoading(true);
    const { error } = await supabase
      .from("card_shared_access")
      .delete()
      .eq("id", id);
    if (error) setError(error.message);
    await fetchUsers();
    setLoading(false);
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 mt-6">
      <form onSubmit={handleInvite} className="flex gap-2 mb-4">
        <input
          type="email"
          className="flex-1 rounded border border-slate-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Email пользователя"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading || !email}
          className="flex items-center gap-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <UserPlus className="h-4 w-4" />
          Пригласить
        </button>
      </form>
      {error && <div className="mb-2 text-sm text-red-500">{error}</div>}
      <ul className="space-y-2">
        {users.map(u => (
          <li key={u.id} className="flex items-center justify-between rounded border border-slate-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 px-3 py-2">
            <span className="text-sm text-gray-800 dark:text-gray-100">{u.user_email}</span>
            <button
              onClick={() => handleRemove(u.id)}
              className="ml-2 rounded p-1 text-red-500 hover:bg-red-500/10"
              title="Отозвать доступ"
              disabled={loading}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {users.length === 0 && !loading && (
          <li className="text-sm text-slate-400">Нет приглашённых пользователей</li>
        )}
      </ul>
    </div>
  );
}
