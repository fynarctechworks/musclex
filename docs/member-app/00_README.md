# Member App — UX & Design Foundation

This folder holds the **design/UX foundation** for the gym member app. It sits *on top of*
the product/technical specs already in `docs/`:

| Already exists (don't duplicate) | This folder adds |
|---|---|
| `docs/PRD_Member_App.md` — vision, personas, phased roadmap, MoSCoW features, NFRs, navigation | UX research plan, IA, design system, user flows, screen inventory |
| `docs/TRD_Member_App.md` — BFF architecture, tenant isolation, auth | (technical reference only) |
| `docs/Phase1_Build_Checklist.md` — build steps | (build reference only) |
| `docs/Member api v1.openapi.yaml` — API contract | (contract reference only) |

## Read in this order

1. **[01_UX_Research_Plan.md](01_UX_Research_Plan.md)** — what to learn before designing more screens, and how.
2. **[02_Information_Architecture.md](02_Information_Architecture.md)** — the app's structure, navigation model, and screen map.
3. **[03_Design_System.md](03_Design_System.md)** — the documented design language (grounded in the real tokens already in code).
4. **[04_User_Flows.md](04_User_Flows.md)** — the critical journeys, step by step.
5. **[05_Screen_Inventory.md](05_Screen_Inventory.md)** — every screen, its state, data source, and wireframe-level layout.

## The one rule that overrides this whole folder

From the PRD, kept verbatim because it is the most important design constraint:

> Members do **not** want complex dashboards, typing, confusing flows, slow loading, or clutter.
> They want **fast actions, motivation, visible progress, easy booking, habit tracking, light
> gamification, and personalization.**

Every design decision in this folder is judged against that. The moat is **gym-connected data
+ speed + visible progress** — not feature count.

## Status of the underlying build (as of 2026-06-01)

So design ambitions stay tethered to reality:

- ✅ Built: auth, QR check-in, workout domain + logging, progress metrics (BFF + RN scaffold).
- 🟡 Partial / shows empty: home dashboard (some null widgets), workout display (no admin authoring yet), progress photos (no storage signing).
- 🔴 Not started: nutrition, class booking, community, wearables, AI coach.
- ⛔ Blocked: real billing (Razorpay `createOrder` is a stub); BFF not yet committed.

Design Phases 2–3 features fully, but **sequence the build behind these realities.**
