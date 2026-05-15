/** Client-only push copy helpers (avoid importing i18n on the server). */

function t(key: string, vars?: Record<string, string | number>): string {
  if (typeof window === "undefined") return key;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const i18n = require("@/lib/i18n").default;
  return i18n.t(key, vars);
}

/** Display name for push/notification copy. */
export function notifySomeone(username?: string | null): string {
  const trimmed = username?.trim();
  return trimmed || t("notifications.someone");
}

export function pushLike(cardTitle: string, cardId: string, someone?: string | null) {
  return {
    title: t("push.title.like"),
    body: t("push.body.like", {
      someone: notifySomeone(someone),
      card: cardTitle,
    }),
    url: `/card/${cardId}`,
  };
}

export function pushComment(cardTitle: string, roadmapId: string, someone?: string | null) {
  return {
    title: t("push.title.comment"),
    body: t("push.body.comment", {
      someone: notifySomeone(someone),
      card: cardTitle,
    }),
    url: `/card/${roadmapId}`,
  };
}

export function pushCommentReply(roadmapId: string, someone?: string | null) {
  return {
    title: t("push.title.commentReply"),
    body: t("push.body.commentReply", { someone: notifySomeone(someone) }),
    url: `/card/${roadmapId}#comments`,
  };
}

export function pushCommentLike(roadmapId: string, someone?: string | null) {
  return {
    title: t("push.title.commentLike"),
    body: t("push.body.commentLike", { someone: notifySomeone(someone) }),
    url: `/card/${roadmapId}#comments`,
  };
}

export function pushMention(
  cardId: string,
  actorName: string,
  cardTitle?: string | null
) {
  return {
    title: t("push.title.mention", { name: actorName }),
    body: cardTitle
      ? t("push.body.mentionWithCard", { card: cardTitle })
      : t("push.body.mentionNoCard"),
    url: `/card/${cardId}#comments`,
  };
}

export function pushFollow(profileId: string) {
  return {
    title: t("push.title.follow"),
    body: t("push.body.follow"),
    url: `/profile/${profileId}`,
  };
}

export function pushNewCard(cardId: string, title: string) {
  return {
    title: t("push.title.newCard"),
    body: t("push.body.newCard", { title }),
    url: `/card/${cardId}`,
  };
}

export function pushNewGantt(cardId: string, title: string) {
  return {
    title: t("push.title.newGantt"),
    body: t("push.body.newGantt", { title }),
    url: `/card/${cardId}`,
  };
}
