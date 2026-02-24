import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ExternalLink, ArrowLeft, BookOpen, Pencil } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import DeleteButton from "@/components/DeleteButton";
import CommentSection from "@/components/CommentSection";
import StarRating from "@/components/StarRating";
import ScrollToHash from "@/components/ScrollToHash";
import ShareButton from "@/components/ShareButton";

type Step = { id: string; order: number; title: string; content?: string; link?: string; media_url?: string };
type Resource = { id: string; label?: string; url?: string };

function normalizeUrl(url: string): string {
  if (!url) return url;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

// ─── Вспомогательные функции рендеринга медиа ───────────────────────────────

function getYouTubeId(url: string): string | null {
  const shortMatch = url.match(/youtu\.be\/([\w-]{11})/i);
  if (shortMatch) return shortMatch[1];
  const longMatch = url.match(/[?&]v=([\w-]{11})/i);
  if (longMatch) return longMatch[1];
  const embedMatch = url.match(/(?:embed|v)\/([\w-]{11})/i);
  if (embedMatch) return embedMatch[1];
  return null;
}

function isVideoFile(url: string): boolean {
  return /\.(mp4|webm)(?:\?|$)/i.test(url);
}

function renderMedia(url: string | undefined, title: string) {
  if (!url) return null;

  const ytId = getYouTubeId(url);
  if (ytId) {
    return (
      <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube.com/embed/${ytId}`}
          title={title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (isVideoFile(url)) {
    return <video controls src={url} className="mt-4 w-full rounded-xl" />;
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-4 block overflow-hidden rounded-xl">
      <img src={url} alt={title} className="w-full object-cover transition-transform duration-300 hover:scale-105" />
    </a>
  );
}

// Для серверного компонента используем базовый createClient напрямую,
// т.к. lib/supabase использует createBrowserClient (только для браузера)
const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DEFAULT_OG_IMAGE = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://roadmap-platform.vercel.app"}/og-default.svg`;

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;

  const { data } = await supabaseServer
    .from("cards")
    .select("title, description, image_url")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    return { title: "Roadmap | Дорожная карта не найдена" };
  }

  const title = data.title ?? "Без названия";
  const description = (data.description ?? "").slice(0, 160) || "Дорожная карта развития навыков";
  const image = data.image_url || DEFAULT_OG_IMAGE;

  return {
    title: `${title} | Roadmap Platform`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Получаем карточку и текущего пользователя параллельно
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const [{ data, error }, { data: { user: currentUser } }] = await Promise.all([
    supabaseServer
      .from("cards")
      .select("*, steps(*), resources(*), profiles:user_id(username, avatar)")
      .eq("id", id)
      .maybeSingle(),
    supabaseAuth.auth.getUser(),
  ]);

  if (error) {
    console.error("Full fetch error:", error);
    return (
      <div className="min-h-screen bg-zinc-950 py-12 px-6">
        <main className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-6 space-y-1">
            <p className="font-semibold text-red-400">Ошибка при загрузке карточки</p>
            <p className="text-sm text-red-300">{error.message}</p>
            {error.details && <p className="text-xs text-red-500">{error.details}</p>}
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-zinc-950 py-12 px-6">
        <main className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center text-slate-400">
            Карточка с таким ID не найдена.
          </div>
        </main>
      </div>
    );
  }

  // Если join по FK не вернул профиль — делаем отдельный запрос (фолбэк)
  let author = Array.isArray(data.profiles) ? (data.profiles[0] ?? null) : (data.profiles ?? null);
  if (!author && data.user_id) {
    const { data: profileFallback } = await supabaseServer
      .from("profiles")
      .select("*")
      .eq("id", data.user_id)
      .maybeSingle();
    author = profileFallback ?? null;
  }
  const authorName = author?.username ?? 'Автор неизвестен';
  const authorAvatar: string | null = author?.avatar ?? null;
  const steps: Step[] = (data.steps || []).slice().sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
  const resources: Resource[] = (data.resources || []).filter((r: Resource) => r.url);
  const isOwner = !!currentUser && currentUser.id === data.user_id;

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-100">

      {/* Hero-секция */}
      <div className="relative overflow-hidden border-b border-white/10 bg-linear-to-br from-zinc-900 via-zinc-950 to-blue-950/30">
        {/* Декоративное свечение */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-0 h-64 w-64 rounded-full bg-indigo-600/10 blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-6 py-14">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Link>

          <div className="flex flex-col gap-4">
            {data.category && (
              <span className="w-fit rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-400">
                {data.category}
              </span>
            )}

            <div className="flex items-start justify-between gap-4">
              <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl">
                {data.title}
              </h1>

              {isOwner && (
                <div className="mt-1 flex shrink-0 items-center gap-2">
                  <Link
                    href={`/card/${id}/edit`}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-300 transition-all hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-300"
                  >
                    <Pencil className="h-4 w-4" />
                    Редактировать
                  </Link>
                  <DeleteButton cardId={id} />
                </div>
              )}
            </div>

            {/* Кнопка «Поделиться» — всегда видна */}
            <div className="flex items-center gap-2">
              <ShareButton
                cardId={id}
                title={data.title}
                description={data.description ?? undefined}
                label="Поделиться"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400 hover:border-white/20 hover:text-blue-400"
              />
            </div>

            {/* Бейдж автора */}
            <div className="flex items-center gap-2.5">
              {authorAvatar ? (
                <img
                  src={authorAvatar}
                  alt={authorName}
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                />
              ) : (
                <UserAvatar username={authorName} size={36} />
              )}
              <div>
                <p className="text-sm font-medium text-slate-200">{authorName}</p>
                <p className="text-xs text-slate-500">Автор</p>
              </div>
            </div>

            {data.description && (
              <p className="mt-2 max-w-2xl text-base text-slate-400 leading-relaxed">
                {data.description}
              </p>
            )}

            {/* Рейтинг */}
            <div className="mt-1">
              <StarRating roadmapId={id} />
            </div>
          </div>
        </div>
      </div>

      {/* Основной контент */}
      <div className="mx-auto max-w-5xl gap-8 px-6 py-12 lg:grid lg:grid-cols-[1fr_280px]">

        {/* Timeline шагов */}
        <section>
          <h2 className="mb-8 flex items-center gap-2 text-lg font-semibold text-slate-200">
            <BookOpen className="h-5 w-5 text-blue-400" />
            Дорожная карта
            <span className="ml-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-400">
              {steps.length}
            </span>
          </h2>

          <ol className="relative space-y-6 pl-8">
            {/* Вертикальная линия */}
            <div className="absolute left-3.5 top-3 bottom-3 w-px bg-linear-to-b from-blue-500/60 via-slate-700 to-slate-800" />

            {steps.map((s, idx) => (
              <li key={s.id} className="relative">
                {/* Кружок на линии */}
                <div className="absolute -left-8 flex h-7 w-7 items-center justify-center rounded-full border-2 border-blue-500 bg-zinc-950 text-xs font-bold text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.4)]">
                  {s.order ?? idx + 1}
                </div>

                {/* Карточка шага */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-6 transition-all duration-200 hover:border-blue-500/50 hover:bg-white/[0.07] hover:shadow-[0_0_20px_rgba(59,130,246,0.08)]">
                  <h3 className="text-base font-semibold text-slate-100">{s.title}</h3>
                  {s.content && (
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.content}</p>
                  )}

                  {s.link && (
                    <a
                      href={normalizeUrl(s.link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:border-blue-400/60 hover:bg-blue-500/20 hover:text-blue-300"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {s.link}
                    </a>
                  )}

                  {renderMedia(s.media_url, s.title)}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Sidebar: ресурсы */}
        {resources.length > 0 && (
          <aside className="mt-12 lg:mt-0">
            <div className="sticky top-20 rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-400">
                <ExternalLink className="h-4 w-4" />
                Материалы
              </h2>
              <ul className="space-y-2">
                {resources.map((r) => (
                  <li key={r.id}>
                    <a
                      href={normalizeUrl(r.url!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/0 px-3 py-2.5 text-sm text-slate-300 transition-all hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-300"
                    >
                      <span className="truncate">{r.label || r.url}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>

      {/* Разделитель + Комментарии */}
      <ScrollToHash />
      <div id="comments" className="mx-auto max-w-5xl px-6 pb-16">
        <div className="border-t border-slate-700/60 pt-10">
          <CommentSection roadmapId={id} />
        </div>
      </div>
    </div>
  );
}
