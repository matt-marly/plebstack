# Moodboard: money, shared intent, explicit status

Ten real reference pages, checked **13 November 2026**. Every link below returned HTTP 200 with a nonempty HTML document, and was also opened in the web reader. Raw status, final URLs and byte counts are saved in [the verification record](moodboard-verification.json). Geyser and Phoenix return JavaScript application shells; their full interactions were not inspected here. Directions below are design takeaways to investigate, not claims that those products implement this protocol.

No assets were downloaded. Redistribution permissions for individual screenshots and site images were not established; retain these attributed links rather than hotlinking or bundling their images. The document needs no local image files.

| Reference | Verification | What to take; what not to copy |
| --- | --- | --- |
| [Cashu](https://cashu.space/) | 200, HTML | Take the separation of wallet, mint and protocol responsibilities as a cue for explaining who controls what. Do not copy broad privacy claims into a flow where the mint sees the batched quotes. |
| [cashu.me](https://cashu.me/) | 200, HTML | Take the concrete relationship between holding, sending and recovery as a checklist for money vocabulary. Do not borrow its native-wallet visual identity or seed-backup promises for this new web app. |
| [Bitcoin Design](https://bitcoin.design/) | 200, HTML | Take its units, accessibility, common flows and recovery topics as review disciplines. Do not turn a focused collective payout into a full daily-spending wallet. |
| [Geyser](https://geyser.fund/) | 200, JS shell | Use this collective-funding reference to investigate how a project explains its purpose and asks for support. Do not infer custody or authorization guarantees from a funding progress bar; visual interaction review is still pending. |
| [Open Collective](https://opencollective.com/) | 200, HTML | Take the explicit distinction between groups, organizations and money stewardship. Do not import its fiscal-host model: this organizer coordinates but holds no signing keys or treasury. |
| [GitHub Sponsors](https://github.com/sponsors) | 200, redirects to `/open-source/sponsors` | Take the connection between a named maintainer, public work and voluntary ongoing support as a patronage reference. Do not copy tier merchandising or recurring billing into the three-deposit MVP. |
| [Phoenix](https://phoenix.acinq.co/) | 200, JS shell | Keep this focused Lightning-wallet reference for later invoice and fee review. Do not borrow channel-management concepts or claim its interaction details were inspected from the delivered shell. |
| [GitHub Status](https://www.githubstatus.com/) | 200, HTML | Take timestamped incident language and a visible distinction between investigating and resolved. Do not let a green overall status stand in for verified issuance of a particular deposit. |
| [Cloudflare Status](https://www.cloudflarestatus.com/) | 200, HTML | Take the distinction between incidents, maintenance and time context for unresolved operations. Do not copy infrastructure-density tables or imply an outage means funds are gone. |
| [Minibits](https://minibits.cash/) | 200, HTML | Take the separation of wallet, mint and service information and the explicit test-mint caveat. Do not adopt its offline-payment emphasis, broad recovery promises or visual branding. |

The direction to review: a text-led shared funding record, explicit sat amounts, individual ownership rows and a three-line bracket that explains their common destination. Pending stays neutral; only mint-confirmed paid or reclaimed can use the success hue. Reference sites are precedents for specific questions, not a page template.
