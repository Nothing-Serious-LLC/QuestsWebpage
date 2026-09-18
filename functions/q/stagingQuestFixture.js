export const STAGING_QUEST_FIXTURE_HOST =
  "quest-sharing-staging.quests-invite.pages.dev";
export const STAGING_QUEST_FIXTURE_CODE = "PHLYrwGR";
export const STAGING_QUEST_FIXTURE_TOKEN = "20260801-2";
export const STAGING_QUEST_FIXTURE_CUTOFF =
  "2026-08-08T04:00:00.000Z";
export const STAGING_QUEST_FIXTURE_OG_PATH =
  "/quest-share-fixtures/PHLYrwGR-og.png";

export const STAGING_QUEST_FIXTURE_PRESENTATION = Object.freeze({
  presentationVersion: 1,
  availability: "joinable",
  revision: 0,
  title: "Daily Reading",
  shortDescription:
    "Read for 20 minutes every day. Books, articles, anything that interests you.",
  icon: "book-open-page-variant",
  iconColor: "#3498DB",
  category: "productivity",
  hostDisplayName: "Elliott",
  hostAvatarUrl: null,
  startDate: "2026-08-01T12:00:00.000Z",
  endDate: "2026-08-30T12:00:00.000Z",
  duration: "30 days",
  durationDays: 30,
  cadenceLabel: "Every day",
  frequency: "DAILY",
  status: "ACTIVE",
  participantCount: 1,
  coverImageUrl: null,
  isGroupQuest: false,
  privacyLevel: "PRIVATE",
});

export const STAGING_QUEST_COMMUNITY_FIXTURE_CODE = "WkendHke";
export const STAGING_QUEST_COMMUNITY_FIXTURE_OG_PATH =
  "/quest-share-fixtures/WkendHke-og.png";

export const STAGING_QUEST_COMMUNITY_FIXTURE_PRESENTATION = Object.freeze({
  presentationVersion: 1,
  availability: "joinable",
  revision: 0,
  title: "Weekend Morning Hikes",
  shortDescription:
    "Meet at the trailhead every Saturday. All paces welcome.",
  icon: "hiking",
  iconColor: null,
  category: "recharge_move",
  hostDisplayName: "Elliott",
  hostAvatarUrl: null,
  startDate: "2026-08-01T12:00:00.000Z",
  endDate: "2026-09-26T12:00:00.000Z",
  duration: "8 weeks",
  durationDays: 56,
  cadenceLabel: "Every week",
  frequency: "WEEKLY",
  status: "ACTIVE",
  participantCount: 12,
  coverImageUrl: "/quest-share-fixtures/WkendHke-cover.jpg",
  isGroupQuest: true,
  privacyLevel: "PUBLIC",
});

const STAGING_QUEST_FIXTURES = Object.freeze({
  [STAGING_QUEST_FIXTURE_CODE]: Object.freeze({
    presentation: STAGING_QUEST_FIXTURE_PRESENTATION,
    ogPath: STAGING_QUEST_FIXTURE_OG_PATH,
  }),
  [STAGING_QUEST_COMMUNITY_FIXTURE_CODE]: Object.freeze({
    presentation: STAGING_QUEST_COMMUNITY_FIXTURE_PRESENTATION,
    ogPath: STAGING_QUEST_COMMUNITY_FIXTURE_OG_PATH,
  }),
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
    !hasExactQuery ||
    now >= cutoff
  ) {
    return null;
  }
  return STAGING_QUEST_FIXTURES[shareCode]?.presentation ?? null;
}

export function stagingQuestFixtureOgPathForCode(shareCode) {
  return STAGING_QUEST_FIXTURES[shareCode]?.ogPath ?? null;
}
