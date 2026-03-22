import Link from "next/link";
import type { Metadata } from "next";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ExternalLink, BookOpen, Lock } from "lucide-react";
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
  
  console.log(`[Metadata] 🔍 Fetching metadata for card: ${slug}`);
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // Определяем, это UUID или slug
    const isOldFormat = isUUID(slug);
    
    // đčĐÇđżđ▒ĐâđÁđ╝ REST API Đü Service Role Key đÁĐüđ╗đŞ đÁĐüĐéĐî
    if (serviceKey) {
      console.log(`[Metadata] ­čöĹ Using Service Role Key`);
      const queryParam = isOldFormat ? `id=eq.${slug}` : `slug=eq.${slug}`;
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
            console.log(`[Metadata] Ôťů Found via Service Role: "${data.title}"`);
          }
        }
      }
    }
    
    // đĽĐüđ╗đŞ đŻđÁ đŻđ░Đłđ╗đŞ Đü Service Role, đ┐đżđ┐ĐÇđżđ▒ĐâđÁđ╝ Anon Key
    if (!data) {
      console.log(`[Metadata] ­čöÉ Using Anon Key with RLS`);
      const queryParam = isOldFormat ? `id=eq.${slug}` : `slug=eq.${slug}`;
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
            console.log(`[Metadata] Ôťů Found via Anon Key: "${data.title}"`);
          }
        } else {
          console.warn(`[Metadata] Anon Key returned empty result for ${slug}`);
        }
      } else {
        const errorText = await res.text();
        console.error(`[Metadata] ÔŁî Anon Key request failed: ${res.status} - ${errorText.slice(0, 100)}`);
      }
    }
  } catch (error) {
    console.error(`[Metadata] 💥 Exception for card ${slug}:`, error instanceof Error ? error.message : String(error));
  }
  
  if (!data || !data.title) {
    console.warn(`[Metadata] 🚫 No data found for card ${slug} - using fallback`);
    return { 
      title: "Roadmap | đöđżĐÇđżđÂđŻđ░ĐĆ đ║đ░ĐÇĐéđ░ đŻđÁ đŻđ░đ╣đ┤đÁđŻđ░",
      description: "đíđżđ▓ĐÇđÁđ╝đÁđŻđŻđ░ĐĆ đ┐đ╗đ░ĐéĐäđżĐÇđ╝đ░ đ┤đ╗ĐĆ ĐÇđ░đĚđ▓đŞĐéđŞĐĆ, đżđ▒ĐâĐçđÁđŻđŞĐĆ đŞ đ┤đżĐüĐéđŞđÂđÁđŻđŞĐĆ đŻđżđ▓ĐőĐů đ▓ĐőĐüđżĐé."
    };
  }
  
  const title = data.title ?? "đĹđÁđĚ đŻđ░đĚđ▓đ░đŻđŞĐĆ";
  // đĽĐüđ╗đŞ description đ┐ĐâĐüĐéđ░ĐĆ, đŞĐüđ┐đżđ╗ĐîđĚĐâđÁđ╝ đŻđ░đĚđ▓đ░đŻđŞđÁ đ║đ░ĐÇĐéĐő đ║đ░đ║ đżđ┐đŞĐüđ░đŻđŞđÁ
  const desc = (data.description === "EMPTY" || !data.description) 
    ? title
    : data.description;
  const description = desc.slice(0, 160);
  const image = DEFAULT_OG_IMAGE;
  
  console.log(`[Metadata] ÔťĘ Generated OG tags: "${title}" | "${description.slice(0, 40)}..."`);
  
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
  // đčđżđ╗ĐâĐçđ░đÁđ╝ đ┐đżđ╗ĐîđĚđżđ▓đ░ĐéđÁđ╗ĐĆ đŞ đ║đ░ĐÇĐéđżĐçđ║Đâ đ┐đ░ĐÇđ░đ╗đ╗đÁđ╗ĐîđŻđż
  // Определяем, это UUID или slug
  const isOldFormat = isUUID(slug);
  
  // Получаем пользователя и карточку параллельно
  const cardQuery = isOldFormat
    ? supabaseAuth.from("cards").select("*, steps(*), resources(*), profiles:user_id(*)").eq("id", slug).maybeSingle()
    : supabaseAuth.from("cards").select("*, steps(*), resources(*), profiles:user_id(*)").eq("slug", slug).maybeSingle();
    
  const [
    cardResult,
    { data: { user: currentUser } }
  ] = await Promise.all([
    cardQuery,
    supabaseAuth.auth.getUser(),
  ]);
  
  let { data, error } = cardResult;
  
  // Если запрос по slug вернул ошибку, пробуем по ID как fallback
  if (error && !isOldFormat) {
    const fallbackResult = await supabaseAuth
      .from("cards")
      .select("*, steps(*), resources(*), profiles:user_id(*)")
      .eq("id", slug)
      .maybeSingle();
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  // đčĐÇđżđ▓đÁĐÇđ║đ░ đżĐłđŞđ▒đżđ║
  if (error) {
    console.error("Full fetch error:", error);
    return (
      <div className="min-h-screen bg-white dark:bg-[#020617] py-12 px-6">
        <main className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-950/40 p-6 space-y-1">
            <p className="font-semibold text-red-600 dark:text-red-400">đ×ĐłđŞđ▒đ║đ░ đ┐ĐÇđŞ đĚđ░đ│ĐÇĐâđĚđ║đÁ đ║đ░ĐÇĐéđżĐçđ║đŞ</p>
            <p className="text-sm text-red-300">{error.message}</p>
            {error.details && <p className="text-xs text-red-500">{error.details}</p>}
          </div>
        </main>
      </div>
    );
  }

  // đčĐÇđżđ▓đÁĐÇĐĆđÁđ╝ đ║đżđ╗đ╗đ░đ▒đżĐÇđ░ĐćđŞĐÄ đŞ đ▒đ╗đżđ║đŞĐÇđżđ▓đ║Đâ đ┐đ░ĐÇđ░đ╗đ╗đÁđ╗ĐîđŻđż
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
        .eq('blocker_id', data.user_id)
        .eq('blocked_id', currentUser.id)
        .maybeSingle(),
    ]);
    collaboratorRole = (collabResult.data?.role as "viewer" | "editor") ?? null;
    isBlockedByAuthor = !!blockResult.data;
  }
  const isCollaborator = collaboratorRole !== null;
  // đĽĐüđ╗đŞ đ░đ▓ĐéđżĐÇ đ║đ░ĐÇĐéđżĐçđ║đŞ đĚđ░đ▒đ╗đżđ║đŞĐÇđżđ▓đ░đ╗ ĐéđÁđ║ĐâĐëđÁđ│đż đ┐đżđ╗ĐîđĚđżđ▓đ░ĐéđÁđ╗ĐĆ ÔÇö đĚđ░đ║ĐÇĐőđ▓đ░đÁđ╝ đ┤đżĐüĐéĐâđ┐
  const isOwner = !!currentUser && data && currentUser.id === data.user_id;
  if (data && !isOwner && isBlockedByAuthor) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#020617] py-12 px-6">
        <main className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-10 text-center text-slate-500 dark:text-slate-400">
            <p className="text-lg font-medium">\u0414\u043e\u0441\u0442\u0443\u043f \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d</p>
            <p className="mt-2 text-sm">\u042d\u0442\u0430 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0430 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430.</p>
          </div>
        </main>
      </div>
    );
  }

  if (!data || (data.is_private && (!currentUser || (currentUser.id !== data.user_id && !isCollaborator)))) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#020617] py-12 px-6">
        <main className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-10 text-center text-slate-500 dark:text-slate-400">
            đÜđ░ĐÇĐéđżĐçđ║đ░ Đü Đéđ░đ║đŞđ╝ ID đŻđÁ đŻđ░đ╣đ┤đÁđŻđ░.
          </div>
        </main>
      </div>
    );
  }
  let author = Array.isArray(data.profiles) ? (data.profiles[0] ?? null) : (data.profiles ?? null);
  if (!author && data.user_id) {
    const { data: profileFallback } = await supabaseAuth
      .from("profiles")
      .select("*")
      .eq("id", data.user_id)
      .maybeSingle();
    author = profileFallback ?? null;
  }
  const authorName = author?.username ?? 'đÉđ▓ĐéđżĐÇ đŻđÁđŞđĚđ▓đÁĐüĐéđÁđŻ';
  const authorAvatar: string | null = author?.avatar ?? null;
  const steps: Step[] = (data.steps || []).slice().sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
  const resources: Resource[] = (data.resources || []).filter((r: Resource) => r.url);
  const stepIds = steps.map((s) => s.id)
  let initialDoneArr: string[] = []
  if (currentUser && stepIds.length > 0) {
    const { data: progressRows } = await supabaseAuth
      .from('user_progress')
      .select('step_id')
      .eq('user_id', currentUser.id)
      .eq('card_id', data.id)
      .in('step_id', stepIds)
    initialDoneArr = (progressRows ?? []).map((r: any) => r.step_id as string)
  }
  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] text-slate-900 dark:text-slate-100">
      <div className="border-b border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/60 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <BackButton />
            <div className="flex items-center gap-2">
              <ClientOnly fallback={<div className="h-7 w-24" />}>
                <ShareButton
                  cardId={data.id}
                  slug={data.slug}
                  title={data.title}
                  description={data.description ?? undefined}
                  label="đčđżđ┤đÁđ╗đŞĐéĐîĐüĐĆ"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/5 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 transition-colors hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200"
                />
              </ClientOnly>
              {(isOwner || collaboratorRole === "editor") && (
                <CardEditButton cardId={data.id} />
              )}
              {isOwner && (
                <DeleteButton cardId={data.id} />
              )}
              {!isOwner && currentUser && (
                <ClientOnly fallback={<div className="h-7 w-16" />}>
                  <ReportCardButton cardId={data.id} />
                </ClientOnly>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {data.category && (
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-widest text-blue-500 dark:text-blue-400">
                {data.category}
              </span>
            )}
            <div className="flex items-center gap-2">
              {data.is_private && (
                <span title="đčĐÇđŞđ▓đ░ĐéđŻđ░ĐĆ đ║đ░ĐÇĐéđżĐçđ║đ░">
                  <Lock size={18} className="text-amber-500 dark:text-slate-400" />
                </span>
              )}
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {data.title}
              </h1>
            </div>
          </div>
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
                <StarRating roadmapId={data.id} compact />
              </ClientOnly>
            </div>
          </div>
          {data.description && (
            <p className="mt-2 line-clamp-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
              {data.description}
            </p>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-5xl gap-8 px-6 py-12 lg:grid lg:grid-cols-[1fr_280px]">
        <section>
          <h2 className="mb-8 flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200">
            <BookOpen className="h-5 w-5 text-blue-400" />
            <T k="card.roadmap" />
            <span className="ml-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-400">
              {steps.length}
            </span>
          </h2>
          <ClientOnly>
            <StepsProgress
              cardId={data.id}
              userId={currentUser?.id ?? null}
              steps={steps}
              initialDone={initialDoneArr}
            />
          </ClientOnly>
        </section>
        <aside className="mt-12 lg:mt-0">
          <div className="sticky top-20 space-y-4">
            <div className="relative z-10 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                <T k="card.rate" />
              </h2>
              <ClientOnly fallback={<div className="h-16" />}>
                <StarRating roadmapId={data.id} />
              </ClientOnly>
            </div>
            {resources.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  <ExternalLink className="h-4 w-4" />
                  <T k="card.materials" />
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
      <ScrollToHash />
      <ViewHistoryRecorder cardId={data.id} />
      <div id="comments" className="mx-auto max-w-5xl px-6 pb-16">
        <div className="border-t border-slate-200 dark:border-slate-700/60 pt-10">
          <CommentSection roadmapId={data.id} />
        </div>
      </div>
    </div>
  );
}
