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
• Block any author and report objectionable content with a tap
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

Hacker News is unfiltered user-generated content. Answer the questionnaire
honestly — expect a **17+** rating (set "Unrestricted Web Access" and
"Infrequent/Mild" for user-generated content categories as appropriate). Do not
claim the content is moderated by us; it is not.

---

## App Review Notes (paste into the "Notes" field) — IMPORTANT for Guideline 1.2

```
HN Reader is a read-only client for Hacker News (news.ycombinator.com), a public
tech-news discussion site. The app displays content via the official public
Hacker News APIs. Users cannot post, comment, vote, or sign in — the app is
strictly read-only.

Although the app does not host or generate user content, we have implemented the
full set of UGC safeguards from Guideline 1.2:

1. FILTER/BLOCK abusive users: Tap any author's name on a story or comment and
   choose "Block this user." That author's stories and comments — and all replies
   beneath them — are hidden immediately and persistently. Blocks are managed and
   removable under Settings > Blocked Users.

2. REPORT objectionable content: Tap any author's name and choose "Report." This
   composes an email to the maintainer with a direct link to the reported content.

3. ACTING ON REPORTS: Reports go to raycatdev@hinoka.org. We review them and act
   within 24 hours (e.g. filtering an author from the app's default experience).
   Our content policy is published at https://kagelump.github.io/hn/support/.

4. CONTACT INFO is published in-app (Settings > About) and on the support site.

To test blocking: open any comment thread, tap a commenter's name, choose
"Block this user," and observe the comment and its replies disappear.

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
