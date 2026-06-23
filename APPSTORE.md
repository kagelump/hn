# App Store Connect — submission metadata

Copy/paste these into App Store Connect. URLs assume GitHub Pages is serving the
`site/` folder at `https://kagelump.github.io/hn/` (see `.github/workflows/pages.yml`).

---

## App information

- **Name:** HN Reader
- **Subtitle** (max 30 chars): `Fast, private HN reader`
- **Primary category:** News
- **Secondary category:** (optional) Productivity
- **Bundle ID:** `com.raycatdev.hn`

## URLs

- **Marketing URL:** https://kagelump.github.io/hn/
- **Support URL:** https://kagelump.github.io/hn/support/
- **Privacy Policy URL:** https://kagelump.github.io/hn/privacy/

## Promotional text (max 170 chars)

> A fast, private way to read Hacker News. Clean reader mode, properly ordered
> comment threads, and full control over themes — no ads, no tracking, no account.

## Keywords (max 100 chars, comma-separated, no spaces after commas)

```
hacker news,hn,tech news,startups,ycombinator,reader,comments,programming,developer,news
```

## Description (max 4000 chars)

```
HN Reader is a fast, private, ad-free way to read Hacker News on your iPhone.

Browse the front page, dive into discussions, and read the linked articles in a
clean reader mode that strips away clutter — all in a lightweight native app.

FEATURES
• Front page, plus Ask HN, Show HN, New, and Jobs
• Reader mode that extracts the article text for distraction-free reading
• Comment threads shown in the correct Hacker News order, with collapsible replies
• Block any author with a tap — their stories are hidden and comments read “[blocked]”
• Light and dark themes, custom fonts, adjustable text size, and a pickable accent color
• Offline caching of recently loaded stories
• No account, no analytics, no tracking — your settings stay on your device

HN Reader is an independent client. It is not affiliated with or endorsed by
Y Combinator or Hacker News, and displays content from the official public
Hacker News APIs.
```

## Privacy ("App Privacy" section / nutrition label)

- **Data collection:** None. Select "Data Not Collected."
- This matches `ios/App/App/PrivacyInfo.xcprivacy` (NSPrivacyTracking = false, no
  collected data types).

## Age rating

Hacker News is user-generated content on a moderated platform. Answer the
questionnaire honestly — expect a **17+** rating (set "Unrestricted Web Access"
and "Infrequent/Mild" for user-generated content categories as appropriate).

---

## App Review Notes (paste into the "Notes" field) — IMPORTANT for Guideline 1.2

```
HN Reader is a strictly read-only client for Hacker News
(news.ycombinator.com), a well-established and actively moderated public
tech-news discussion site. The app displays content via the official public
Hacker News APIs. Users cannot post, comment, vote, or sign in from the app —
there is no mechanism to create user-generated content within HN Reader.

Moderation of the content itself is handled upstream by Hacker News, which has
human moderators and published community guidelines
(https://news.ycombinator.com/newsguidelines.html). Because the app is read-only
and the source platform is moderated, there is no user-generated content
originating in the app to moderate.

In addition, HN Reader gives each user a personal blocking control:

- BLOCK an author: Tap any author's name on a story or comment and choose
  "Block this user." That author's stories are hidden from the list and their
  comments are replaced with a "[blocked]" placeholder. Blocks persist and are
  managed/removable under Settings > Blocked Users.

Contact info and content policy are published in-app (Settings > About) and at
https://kagelump.github.io/hn/support/.

To test blocking: open any comment thread, tap a commenter's name, choose
"Block this user," and observe that comment change to "[blocked]".

No account or demo credentials are required.
```

---

## Pre-upload checklist

- [ ] `npm run build && npx cap sync ios`
- [ ] In Xcode: scheme target = **Any iOS Device (arm64)**
- [ ] Bump `CURRENT_PROJECT_VERSION` if re-uploading the same `MARKETING_VERSION`
- [ ] Product ▸ Archive ▸ Distribute App ▸ App Store Connect
- [ ] iPhone screenshots: 6.9" (required) and 6.5"/6.7"; no iPad needed (iPhone-only)
- [ ] Confirm GitHub Pages is enabled (Settings ▸ Pages ▸ Source: GitHub Actions)
