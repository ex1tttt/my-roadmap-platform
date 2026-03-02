"use client"

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import PublicProfileCards from "@/components/PublicProfileCards";
import Link from "next/link";

export default function ProfileTabs({
  isOwner,
  cards,
  sharedCards,
  profile,
  currentUserId
}: {
  isOwner: boolean;
  cards: any[];
  sharedCards: any[];
  profile: { id: string; username: string; avatar?: string };
  currentUserId: string | null;
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("my");

  return (
    <>
      <div className="flex gap-2 mt-8 mb-6">
        <button
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: activeTab === "my" ? '#2563eb' : '', color: activeTab === "my" ? '#fff' : '' }}
          onClick={() => setActiveTab("my")}
        >
          {t("profileTabs.myCards")}
        </button>
        {isOwner && (
          <button
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            style={{ background: activeTab === "shared" ? '#2563eb' : '', color: activeTab === "shared" ? '#fff' : '' }}
            onClick={() => setActiveTab("shared")}
          >
            <Users className="w-4 h-4" /> {t("profileTabs.sharedWithMe")}
          </button>
        )}
      </div>

      {activeTab === "my" && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200">
            {isOwner ? t("profileTabs.myCards") : t("profileTabs.cardsByUser")}
          </h2>
          {!cards || cards.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 p-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">
                {isOwner ? t("profileTabs.noCardsYet") : t("profileTabs.noCardsUser")}
              </p>
              {isOwner && (
                <Link
                  href="/create"
                  className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {t("profileTabs.createFirst")}
                </Link>
              )}
            </div>
          ) : (
            <PublicProfileCards
              cards={cards}
              profile={profile}
              currentUserId={currentUserId}
            />
          )}
        </section>
      )}

      {isOwner && activeTab === "shared" && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Users className="w-5 h-5" /> {t("profileTabs.sharedWithMe")}
          </h2>
          {sharedCards.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 p-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">
                {t("profileTabs.noSharedCards")}
              </p>
            </div>
          ) : (
            <PublicProfileCards
              cards={sharedCards}
              profile={profile}
              currentUserId={currentUserId}
            />
          )}
        </section>
      )}
    </>
  );
}
