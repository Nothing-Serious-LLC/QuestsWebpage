# Quests V2 site copy (final, copy verbatim)

Source of truth for every word on the site. Builders: paste these strings exactly. Do not paraphrase, do not "improve", do not add sentences.

**Hard rules baked into this document (keep them when you edit):**
1. No em dashes, no en dashes anywhere. Hyphens inside compound words ("check-in", "time-bound") are fine. Separator in page titles is a pipe `|`.
2. No antithetical or negation framing ("not X, but Y", "X, not Y"). Everything states things affirmatively.
3. Never the words "habit tracker". Category words: healthy challenges, habits with friends.
4. One stat sitewide: 76%. The 4.9 App Store rating is a product rating and is allowed in the proof row. Do not introduce any other number as a stat (no "10,000 users", no "35% alone" comparison figure; the comparison is carried verbally by "more than doubles your odds").
5. Capitalization: lowercase "quest" when it means a challenge you join ("pick a quest"). Capital "Quest" in the button label "Start your first Quest" and in the proper nouns "Quest Card" and "Quests" (the app).
6. Sentence case everywhere. Headlines capitalize the first word only.

---

## 1. Homepage (index.html)

### 1.1 Nav

Wordmark link, `assets/img/quests-wordmark.svg`, recolored `#191919`.

| Slot | Copy |
| --- | --- |
| Wordmark link alt | `Quests` |
| Wordmark link aria-label | `Quests home` |
| CTA pill label | `Download` |
| CTA pill aria-label | `Download Quests` |

CTA target: the hero store badges (anchor `#get`) on desktop, App Store URL on direct tap is also acceptable. Label stays one word, `Download`, on every breakpoint.

### 1.2 Hero

**Headline (italic word marked).** The italic accent is `together.` including the period, set in Instrument Serif Italic, color `--purple`. One italic per headline, this is the site's one.

```html
<h1 class="hero__title">Better, <em>together.</em></h1>
```

Plain text: `Better, together.`

**Subhead (one sentence, locked anchor, do not reword):**

```
You're better at building habits when you do it with people you care about.
```

**Store CTA labels.** Both badges appear, App Store first.

| Element | Copy |
| --- | --- |
| App Store badge alt | `Download on the App Store` |
| App Store link aria-label | `Download Quests on the App Store` |
| Google Play badge alt | `Get it on Google Play` |
| Google Play link aria-label | `Get Quests on Google Play` |
| Optional caption under badges | `Free to download. iOS and Android.` |

Links, verbatim:
- `https://apps.apple.com/us/app/quests-social-habit-tracking/id6745767553`
- `https://play.google.com/store/apps/details?id=info.nothingserious.quests`

**Live quest card (hero signature element) copy:**

| Slot | Copy |
| --- | --- |
| Quest name (Instrument Serif) | `Morning Run` |
| Streak meta | `Day 12` |
| Avatar cluster label | `+3` |
| Hint pill, idle | `Tap & Hold to check in` |
| Hint pill, complete | `Checked in today ✓` |
| Card aria-label | `Demo quest card. Hold to check in.` |
| Screen-reader status on complete | `Checked in for today.` |

No category eyebrow inside the card, as built. The medallion is an inline SVG icon, `aria-hidden="true"`, decorative; the quest name carries the meaning.

### 1.3 How it works

Three numbered steps, a real sequence. Card order and colors: 1 mindfulness purple, 2 recharge sky, 3 growth gold.

| Slot | Copy |
| --- | --- |
| Section eyebrow | `How it works` |
| Section headline | `Habits are hard to build. Friends make them stick.` |
| Section subline (locked anchor, use once on the site) | `Strava made running social. We're doing it for the rest of habits.` |

**Step 1** (number `01`, mindfulness purple)
- Title: `Pick a quest with friends`
- Sentence: `Choose from 100+ curated challenges like 75 Hard, Dry January, and C25K, then invite the people you want beside you.`

**Step 2** (number `02`, recharge sky)
- Title: `Check in every day`
- Sentence: `One tap logs your day, and everyone in your quest sees it land on the leaderboard.`

**Step 3** (number `03`, growth gold)
- Title: `Earn streaks, Cards, and real rewards`
- Sentence: `Your streak grows, your Points add up, and you trade them for collectible Quest Cards and rewards in the marketplace.`

### 1.4 Inside the app

Two device rows, alternating left/right on desktop, stacked on mobile. Real screenshots, lazy loaded.

