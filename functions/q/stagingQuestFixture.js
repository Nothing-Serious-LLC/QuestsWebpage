export const STAGING_QUEST_FIXTURE_HOST =
  "quest-sharing-staging.quests-invite.pages.dev";
export const STAGING_QUEST_FIXTURE_CODE = "PHLYrwGR";
export const STAGING_QUEST_FIXTURE_TOKEN = "20260801-1";
export const STAGING_QUEST_FIXTURE_CUTOFF =
  "2026-08-03T14:58:07.728Z";
export const STAGING_QUEST_FIXTURE_OG_PATH =
  "/quest-share-fixtures/PHLYrwGR-og.png";

export const STAGING_QUEST_FIXTURE_PRESENTATION = Object.freeze({
  presentationVersion: 1,
  availability: "joinable",
  revision: 0,
  title: "[DEV STACK TEST] Creativity 1",
  shortDescription: "Dev Home stack seed.",
  icon: "palette",
  iconColor: "#A961CC",
  category: null,
  hostDisplayName: "Quests Test Account",
  hostAvatarUrl: null,
  startDate: "2026-07-04T14:58:07.728Z",
  endDate: "2026-08-03T14:58:07.728Z",
  duration: "31 days",
  durationDays: 31,
  cadenceLabel: "Every day",
  frequency: "DAILY",
  status: "ACTIVE",
  participantCount: 1,
  coverImageUrl: null,
  isGroupQuest: false,
  privacyLevel: "PUBLIC",
});

export function stagingQuestFixtureForRequest({
  url,
  shareCode,
  now = new Date(),
}) {
  const parsed = url instanceof URL ? url : new URL(url);
  const cutoff = new Date(STAGING_QUEST_FIXTURE_CUTOFF);
  const hasExactQuery =
    parsed.searchParams.size === 1 &&
    parsed.searchParams.get("preview") === STAGING_QUEST_FIXTURE_TOKEN;
  if (
    parsed.hostname !== STAGING_QUEST_FIXTURE_HOST ||
    shareCode !== STAGING_QUEST_FIXTURE_CODE ||
    !hasExactQuery ||
    now >= cutoff
  ) {
    return null;
  }
  return STAGING_QUEST_FIXTURE_PRESENTATION;
}
