import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

// Для серверного компонента используем базовый createClient напрямую,
// т.к. lib/supabase использует createBrowserClient (только для браузера)
const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Step = { id: string; order: number; title: string; content?: string; media_url?: string };
type Resource = { id: string; label?: string; url?: string };

function getYouTubeId(url?: string) {
  if (!url) return null;
  // youtu.be/<id>
  const shortMatch = url.match(/youtu\.be\/([\w-]{11})/i);
  if (shortMatch) return shortMatch[1];
  // youtube.com/watch?v=<id>
  const longMatch = url.match(/[?&]v=([\w-]{11})/i);
  if (longMatch) return longMatch[1];
  // embed or /v/ urls
  const embedMatch = url.match(/(?:embed|v)\/([\w-]{11})/i);
  if (embedMatch) return embedMatch[1];
  return null;
}

function isImageUrl(url?: string) {
  if (!url) return false;
  return /\.(jpe?g|png|gif|webp|svg)(?:\?|$)/i.test(url);
}

function isVideoFile(url?: string) {
  if (!url) return false;
  return /\.(mp4|webm)(?:\?|$)/i.test(url);
}

export default async function Page({ params }: { params: { id: string } }) {
  const { id } = params;

  console.log('ID from URL:', id);

  const { data, error } = await supabaseServer
    .from("cards")
    .select("*, steps(*), resources(*), profiles!cards_user_id_fkey(*)")
    .eq("id", id)
    .maybeSingle();

  console.log('Fetched data:', data);

  if (error) {
    console.error('Full fetch error:', error);
    return (
      <div className="min-h-screen bg-zinc-50 py-12 px-6 dark:bg-black">
        <main className="mx-auto max-w-4xl">
          <div className="rounded-lg bg-red-50 p-6 text-red-700 space-y-1">
            <p className="font-semibold">Ошибка при загрузке карточки</p>
            <p className="text-sm">{error.message}</p>
            {error.details && <p className="text-xs text-red-500">{error.details}</p>}
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-zinc-50 py-12 px-6 dark:bg-black">
        <main className="mx-auto max-w-4xl">
          <div className="rounded-lg bg-white p-8 text-center shadow-sm">Карточка с таким ID не найдена.</div>
        </main>
      </div>
    );
  }

  // profiles может быть массивом или объектом в зависимости от join
  const author = Array.isArray(data.profiles) ? (data.profiles[0] ?? null) : (data.profiles ?? null);
  const authorName = author?.username ?? 'Автор неизвестен';
  const steps: Step[] = (data.steps || []).slice().sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
  const resources: Resource[] = data.resources || [];

  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-6 dark:bg-black">
      <main className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-1 text-sm shadow hover:bg-gray-50 dark:bg-gray-900">
              ← Назад
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{data.title}</h1>
              <div className="mt-2 flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                {data.category && <span className="rounded-md border border-transparent bg-linear-to-r from-blue-500 to-cyan-400 px-2 py-1 text-white">{data.category}</span>}
                <span>by {authorName}</span>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
          <h2 className="mb-2 text-lg font-medium text-gray-800 dark:text-gray-100">Описание</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300">{data.description}</p>
        </section>

        <section className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-medium text-gray-800 dark:text-gray-100">Шаги</h2>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
            <ol className="space-y-8 pl-10">
              {steps.map((s, idx) => (
                <li key={s.id} className="relative flex gap-4">
                  <div className="absolute left-0 top-0 -ml-6 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white">{s.order ?? idx + 1}</div>
                  <div className="flex-1">
                    <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">{s.title}</h3>
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{s.content}</p>
                    {s.media_url && (
                      <div className="mt-3">
                        {(() => {
                          const ytId = getYouTubeId(s.media_url);
                          if (ytId) {
                            return (
                              <div className="aspect-video w-full overflow-hidden rounded-md">
                                <iframe
                                  className="h-full w-full"
                                  src={`https://www.youtube.com/embed/${ytId}`}
                                  title={s.title}
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            );
                          }

                          if (isVideoFile(s.media_url)) {
                            return (
                              <video controls src={s.media_url} className="max-h-64 w-full rounded-md object-cover" />
                            );
                          }

                          if (isImageUrl(s.media_url)) {
                            return (
                              <a href={s.media_url} target="_blank" rel="noopener noreferrer">
                                <img src={s.media_url} alt={s.title} className="max-h-64 w-full rounded-md object-cover hover:scale-105 transition-transform" />
                              </a>
                            );
                          }

                          // Fallback: render as image but wrapped link
                          return (
                            <a href={s.media_url} target="_blank" rel="noopener noreferrer">
                              <img src={s.media_url} alt={s.title} className="max-h-64 w-full rounded-md object-cover hover:scale-105 transition-transform" />
                            </a>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
          <h2 className="mb-3 text-lg font-medium text-gray-800 dark:text-gray-100">Полезные ссылки</h2>
          <div className="flex flex-wrap gap-3">
            {resources.length === 0 && <span className="text-sm text-gray-600 dark:text-gray-400">Нет ресурсов</span>}
            {resources.map((r) => (
              <a
                key={r.id}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border-2 border-transparent bg-linear-to-r from-indigo-500 to-pink-500 px-4 py-2 text-sm text-white shadow hover:opacity-95 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]"
              >
                <span>{r.label || r.url}</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H21m0 0v7.5M21 6l-9 9" />
                </svg>
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
