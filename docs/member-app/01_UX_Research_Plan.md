# UX Research Plan — Member App

> Goal of this doc: define **what we must learn from real gym users before building more screens**,
> and the cheapest way to learn it. Research is not a phase you skip to "move fast" — for a habit
> app, shipping the wrong loop *is* the slow path.

Companion: personas live in `docs/PRD_Member_App.md §3`. This plan operationalizes learning about them.

---

## 0. Research principles

- **Talk to users of YOUR gyms**, not generic fitness-app users. Your moat is gym-connection; research it.
- **Watch behavior > collect opinions.** "Would you use X?" lies. "Show me how you checked in last time" tells the truth.
- **Small N, fast loops.** 5–7 users per persona surfaces ~80% of usability problems. Don't wait for 100 surveys.
- **Decide before you research.** Each study below names the *decision it unblocks*. No decision = don't run it.

---

## 1. Key research questions (mapped to decisions)

| # | Question | Decision it unblocks |
|---|---|---|
| Q1 | What is the real friction at check-in today (card, queue, app)? | Is QR enough for Phase 1, or do we need NFC/BLE sooner? |
| Q2 | After joining, what makes a beginner (Ravi) come back vs. ghost? | Onboarding flow + week-1 nudge strategy |
| Q3 | How do regulars (Sneha) and lifters (Arjun) log workouts today (paper, notes app, memory)? | Workout-logging UX: one-thumb model, how much we auto-fill |
| Q4 | What progress signal actually motivates each persona (weight? photos? streak? PRs)? | Which progress widget leads the Home dashboard |
| Q5 | What makes someone renew vs. let membership lapse? | Membership/renewal UX + reminder timing |
| Q6 | For women members (Divya), what privacy/safety needs gate class booking? | Class booking UX (women-only slots, visibility of who's attending) |
| Q7 | Where do trainers (Kiran) actually assign plans — and will they keep data fresh? | Whether workout authoring lives in SaaS admin, a trainer mode, or both |
| Q8 | What kills trust/retention (slow load, wrong data, notification spam)? | Performance budget + notification frequency policy |

---

## 2. Methods & cadence

### Phase A — Discovery (before more UI) — ~1.5 weeks
| Study | Method | Who | N | Output |
|---|---|---|---|---|
| **In-gym contextual inquiry** | Observe + interview at the gym during peak hours | Beginners, regulars, lifters, women members | 8–10 | Check-in friction map (Q1), logging behavior (Q3) |
| **Trainer/owner interviews** | 45-min remote/in-person | Trainers + 1–2 owners | 3–4 | Authoring reality (Q7), data-freshness risk |
| **Churn interviews** | Talk to members who *stopped* coming | Lapsed members | 4–5 | Why people ghost (Q2, Q5) — the highest-value, most-skipped study |

### Phase B — Concept/usability testing (during design) — continuous
| Study | Method | Cadence |
|---|---|---|
| **Prototype usability tests** | Moderated, task-based on Figma/clickable prototype | 5 users/round, every design iteration |
| **First-time-user (FTUX) test** | Hand someone the onboarding cold, watch silently | Each onboarding revision |
| **Check-in field test** | Real QR check-in at a partner gym | Before Phase-1 launch |

### Phase C — Post-launch (continuous) — quantitative + qualitative
| Signal | Source | Watch for |
|---|---|---|
| Activation (first check-in within 48h of signup) | Analytics (PRD §9) | The single best leading indicator of D30 |
| D1 / D7 / D30 retention cohorts | Analytics | Where the leak is |
| Funnel drop-off (signup→OTP→choose-gym→home→first action) | Analytics | Onboarding friction |
| In-app micro-survey (1 question, contextual) | In-app | "What were you trying to do?" on rage-quit / back-out |

---

## 3. Recruiting & logistics

- **Where:** partner with 1–2 of your existing gyms (you already have the relationships — unfair advantage). Recruit at the front desk.
- **Incentive:** 1 month free / merch / supplement sample. Cheap relative to the cost of building the wrong thing.
- **Consent:** record only with permission; this touches health data → align with DPDP (see TRD/NFRs). Never store research recordings with production member data.
- **Diversity:** deliberately include women members, beginners, and *lapsed* members — the personas most often under-researched and most predictive of churn.

---

## 4. Synthesis & artifacts produced by research

Each round produces:
1. **Top findings** (ranked by frequency × severity).
2. **Journey friction updates** → feeds `04_User_Flows.md`.
3. **IA/navigation validations** → feeds `02_Information_Architecture.md` (esp. card-sort for Home widget order).
4. **Jobs-to-be-done statements** per persona → sharpen PRD §4.

---

## 5. What we are explicitly NOT researching yet

- Generic step-counter / calorie-app preferences (Phase 3 concern; don't dilute focus).
- Aesthetic A/B on colors — the design language is decided (`03_Design_System.md`); test *flows and comprehension*, not hue preference.
- Wearable nuances — defer until Phase 2/3 scope is confirmed.

---

## 6. Definition of "research-ready to build Phase 1"

You may proceed to high-fidelity Phase-1 build when:
- [ ] Check-in friction (Q1) is mapped and QR-vs-advanced decision is made.
- [ ] FTUX test passes: a new member completes signup → first check-in unaided in < 3 min.
- [ ] Home dashboard widget order is validated by a card-sort with ≥ 2 personas.
- [ ] Churn interviews (Q2/Q5) have produced at least 3 concrete retention levers.
