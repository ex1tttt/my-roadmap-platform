import Link from "next/link";
import type { Metadata } from "next";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ExternalLink, Lock, ArrowLeft } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import DeleteButton from "@/components/DeleteButton";
import CommentSection from "@/components/CommentSection";
import StarRating from "@/components/StarRating";
import ScrollToHash from "@/components/ScrollToHash";
import ShareButton from "@/components/ShareButton";
import StepsProgress from "@/components/StepsProgress";
import ClientOnly from "@/components/ClientOnly";
import ViewHistoryRecorder from "./ViewHistoryRecorder";
import BackButton from "./BackButton";
import CardEditButton from "./CardEditButton";
import T from "@/components/T";
import ReportCardButton from "@/components/ReportCardButton";
import { isUUID } from "@/lib/slug";

type Step = { id: string; order: number; title: string; content?: string; link?: string; media_url?: string; media_urls?: string[]; duration_minutes?: number };
type Resource = { id: string; label?: string; url?: string };

function normalizeUrl(url: string): string {
  if (!url) return url;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

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

const DEFAULT_OG_IMAGE = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://roadmap-platform.vercel.app"}/og-default.svg`;

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  let data: { title: string; description: string } | null = null;
  
  console.log(`[Metadata] 🔍 Fetching metadata for slug: ${slug}`);
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // Определяем, это UUID или slug
    const isOldFormat = isUUID(slug);
    const queryParam = isOldFormat ? `id=eq.${slug}` : `slug=eq.${slug}`;
    
    // Пробуем REST API с Service Role Key если есть
    if (serviceKey) {
      console.log(`[Metadata] 🔑 Using Service Role Key`);
      const res = await fetch(
        `${supabaseUrl}/rest/v1/cards?${queryParam}&select=title,description&limit=1`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            Accept: "application/json",
          },
        }
      );
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) {
          data = rows[0];
          if (data) {
            console.log(`[Metadata] ✅ Found via Service Role: "${data.title}"`);
          }
        }
      }
    }
    
    // Если не нашли с Service Role, попробуем Anon Key
    if (!data) {
      console.log(`[Metadata] 🔐 Using Anon Key with RLS`);
      const res = await fetch(
        `${supabaseUrl}/rest/v1/cards?${queryParam}&select=title,description&limit=1`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Accept: "application/json",
          },
        }
      );
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) {
          data = rows[0];
          if (data) {
            console.log(`[Metadata] ✅ Found via Anon Key: "${data.title}"`);
          }
        } else {
          console.warn(`[Metadata] ⚠️ Anon Key returned empty result for ${slug}`);
        }
      } else {
        const errorText = await res.text();
        console.error(`[Metadata] ❌ Anon Key request failed: ${res.status} - ${errorText.slice(0, 100)}`);
      }
    }
  } catch (error) {
    console.error(`[Metadata] 💥 Exception for card ${slug}:`, error instanceof Error ? error.message : String(error));
  }
  
  if (!data || !data.title) {
    console.warn(`[Metadata] 🚫 No data found for card ${slug} - using fallback`);
    return { 
      title: "Roadmap | Дорожная карта не найдена",
      description: "Современная платформа для развития, обучения и достижения новых высот."
    };
  }
  
  const title = data.title ?? "Без названия";
  // Если description пустая, используем название карты как описание
  const desc = (data.description === "EMPTY" || !data.description) 
    ? title
    : data.description;
  const description = desc.slice(0, 160);
  const image = DEFAULT_OG_IMAGE;
  
  console.log(`[Metadata] ✨ Generated OG tags: "${title}" | "${description.slice(0, 40)}..."`);
  
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

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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
  
  // Определяем, это UUID или slug
  const isOldFormat = isUUID(slug);
  const query = isOldFormat 
    ? supabaseAuth.from("cards").select("*, steps(*), resources(*), profiles:user_id(*)").eq("id", slug) 
    : supabaseAuth.from("cards").select("*, steps(*), resources(*), profiles:user_id(*)").eq("slug", slug);
  
  // Получаем пользователя и карточку параллельно
  const [
    { data, error },
    { data: { user: currentUser } }
  ] = await Promise.all([
    query.maybeSingle(),
    supabaseAuth.auth.getUser(),
  ]);

  // Проверка ошибок
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

  // Проверяем коллаборацию и блокировку параллельно
  let collaboratorRole: "viewer" | "editor" | null = null;
  let isBlockedByAuthor = false;
  if (data && currentUser) {
    const [collabResult, blockResult] = await Promise.all([
      currentUser.email
        ? supabaseAuth
            .from('card_collaborators')
            .select('role')
            .eq('card_id', data.id)
            .eq('user_email', currentUser.email)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAuth
        .from('user_blocks')
        .select('id')
        .eq('blocked_user_id', currentUser.id)
        .eq('blocking_user_id', data.user_id)
        .maybeSingle(),
    ]);
    
    collaboratorRole = collabResult.data?.role ?? null;
    isBlockedByAuthor = !!blockResult.data;
  }

  const canEdit = data && (data.user_id === currentUser?.id || collaboratorRole === "editor");
  const canDelete = data && data.user_id === currentUser?.id;

  if (!data) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#020617] py-12 px-6">
        <main className="mx-auto max-w-4xl">
          <BackButton />
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 p-8 text-center">
            <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">
              Card not found
            </p>
          </div>
        </main>
      </div>
    );
  }

  const { steps = [], resources = [], profiles = [] } = data;
  const user = Array.isArray(profiles) ? profiles[0] : null;

  return (
    <div className="min-h-screen bg-white dark:bg-[#020617]">
      <div className="mx-auto max-w-4xl px-6 py-2 md:py-6 space-y-4">
        <BackButton />

        {isBlockedByAuthor && (
          <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              The author has blocked you. You can view this card but cannot leave comments
            </p>
          </div>
        )}

        {/* Заголовок и действия */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-2">
                {data.title}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {data.category && <span className="inline-block px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded mr-2">{data.category}</span>}
              </p>
            </div>
            {canEdit && <CardEditButton cardId={data.id} />}
            {canDelete && <DeleteButton cardId={data.id} />}
          </div>

          {/* Инфо об авторе и дата */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
            {user && (
              <Link
                href={`/u/${user.username}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 hover:text-slate-900 dark:hover:text-slate-200"
              >
                <UserAvatar username={user.username} avatarUrl={user.avatar_url} size={32} />
                <span>{user.username}</span>
              </Link>
            )}
            {data.created_at && (
              <span>{new Date(data.created_at).toLocaleDateString()}</span>
            )}
            {data.is_private && <Lock className="h-4 w-4 text-orange-500" />}
          </div>

          {/* Описание */}
          {data.description && data.description !== "EMPTY" && (
            <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed">
              {data.description}
            </p>
          )}

          {/* Действия: лайк, комментарии, поделиться */}
          <div className="flex flex-wrap items-center gap-4 pt-2 text-sm">
            <ClientOnly>
              <div className="flex gap-3">
                {/* Социальные кнопки */}
                <ShareButton 
                  cardId={data.id} 
                  slug={data.slug}
                  title={data.title} 
                  description={data.description || data.title} />
              </div>
            </ClientOnly>
          </div>
        </div>

        {/* Страницы: описание, ресурсы, обсуждение */}
        {steps && steps.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Steps
            </h2>
            <StepsProgress steps={steps} cardId={data.id} userId={currentUser?.id ?? null} initialDone={[]} />
          </div>
        )}

        <div className="space-y-4">
          {resources && resources.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                Resources
              </h2>
              <div className="space-y-2">
                {resources.map((resource: Resource) => (
                  <a
                    key={resource.id}
                    href={normalizeUrl(resource.url || "")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4 flex-shrink-0" />
                    <span className="break-all">{resource.label || resource.url}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {steps && steps.length > 0 && steps.some((step: Step) => step.media_url || step.media_urls?.length) && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                Media
              </h2>
              <div className="space-y-4">
                {steps
                  .filter((step: Step) => step.media_url || step.media_urls?.length)
                  .map((step: Step) => (
                    <div key={step.id}>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {step.title}
                      </p>
                      {renderMedia(step.media_url, step.title)}
                      {step.media_urls &&
                        step.media_urls.map((url: string, idx: number) => (
                          <div key={idx} className="mt-2">
                            {renderMedia(url, `${step.title} #${idx + 1}`)}
                          </div>
                        ))}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Рейтинг */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Rating
          </h2>
          <ClientOnly>
            <StarRating roadmapId={data.id} initialAverageRate={data.avg_rating} />
          </ClientOnly>
        </div>

        {/* Комментарии */}
        <div id="comments" className="scroll-mt-20">
          <ClientOnly>
            <CommentSection roadmapId={data.id} />
          </ClientOnly>
        </div>

        {/* Отчет */}
        <div className="pt-4">
          <ClientOnly>
            <ReportCardButton cardId={data.id} />
          </ClientOnly>
        </div>

        {/* История просмотров */}
        <ClientOnly>
          <ViewHistoryRecorder cardId={data.id} />
        </ClientOnly>
      </div>

      {/* Скролл к якорям */}
      <ClientOnly>
        <ScrollToHash />
      </ClientOnly>
    </div>
  );
}
