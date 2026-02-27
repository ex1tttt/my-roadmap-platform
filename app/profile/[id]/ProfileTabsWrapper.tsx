"use client";
import ProfileTabs from "@/components/ProfileTabs";

export default function ProfileTabsWrapper({
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
  return (
    <ProfileTabs
      isOwner={isOwner}
      cards={cards}
      sharedCards={sharedCards}
      profile={profile}
      currentUserId={currentUserId}
    />
  );
}