| Slot | Copy |
| --- | --- |
| Section eyebrow | `Inside the app` |
| Section headline | `Beautiful, humanist, and effective.` |

**Row 1** (mindfulness purple, roadmap screen, art on the left)
- Title: `Follow the path together`
- Bullet 1: `Every quest is a roadmap, and each check-in moves you one milestone further along it.`
- Bullet 2: `Your friends walk the same path, so you always see where everyone is.`
- Screenshot alt: `The Quests app showing a quest roadmap with a daily check-in card`

**Row 2** (growth gold, marketplace screen, art on the right)
- Title: `Turn streaks into rewards`
- Bullet 1: `Daily check-ins build your streak and stack up Points.`
- Bullet 2: `Spend Points in the marketplace on collectible Quest Cards and real rewards.`
- Screenshot alt: `The Quests app marketplace showing points, rewards, and the Quest Pass`

### 1.5 Science strip (the one stat)

On `--wash`, low-opacity pattern field behind it. Giant serif `76%`.

| Slot | Copy |
| --- | --- |
| Eyebrow | `Backed by science` |
| Stat (Instrument Serif, giant) | `76%` |
| Stat line | `of people reach their goal when a friend checks in on their progress every week.` |
| Supporting sentence | `That's more than double the odds of going it alone.` |
| Citation line (small Manrope, `--ink-2`) | `Source: Dominican University of California study on goal achievement and accountability.` |

Accessibility: wrap as one readable sentence for screen readers, `76% of people reach their goal when a friend checks in on their progress every week.` Keep the `%` inside the visual stat element.

### 1.6 Proof row (4.9 rating)

Five stars rendered as inline SVG, `aria-hidden="true"`, with the text below carrying the meaning.

| Slot | Copy |
| --- | --- |
| Rating headline | `4.9 stars on the App Store` |
| Trust line | `Questers show up for each other every day, and they keep telling us it works.` |
| Star group aria-label | `Rated 4.9 out of 5 on the App Store` |
| Device frame alt (if V2 screenshots pass curation) | `The Quests app showing a daily check-in with friends` |

If no V2 screenshots pass curation, omit the device frames and keep the rating headline plus trust line. Old dark V1 screenshots stay out.

### 1.7 Wordmark band (above footer)

Full-width `assets/img/wordmark-caps-ink.png`, container edge to edge, standard fade-up. No text beyond the alt.

| Slot | Copy |
| --- | --- |
| Image alt | `Quests` |
| Alternate, if the footer wordmark also names the brand directly below it | `alt=""` plus `aria-hidden="true"` (decorative, avoids the screen reader saying "Quests" twice in a row) |

Ship the decorative version when the footer brand mark sits within the same landmark. Otherwise use `alt="Quests"`.

### 1.8 Final CTA (on cream)

| Slot | Copy |
| --- | --- |
| Headline (Instrument Serif) | `Your friends are waiting.` |
| Subline (one sentence) | `Pick a challenge, invite your people, and start your streak today.` |
| Primary button, if a button is used alongside the badges | `Start your first Quest` |
| Store badges | Same alt and aria-label strings as 1.2 |

### 1.9 Footer

| Slot | Copy |
| --- | --- |
| Wordmark alt | `Quests` |
| Tagline under wordmark (locked anchor) | `The home of the healthy challenge.` |
| Link 1 | `Contact` |
| Link 2 | `Blog` |
| Link 3 | `Privacy` |
| Link 4 | `Terms` |
| Social label 1 | `Instagram` |
| Social label 2 | `TikTok` |
| Social label 3 | `X` |
| Social aria-labels | `Quests on Instagram`, `Quests on TikTok`, `Quests on X` |
| Copyright | `© 2026 Nothing Serious LLC` |
| Optional store line | `Download Quests on iOS and Android.` |

Social URLs, verbatim: `https://instagram.com/quests.app`, `https://tiktok.com/@quests.app`, `https://x.com/Quests_app_`. Contact email used on contact.html: `hello@thequestsapp.com`.

---

## 2. 404 page (404.html)

| Slot | Copy |
| --- | --- |
| Serif line (the one playful line) | `This quest doesn't exist yet.` |
| Supporting sentence | `The page you were after wandered off. Head home, or grab the app and start a real one.` |
| Primary button | `Download Quests` |
| Secondary ghost button | `Back to home` |

---

## 3. Page titles and meta descriptions

Rule for every page: `og:title` = the page title, `og:description` = the meta description, `twitter:title` and `twitter:description` mirror them. Exceptions are called out below. Titles use a pipe separator, never a dash.

