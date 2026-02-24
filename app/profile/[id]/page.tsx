import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ArrowLeft } from "lucide-react";
import PublicProfileCards from "@/components/PublicProfileCards";
import ProfileHeader from "@/components/ProfileHeader";

const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await supabaseServer
    .from("profiles")
    .select("username, bio")
    .eq("id", id)
    .maybeSingle();

  if (!data) return { title: "Профиль не найден" };
  return {
    title: `${data.username} | Roadmap Platform`,
    description: data.bio ?? `Профиль пользователя ${data.username}`,
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Получаем профиль, карточки пользователя и текущего залогиненного
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const [
    { data: profile },
    { data: cards },
    { data: { user: currentUser } },
    { count: followersCount },
    { count: followingCount },
  ] = await Promise.all([
    supabaseServer.from("profiles").select("id, username, avatar, bio").eq("id", id).maybeSingle(),
    supabaseServer
      .from("cards")
      .select("*, steps(*)")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    supabaseAuth.auth.getUser(),
    // Подписчики: только счёт строк, где following_id = id
    supabaseServer.from("follows").select("*", { count: "exact", head: true }).eq("following_id", id),
    // Подписки: только счёт строк, где follower_id = id
    supabaseServer.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", id),
  ]);

  const isOwner = currentUser?.id === id;

  // Проверяем подписку текущего пользователя отдельным точечным запросом
  const { count: isFollowingCount } = currentUser && !isOwner
    ? await supabaseServer
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", currentUser.id)
        .eq("following_id", id)
    : { count: 0 };
  const isFollowing = (isFollowingCount ?? 0) > 0;

  // Загружаем социальные данные для карточек
  const cardIds = (cards ?? []).map((c: any) => c.id as string);
  const enrichedCards = cards ?? [];

  if (cardIds.length > 0) {
    const [likesRes, userLikesRes, userFavsRes, ratingsRes, commentsRes] = await Promise.all([
      supabaseServer.from("likes").select("card_id").in("card_id", cardIds),
      currentUser
        ? supabaseServer.from("likes").select("card_id").eq("user_id", currentUser.id).in("card_id", cardIds)
        : Promise.resolve({ data: [] as any[] }),
      currentUser
        ? supabaseServer.from("favorites").select("roadmap_id").eq("user_id", currentUser.id).in("roadmap_id", cardIds)
        : Promise.resolve({ data: [] as any[] }),
      supabaseServer.from("ratings").select("roadmap_id, rate").in("roadmap_id", cardIds),
      supabaseServer.from("comments").select("roadmap_id").in("roadmap_id", cardIds),
    ]);

    const likesCountMap = new Map<string, number>();
    (likesRes.data ?? []).forEach((l: any) =>
      likesCountMap.set(l.card_id, (likesCountMap.get(l.card_id) ?? 0) + 1)
    );
    const userLikedSet = new Set<string>((userLikesRes.data ?? []).map((l: any) => l.card_id));
    const userFavSet = new Set<string>((userFavsRes.data ?? []).map((f: any) => f.roadmap_id));

    const ratingsMap = new Map<string, number[]>();
    (ratingsRes.data ?? []).forEach((r: any) => {
      const arr = ratingsMap.get(r.roadmap_id) ?? [];
      arr.push(r.rate);
      ratingsMap.set(r.roadmap_id, arr);
    });
    const avgRatingMap = new Map<string, number>();
    ratingsMap.forEach((values, cId) =>
      avgRatingMap.set(cId, values.reduce((a, b) => a + b, 0) / values.length)
    );

    const commentsCountMap = new Map<string, number>();
    (commentsRes.data ?? []).forEach((cm: any) =>
      commentsCountMap.set(cm.roadmap_id, (commentsCountMap.get(cm.roadmap_id) ?? 0) + 1)
    );

    enrichedCards.forEach((c: any) => {
      c._likesCount = likesCountMap.get(c.id) ?? 0;
      c._isLiked = userLikedSet.has(c.id);
      c._isFavorite = userFavSet.has(c.id);
      c._averageRating = avgRatingMap.get(c.id) ?? 0;
      c._commentsCount = commentsCountMap.get(c.id) ?? 0;
    });
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="text-center">
          <p className="text-lg text-slate-400">Пользователь не найден</p>
          <Link href="/" className="mt-4 inline-block text-sm text-blue-400 hover:underline">
            На главную
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 py-10 px-6">
      <main className="mx-auto max-w-5xl">

        {/* Назад */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          На главную
        </Link>

        {/* Шапка профиля */}
        <ProfileHeader
          profile={profile}
          cardsCount={cards?.length ?? 0}
          initialFollowersCount={followersCount ?? 0}
          followingCount={followingCount ?? 0}
          initialIsFollowing={isFollowing}
          isOwner={isOwner}
          currentUserId={currentUser?.id ?? null}
        />

        {/* Карточки */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-200">
            {isOwner ? "Мои карточки" : `Карточки пользователя`}
          </h2>

          {!cards || cards.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-8 text-center">
              <p className="text-slate-400">
                {isOwner ? "У вас пока нет карточек" : "Пользователь ещё не создал карточек"}
              </p>
              {isOwner && (
                <Link
                  href="/create"
                  className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Создать первую
                </Link>
              )}
            </div>
          ) : (
            <PublicProfileCards
              cards={enrichedCards}
              profile={{ id: profile.id, username: profile.username, avatar: profile.avatar }}
              currentUserId={currentUser?.id ?? null}
            />
          )}
        </section>
      </main>
    </div>
  );
}
