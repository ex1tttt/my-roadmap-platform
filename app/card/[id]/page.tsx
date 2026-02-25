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
import StepsProgress from "@/components/StepsProgress";
import ClientOnly from "@/components/ClientOnly";
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
      .select("*, steps(*), resources(*), profiles:user_id(*)")
      .eq("id", id)
      .maybeSingle(),
    supabaseAuth.auth.getUser(),
  ]);

  if (error) {
    console.error("Full fetch error:", error);
    return (
      <div className="min-h-screen bg-white dark:bg-[#020617] py-12 px-6">
        <main className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-950/40 p-6 space-y-1">
            <p className="font-semibold text-red-600 dark:text-red-400">Ошибка при загрузке карточки</p>
            <p className="text-sm text-red-300">{error.message}</p>
            {error.details && <p className="text-xs text-red-500">{error.details}</p>}
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#020617] py-12 px-6">
        <main className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-10 text-center text-slate-500 dark:text-slate-400">
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
  // Загружаем прогресс текущего пользователя (пустой Set если не залогинен)
  const stepIds = steps.map((s) => s.id)
  let initialDoneArr: string[] = []
  if (currentUser && stepIds.length > 0) {
    const { data: progressRows } = await supabaseServer
      .from('user_progress')
      .select('step_id')
      .eq('user_id', currentUser.id)
      .eq('card_id', id)
      .in('step_id', stepIds)
    initialDoneArr = (progressRows ?? []).map((r: any) => r.step_id as string)
  }
  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] text-slate-900 dark:text-slate-100">

      {/* ── Компактная шапка ── */}
      <div className="border-b border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/60 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-6 py-4">

          {/* Верхняя строка: назад + кнопки */}
          <div className="mb-3 flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/5 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Назад
            </Link>

            <div className="flex items-center gap-2">
              <ClientOnly fallback={<div className="h-7 w-24" />}>
                <ShareButton
                  cardId={id}
                  title={data.title}
                  description={data.description ?? undefined}
                  label="Поделиться"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/5 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 transition-colors hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200"
                />
              </ClientOnly>
              {isOwner && (
                <>
                  <Link
                    href={`/card/${id}/edit`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/5 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 transition-colors hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-500 dark:hover:text-blue-400"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Редактировать
                  </Link>
                  <DeleteButton cardId={id} />
                </>
              )}
            </div>
          </div>

          {/* Заголовок + авто-строка */}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {data.category && (
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-widest text-blue-500 dark:text-blue-400">
                {data.category}
              </span>
            )}
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {data.title}
            </h1>
          </div>

          {/* Автор + рейтинг в одну строку */}
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <Link
              href={`/profile/${data.user_id}`}
              className="group flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 transition-colors hover:text-blue-500 dark:hover:text-blue-400"
            >
              {authorAvatar ? (
                <img
                  src={authorAvatar}
                  alt={authorName}
                  className="h-5 w-5 shrink-0 rounded-full object-cover"
                />
              ) : (
                <UserAvatar username={authorName} size={20} />
              )}
              <span className="font-medium">{authorName}</span>
            </Link>

            <div className="flex items-center">
              <ClientOnly fallback={<div className="h-5 w-20" />}>
                <StarRating roadmapId={id} compact />
              </ClientOnly>
            </div>
          </div>

          {/* Описание — text-sm, максимум 2 строки */}
          {data.description && (
            <p className="mt-2 line-clamp-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
              {data.description}
            </p>
          )}
        </div>
      </div>

      {/* Основной контент */}
      <div className="mx-auto max-w-5xl gap-8 px-6 py-12 lg:grid lg:grid-cols-[1fr_280px]">

        {/* Timeline шагов */}
        <section>
          <h2 className="mb-8 flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200">
            <BookOpen className="h-5 w-5 text-blue-400" />
            Дорожная карта
            <span className="ml-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-400">
              {steps.length}
            </span>
          </h2>

          <ClientOnly>
            <StepsProgress
              cardId={id}
              userId={currentUser?.id ?? null}
              steps={steps}
              initialDone={initialDoneArr}
            />
          </ClientOnly>
        </section>

        {/* Sidebar: рейтинг + ресурсы */}
        <aside className="mt-12 lg:mt-0">
          <div className="sticky top-20 space-y-4">

            {/* Блок интерактивного рейтинга */}
            <div className="relative z-10 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Оценить
              </h2>
              <ClientOnly fallback={<div className="h-16" />}>
                <StarRating roadmapId={id} />
              </ClientOnly>
            </div>

            {/* Блок ресурсов */}
            {resources.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
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
                        className="flex items-center justify-between gap-2 rounded-lg border border-white/0 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 transition-all hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-500 dark:hover:text-blue-300"
                      >
                        <span className="truncate">{r.label || r.url}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Разделитель + Комментарии */}
      <ScrollToHash />
      <div id="comments" className="mx-auto max-w-5xl px-6 pb-16">
        <div className="border-t border-slate-200 dark:border-slate-700/60 pt-10">
          <CommentSection roadmapId={id} />
        </div>
      </div>
    </div>
  );
}