### index.html
- **Title** (locked anchor, do not alter): `Quests: Habits with Friends`
- **Description:** `Quests turns healthy challenges into something you do with friends. Pick a quest, check in daily, build streaks together, and earn real rewards.`
- **og:title override:** `Quests: Habits with Friends` (same as title)
- **og:description override:** `You're better at building habits when you do it with people you care about. 100+ challenges, daily check-ins, streaks, and rewards.`

### blog.html
- **Title:** `Blog | Quests`
- **Description:** `Challenge guides, community stories, and what we learn about building habits with the people you care about.`

### contact.html
- **Title:** `Contact | Quests`
- **Description:** `Questions, feedback, or press for Quests? Email the team at Nothing Serious LLC and we'll get back to you.`

### privacy.html
- **Title:** `Privacy Policy | Quests`
- **Description:** `How Quests and Nothing Serious LLC collect, use, and protect your information, and the choices you have.`

### terms.html
- **Title:** `Terms of Service | Quests`
- **Description:** `The terms that apply when you use the Quests app and website, from Nothing Serious LLC.`

### 404.html
- **Title:** `Page not found | Quests`
- **Description:** `This page wandered off. Head back home, or download Quests and start a healthy challenge with friends.`
- Keep `<meta name="robots" content="noindex" />` on this page.

### success.html
- **Title:** `You're Quests Pro | Quests`
- **Description:** `Your Quests Pro subscription is active. We're sending you back to the app now.`
- Visible copy on the page stays as-is in meaning, restyled only: heading `You're Quests Pro`, line `Redirecting you back to the Quests app...`, fallback line `Didn't reopen automatically?`, buttons `Reopen Quests` and `Get the app from the App Store`, footer `© 2026 Nothing Serious LLC`.
- Add `<meta name="robots" content="noindex" />`.

### get-card.html
- **Title:** `Get your Quest Card | Quests`
- **Description:** `Add your Quest Card to Apple Wallet, then scan the code to download Quests and start a challenge with friends.`
- Visible copy: heading `Add your Quest Card to Apple Wallet`, button `Add to Apple Wallet`, secondary line `Scan the code to download the app`, QR alt `QR code that links to the Quests download page`.

### share.html
- **Title:** `Scan to download Quests`
- **Description:** `Scan the code to download Quests and start a healthy challenge with your friends.`
- Visible copy: heading `Scan to download`, sub line `Point your camera at the code to get Quests.`, QR alt `QR code that links to the Quests download page`.
- Add `<meta name="robots" content="noindex" />`.

### q/index.html (invite page)
**Hold for lead approval before applying.** PROJECT-FACTS protects the meta block on this page ("all meta/AASA-related tags must survive byte-for-byte"), and the invite renderer in `functions/` reads from this page. Reskin the markup and ship the existing head untouched unless Elliott clears the swap. Recommended copy if cleared:

- **Title:** `Join a Quest | Quests`
- **Description:** `A friend invited you to a Quest. Preview the challenge and join them in the app.`
- **og:title:** `You're invited to a Quest!` (unchanged, already correct)
- **og:description recommended replacement:** `Join your friend's quest on Quests, the home of the healthy challenge.` The current string says "social habit tracking app", which breaks the never-say-habit-tracker rule. Flag it, do not change it unilaterally.
- Never touch: `apple-itunes-app`, `robots`, `og:image`, `og:url`, `twitter:image`, every `<script>` block, the Supabase URL and key, the link-claims fetch.

---

## 4. Reusable strings and guardrails

**Locked anchors, exact wording, use each where noted:**
- `Quests: Habits with Friends` (homepage title)
- `the home of the healthy challenge` (footer tagline, sentence-cased there)
- `Strava made running social. We're doing it for the rest of habits.` (how-it-works subline)
- `You're better at building habits when you do it with people you care about.` (hero subhead)

**Deck language available for future sections:** `Habits are hard to build`, `Your friends' habits are contagious`, `grow better together`, `beautiful, humanist, and effective`.

**Button labels sitewide (buttons say what happens):** `Download`, `Download Quests`, `Download on the App Store`, `Get it on Google Play`, `Start your first Quest`, `Back to home`, `Add to Apple Wallet`, `Reopen Quests`.

**Banned in copy:** habit tracker, any dash character other than a hyphen inside a compound word, "not X, but Y" constructions, any second stat, exclamation stacking, emoji in body copy (the `✓` in the check-in pill is the single allowed glyph).
