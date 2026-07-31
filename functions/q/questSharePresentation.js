export const QUEST_SHARE_PRESENTATION_VERSION = 1;
export const QUEST_SHARE_CODE_PATTERN = /^[A-HJ-NP-Za-hj-kmnp-z2-9]{8}$/;
export const QUEST_SHARE_REVISION_PATTERN = /^[1-9][0-9]{0,9}$/;

const DISPLAYABLE_STATUSES = new Set(["ACTIVE", "UPCOMING", "COMPLETED"]);
const PRIVACY_LEVELS = new Set(["PUBLIC", "PRIVATE"]);
const FREQUENCIES = new Set(["DAILY", "WEEKLY", "MONTHLY"]);
const QUEST_CATEGORIES = new Set([
  "recharge_move",
  "social_lifestyle",
  "mindfulness",
  "creativity",
  "productivity",
]);
const ICON_PATTERN = /^[a-z0-9-]{1,64}$/;
const QUEST_TITLE_LIMIT = 80;
const QUEST_DESCRIPTION_LIMIT = 200;
const QUEST_HOST_LIMIT = 120;
const QUEST_DURATION_LIMIT = 80;
const QUEST_CADENCE_LIMIT = 80;
const POSTGRES_INTEGER_MAX = 2_147_483_647;
const AVATAR_PATH_PREFIXES = [
  "/storage/v1/object/public/avatars/",
  "/storage/v1/render/image/public/avatars/",
];
const COVER_PATH_PREFIXES = [
  "/storage/v1/object/public/standard-quest-backgrounds/",
  "/storage/v1/render/image/public/standard-quest-backgrounds/",
];

function boundedText(value, maxLength, fallback = "") {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maxLength) : fallback;
}

function positiveInteger(value, maximum) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > maximum) {
    return null;
  }
  return number;
}

function isoDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function safeSameProjectMediaUrl(value, supabaseUrl, pathPrefixes) {
  if (typeof value !== "string" || !value.trim() || !supabaseUrl) return null;

  try {
    const candidate = new URL(value.trim());
    const project = new URL(supabaseUrl);
    if (
      candidate.protocol !== "https:" ||
      candidate.origin !== project.origin ||
      candidate.username ||
      candidate.password ||
      !pathPrefixes.some((prefix) => candidate.pathname.startsWith(prefix))
    ) {
      return null;
    }
    return candidate.toString();
  } catch {
    return null;
  }
}

export function normalizeQuestSharePresentation(raw, { supabaseUrl = "" } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (Number(raw.presentationVersion) !== QUEST_SHARE_PRESENTATION_VERSION) return null;

  if (raw.revision == null) return null;
  const revision = positiveInteger(raw.revision, Number.MAX_SAFE_INTEGER);
  if (revision == null) return null;

  const title = boundedText(raw.title, QUEST_TITLE_LIMIT);
  const status = boundedText(raw.status, 24).toUpperCase();
  if (!title || !DISPLAYABLE_STATUSES.has(status)) return null;

  const availability = boundedText(raw.availability, 32).toLowerCase();
  const expectedAvailability = status === "COMPLETED" ? "ended" : "joinable";
  if (availability !== expectedAvailability) {
    return null;
  }

  const iconCandidate = boundedText(raw.icon, 64).toLowerCase();
  const icon = ICON_PATTERN.test(iconCandidate) ? iconCandidate : null;
  const iconColorCandidate = boundedText(raw.iconColor, 7);
  const iconColor = /^#[0-9a-f]{6}$/i.test(iconColorCandidate)
    ? iconColorCandidate.toUpperCase()
    : null;

  const durationDays = raw.durationDays == null
    ? null
    : positiveInteger(raw.durationDays, POSTGRES_INTEGER_MAX);
  if (raw.durationDays != null && durationDays == null) return null;

  const participantCount = raw.participantCount == null
    ? null
    : positiveInteger(raw.participantCount, POSTGRES_INTEGER_MAX);
  if (participantCount == null) return null;

  const privacyCandidate = boundedText(raw.privacyLevel, 16).toUpperCase();
  const privacyLevel = PRIVACY_LEVELS.has(privacyCandidate)
    ? privacyCandidate
    : null;
  const categoryCandidate = boundedText(raw.category, 32).toLowerCase();
  const category = QUEST_CATEGORIES.has(categoryCandidate) ? categoryCandidate : null;
  if (raw.category != null && !category) return null;
  const hostDisplayName = boundedText(raw.hostDisplayName, QUEST_HOST_LIMIT);
  const startDate = isoDate(raw.startDate);
  const endDate = isoDate(raw.endDate);
  const duration = boundedText(raw.duration, QUEST_DURATION_LIMIT);
  const cadenceLabel = boundedText(raw.cadenceLabel, QUEST_CADENCE_LIMIT);
  const frequencyCandidate = boundedText(raw.frequency, 32).toUpperCase();
  const frequency = FREQUENCIES.has(frequencyCandidate) ? frequencyCandidate : null;
  if (
    !hostDisplayName || !startDate ||
    (raw.endDate != null && !endDate) ||
    !duration || !cadenceLabel || !frequency || !privacyLevel ||
    typeof raw.isGroupQuest !== "boolean"
  ) {
    return null;
  }

  const shortDescription = boundedText(
    raw.shortDescription,
    QUEST_DESCRIPTION_LIMIT,
  ) || null;

  return Object.freeze({
    presentationVersion: QUEST_SHARE_PRESENTATION_VERSION,
    revision,
    title,
    shortDescription,
    icon,
    iconColor,
    category,
    hostDisplayName,
    hostAvatarUrl: safeSameProjectMediaUrl(
      raw.hostAvatarUrl,
      supabaseUrl,
      AVATAR_PATH_PREFIXES,
    ),
    startDate,
    endDate,
    duration,
    durationDays,
    cadenceLabel,
    frequency,
    status,
    availability,
    participantCount,
    coverImageUrl: safeSameProjectMediaUrl(
      raw.coverImageUrl,
      supabaseUrl,
      COVER_PATH_PREFIXES,
    ),
    isGroupQuest: raw.isGroupQuest,
    privacyLevel,
  });
}

export function safeTurnstileSiteKey(value) {
  const candidate = boundedText(value, 128);
  return /^[A-Za-z0-9_-]{10,128}$/.test(candidate)
    ? candidate
    : "0x4AAAAAACaMy8ev_fZjSv2s";
}
