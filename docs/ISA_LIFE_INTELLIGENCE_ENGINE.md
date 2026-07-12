# ISA — Life Intelligence Engine (LIE)

> **Status:** Official · Permanent · Foundational
> **Document type:** System architecture — the conceptual brain of ISA.
> **Companion to:** [`ISA_CORE_PHILOSOPHY.md`](./ISA_CORE_PHILOSOPHY.md). Where philosophy states *what ISA believes*, this document states *how ISA thinks*.
> **Scope note:** This is architecture at the level of concepts, contracts, and data-flow — deliberately independent of any framework, database, or model. It is durable across a decade of implementation changes.
> **Reading rule:** The Engine is not an AI model and not a chatbot. It is the **layer that connects every module into one understanding of one life.** The model (if/when present) is only one *consumer* of the Engine.

---

## 1. First principles — why the Engine exists

### The core claim
> **A person's life is a single connected system. Software that stores each domain separately can never understand the person. The Life Intelligence Engine is the layer that makes ISA aware of the whole life at once.**

Every module in ISA (money, habits, focus, prayer, goals…) is an *organ*. Organs are useful. But a pile of organs is not an organism. The Engine is the **nervous system** — the thing that lets a signal in one organ change behavior in another, and lets the whole body know how it is doing.

### Why it is necessary (not optional)
Without the Engine, ISA is "six good apps in one login" — better than the competition, but still fundamentally a **collection of tools**. The differentiator, the moat, and the entire long-term thesis of ISA all live in the *relationships between domains*:

- The value of knowing you slept badly is small.
- The value of knowing you slept badly **and therefore** today's focus target should drop, your habit expectations should soften, and your late-night spending pattern is likely to recur — that value is enormous, and it is impossible without a connecting layer.

The Engine exists so ISA can answer the questions no single module can:
- *How is my life actually going?* (synthesis across domains)
- *Why do my good periods happen?* (cross-domain pattern detection)
- *What's about to go wrong?* (prediction from connected signals)
- *What should I do next, given everything about me?* (recommendation grounded in the whole person)

### First-principles definition
The Engine is a **deterministic, transparent, event-driven understanding of one human's life over time**, composed of:
1. an **Identity Layer** (who the person wants to become — the apex and deepest constraint),
2. a stream of **Life Events** (meaningful actions, normalized),
3. layered **Context** (the same events viewed at different time-scales and abstraction levels),
4. durable **Memory** (what ISA carries forward vs. lets fade),
5. a **Life Timeline** (the connected long-term record),
6. a **Pipeline** that turns raw actions into reflection, insight, recommendation, and prediction,
7. and a **Decision Engine** that arbitrates which of the many things ISA *could* say actually reaches the user.

Intelligence (rule-based today, model-augmented later) is applied **on top of** these structures — never in place of them. The structures are the brain's anatomy; models are one kind of thought.

---

## 2. Responsibilities of the Engine

### What the Engine MUST do
1. **Hold the Identity** — maintain the user's declared aspirational self (who they want to become) and measure every insight and recommendation against it.
2. **Capture** every meaningful user action as a normalized Life Event.
3. **Connect** events across modules into one coherent picture of the person.
4. **Maintain context** at every relevant time-scale (now → lifetime).
5. **Arbitrate attention** — via the Decision Engine, decide what (if anything) is worth surfacing, so intelligence never becomes noise.
6. **Detect patterns** honestly — real, repeated, statistically meaningful ones.
7. **Remember** what matters and **let go** of what doesn't, deliberately.
8. **Surface understanding** — reflection, insight, recommendation, prediction — with reasoning attached.
9. **Preserve provenance** — every insight must be traceable to the events that produced it.
10. **Respect timing** — hold intelligence until the moment it is useful; stay silent otherwise.
11. **Stay explainable** — no black boxes; the "because" is always reconstructable.
12. **Guard the user's agency** — output proposals, never commands or autonomous actions.

### What the Engine MUST NEVER do
1. **Never fabricate** patterns, insights, or certainty from noise or thin data.
2. **Never act autonomously** on the user's life (move money, message people, delete records).
3. **Never optimize the person as a machine** (output over well-being).
4. **Never manipulate** via urgency, guilt, gamification, or fear.
5. **Never leak, sell, or repurpose** the user's life data.
6. **Never hide reasoning** or present a conclusion it cannot justify.
7. **Never speak when silence serves the user better.**
8. **Never let one module's logic secretly corrupt another's** — connections are explicit, inspectable, and bounded.
9. **Never treat missing data as bad data** — absence is information, not failure.
10. **Never assume** it understands the person more than it truly does; it earns understanding over time and says so.

---

## 3. Engine Architecture (conceptual)

The Engine is a **layered brain**. Data flows upward from raw action to understanding; guidance flows back down to the surfaces the user sees. Each layer has a single responsibility and a clean contract with the layers above and below it.

```mermaid
flowchart TB
    subgraph Surfaces["SURFACES (what the user sees)"]
        DASH[Dashboard] & MODS[Module screens] & NUDGE[Notifications & timed guidance] & REVIEW[Reviews: day / week / month / year]
    end

    subgraph L8["Layer 8 — DECISION ENGINE"]
        DEC[Arbitration: of everything generated, what earns the user's attention now?]
    end

    subgraph L7["Layer 7 — GENERATION: REFLECTION & COUNSEL"]
        REF[Reflection: honest mirrors]
        REC[Recommendations: proposals + reasoning]
        PRED[Predictions: foresight]
    end

    subgraph L6["Layer 6 — INSIGHT"]
        INS[Insights: meaning from patterns]
    end

    subgraph L5["Layer 5 — PATTERN DETECTION"]
        PAT[Patterns: real, repeated, cross-domain]
    end

    subgraph L4["Layer 4 — CONTEXT (incl. IDENTITY)"]
        IDN[["IDENTITY LAYER: who I want to become"]]
        CTX[Context layers: now → lifetime]
    end

    subgraph L3["Layer 3 — MEMORY & TIMELINE"]
        MEM[User Memory]
        TL[Life Timeline]
    end

    subgraph L2["Layer 2 — EVENT SYSTEM"]
        EVT[Life Events: normalized, provenance-kept]
    end

    subgraph L1["Layer 1 — CAPTURE"]
        CAP[Module actions → raw signals]
    end

    subgraph Constraints["ALWAYS-ON CONSTRAINTS"]
        ID2[Identity & Values]
        PRIV[Privacy & Ownership]
        HON[Honesty & Provenance]
        CALM[Calm & Timing]
    end

    CAP --> EVT --> MEM & TL --> CTX --> PAT --> INS --> REF & REC & PRED --> DEC
    IDN --> CTX
    DEC --> Surfaces
    Constraints -.governs.- L1 & L2 & L3 & L4 & L5 & L6 & L7 & L8
```

**Layer responsibilities (contracts):**

| Layer | Responsibility | Input | Output |
|---|---|---|---|
| 1 · Capture | Turn a module action into a raw signal | User action | Raw signal |
| 2 · Event System | Normalize signals into typed Life Events with metadata & provenance | Raw signals | Life Events |
| 3 · Memory & Timeline | Persist what matters; connect events across time | Life Events | Durable memory + timeline |
| 4 · Context (incl. **Identity**) | View events at each time-scale & abstraction level; hold *who the person wants to become* | Events + memory + declared identity | Context layers + Identity model |
| 5 · Patterns | Find real, repeated, cross-domain regularities | Context | Patterns |
| 6 · Insight | Attach meaning ("what this means") | Patterns | Insights |
| 7 · Generation | Mirror the past, propose the next step, foresee the future | Insights + context + identity | Candidate reflections, proposals, forecasts |
| **8 · Decision Engine** | **Arbitrate: of everything generated, decide what (if anything) surfaces now, and in what priority** | Candidates + attention budget + identity + feedback | The one/few things the user actually sees |
| Constraints | Govern every layer: **identity/values**, privacy, honesty, calm/timing | — | Guardrails |

The **Constraints band** is not a layer that runs once; it is a set of laws every layer obeys at all times. An insight that violates honesty is discarded at Layer 6. A recommendation that violates the user's **identity or values** is discarded at Layer 7. A perfectly true, well-aligned recommendation that isn't the *most important thing to say today* is held back by **Layer 8, the Decision Engine.** Truth earns a candidate; alignment keeps it; the Decision Engine decides whether it is worth the user's scarce attention *right now.*

> **Two structural additions make ISA wise rather than merely reactive:**
> - The **Identity Layer** (inside Layer 4) means ISA reasons about *who you are trying to become*, not just what you did. It is the highest-priority context and the deepest constraint.
> - The **Decision Engine** (Layer 8) means ISA can generate a hundred true things and still say only the one that matters — the operational enforcement of "silence is the default."

---

## 4. Module contributions to the Engine

Every module is a **producer of Life Events and context** and a **consumer of intelligence.** Three modules are special and stated honestly:

- **Dashboard** is not a life domain — it is a **primary surface**: it reads the Engine and shows synthesis. It produces almost no events (only "user reviewed X"); it consumes nearly everything.
- **AI** is not a domain — it is the **expression of the Engine** (Layers 5–7). It produces meta-events ("insight shown," "recommendation accepted/dismissed") that feed back as learning signal.
- **Settings** is not a domain — it is where the user declares **values, constraints, and preferences** that become the always-on governing inputs (the Constraints band).

For each true life domain: *what it produces · life events it creates · context it stores · which modules react · future AI capabilities it unlocks.*

### Tasks (to-dos)
- **Produces:** intent, workload, follow-through, procrastination signals, daily load vs. completion.
- **Life events:** `TaskCreated`, `TaskCompleted`, `TaskDeferred`, `TaskDeleted`, `DayCleared` (all today's tasks done).
- **Context stored:** typical daily load, completion rate by day-of-week/energy, chronic deferrals, task→goal links.
- **Modules that react:** Dashboard (today's picture), Goals (task→goal progress), Focus (what to focus on), Calendar (scheduling load), AI (overload/procrastination detection).
- **Future AI:** realistic daily-load recommendations, procrastination prediction, "these three tasks keep slipping — schedule or drop them," auto-linking tasks to goals.

### Notes (Ideas)
- **Produces:** raw thought, ideas, interests, unstructured signal about what's on the person's mind.
- **Life events:** `NoteCaptured`, `NoteTagged`, `NoteRevisited`, `NotePromoted` (idea → goal/task/project).
- **Context stored:** recurring themes/interests, ideas that never became anything, topics that correlate with high-energy periods.
- **Modules that react:** Goals/Projects (promotion), AI (theme detection), Journal (thematic overlap).
- **Future AI:** "you keep noting X — want to make it a goal?", surfacing a forgotten relevant idea at the right moment, connecting ideas across years.

### Money
- **Produces:** income, spending, category behavior, savings velocity, financial pressure, goal fundability.
- **Life events:** `ExpenseAdded`, `IncomeReceived`, `SpendingSpike`, `SavingsGoalFunded`, `RecurringPaymentDue/Paid`, `BudgetBreached`.
- **Context stored:** category baselines, monthly cash-flow shape, spending↔mood/stress correlations, goal ETAs, recurring obligations.
- **Modules that react:** Goals (fundability & ETA), Dashboard (financial health), Journal (why a spike happened), AI (financial foresight), Calendar (paydays/obligations).
- **Future AI:** cash-flow prediction, "at this pace you'll miss your target by 3 weeks," stress-spending early warning, "reduce X to fund goal Y."

### Goals
- **Produces:** direction, ambition, long-term intent, the "what am I climbing toward" signal.
- **Life events:** `GoalCreated`, `GoalProgressed`, `GoalStalled`, `GoalCompleted`, `GoalAbandoned`, `DeadlineApproaching`.
- **Context stored:** active directions, pace vs. deadline, which life domains each goal depends on, momentum history.
- **Modules that react:** Tasks (goals generate work), Money (goals need funding), Focus (goals justify deep work), Dashboard (the Ascent), AI (trajectory & drift detection).
- **Future AI:** trajectory prediction, "this goal has stalled 3 weeks — revive, reshape, or release?", allocating the day's effort toward the most at-risk important goal.

### Calendar
- **Produces:** time structure, commitments, availability, the shape of the day/week.
- **Life events:** `EventCreated`, `EventStarting`, `DayBusy/Light`, `FreeBlockAvailable`.
- **Context stored:** recurring rhythms, busy vs. free patterns, when focus is realistically possible, collision with energy troughs.
- **Modules that react:** Focus (when to schedule deep work), Tasks (when work fits), Prayer (time-boundedness), AI (realistic planning).
- **Future AI:** "your only free block today is 4–5pm — protect it for your most important task," predicting over-committed days, guarding rest.

### Habits
- **Produces:** consistency, identity-level behavior, the slow-compounding signal, fragility of routines.
- **Life events:** `HabitCompleted`, `HabitMissed`, `StreakExtended`, `StreakBroken`, `HabitFragile` (pattern of near-misses).
- **Context stored:** per-habit reliability, day/context conditions for success/failure, habit↔energy/sleep correlations, identity themes.
- **Modules that react:** Dashboard (momentum), Energy/Focus (habits shape capacity), AI (fragility & relapse prediction), Journal (why a habit slipped).
- **Future AI:** relapse prediction ("you miss Reading on high-workload days — want a lighter version those days?"), habit-stacking suggestions grounded in real success conditions.

### Prayer
- **Produces:** spiritual practice, values-adherence, daily rhythm anchored in faith, a non-negotiable structure of the day.
- **Life events:** `PrayerCompleted` (on time / late), `PrayerMissed`, `PrayerWindowOpen`, `DayOfPrayerComplete`.
- **Context stored:** on-time vs. late patterns, which prayers slip and under what conditions, spiritual consistency over time, the day's anchor times.
- **Modules that react:** Calendar/Focus (day structure around prayer times), Dashboard (whole-person picture), AI (respecting values as a hard constraint), Habits (consistency family).
- **Future AI:** protecting prayer windows when scheduling, gentle values-aligned reflection, recognizing that a values anchor holding is a sign of a stable life period. *Faith is treated as a first-class, respected dimension — never optimized away.*

### Focus (deep work)
- **Produces:** attention, cognitive output, energy expenditure, the "real work happened" signal.
- **Life events:** `FocusStarted`, `FocusCompleted`, `FocusAbandoned`, `DeepWorkStreak`.
- **Context stored:** best focus times of day, sustainable session lengths, focus↔sleep/energy correlation, what focus tends to serve (which goals).
- **Modules that react:** Goals (focus advances them), Energy (focus draws on it), Calendar (scheduling), Dashboard (weekly focus), AI (capacity modeling).
- **Future AI:** "your focus is best 9–11am and collapses after a poor night — front-load deep work," predicting a low-focus day and adjusting the plan.

### Energy / Sleep / Mood (the well-being domain)
- **Produces:** capacity, recovery, emotional state — the substrate everything else runs on.
- **Life events:** `SleepLogged`, `EnergyScored`, `MoodLogged`, `LowEnergyDay`, `RecoveryDay`.
- **Context stored:** sleep/energy baselines & consistency, mood trends, the causal spine linking rest → capacity → output → spending/habits.
- **Modules that react:** *Everything.* Energy is the multiplier on Tasks, Focus, Habits, Money-discipline, and Goals.
- **Future AI:** "you're running a sleep deficit — today, do less and protect recovery," predicting burnout, explaining a bad week through its energy root cause.

### Journal
- **Produces:** meaning, narrative, the *why* behind the numbers — the qualitative layer.
- **Life events:** `JournalWritten`, `MoodRecorded`, `ReflectionThemeDetected`.
- **Context stored:** emotional themes, self-reported causes, the story that explains cross-domain data, what the person says they care about.
- **Modules that react:** AI (grounds recommendations in the person's own words), Dashboard (context for the numbers), Goals/Money (the "why" behind spikes and stalls).
- **Future AI:** connecting a journaled feeling to its data signature ("the week you wrote about feeling stretched was also your worst sleep + highest spend"), values extraction, long-term narrative reflection.

### Running / Health (extensible physical domain)
- **Produces:** physical activity, another well-being input, discipline evidence.
- **Life events:** `RunLogged/Synced`, `ActivityStreak`, `InactivityGap`.
- **Context stored:** activity baselines, activity↔energy/mood correlation.
- **Modules that react:** Energy/Mood, Habits, Dashboard, AI.
- **Future AI:** activity↔energy causal insight, gentle movement recommendations tied to mood dips.

### Meta modules (stated honestly)
| "Module" | True role | Contribution to the Engine |
|---|---|---|
| **Dashboard** | Primary read surface | Consumes synthesis; emits only `Reviewed*` meta-events. |
| **AI** | The Engine's Layers 5–7 made visible | Emits `InsightShown`, `RecommendationAccepted/Dismissed`, `PredictionMade` — the learning-signal loop. |
| **Settings** | Declaration of values & constraints | Feeds the always-on Constraints band (values, quiet hours, priorities, tier). |

### Future modules (extensibility contract)
Any future module (relationships, learning/study, work/career, health-vitals, projects-at-scale) **must** on arrival declare the same five things: *what it produces · its life events · the context it stores · which modules react · which AI capabilities it unlocks.* A module that cannot fill this contract does not belong in ISA — it would be a silo, and silos are forbidden by the philosophy.

---

## 5. The Event System

Everything the Engine knows begins as a **Life Event**: a normalized, timestamped, provenance-bearing record of a meaningful action or state-change. Events are the **single source of truth** the higher layers reason over.

### 5.1 Design rules for events
1. **Normalized:** every event, regardless of module, shares one shape so cross-module reasoning is possible.
2. **Immutable & append-only:** events record what happened; they are not edited. Corrections are new events. This preserves an honest history.
3. **Provenance-bearing:** every event knows its origin module and the raw action behind it — so any insight can be traced back.
4. **Semantically typed:** the *type* carries meaning (`HabitMissed`, not "row updated"), because the Engine reasons in life-terms, not database-terms.
5. **Absence-aware:** the *lack* of an expected event (no journal today, no prayer logged) is itself a signal the Engine can reason about.

### 5.2 Event anatomy (metadata contract)
| Field | Meaning | Example |
|---|---|---|
| **Type** | The life-meaning of the event | `ExpenseAdded`, `GoalCompleted`, `PrayerMissed` |
| **Domain** | Producing module | Money, Goals, Prayer |
| **Timestamp** | When it happened (user-local) | 2026-07-12 21:14 (+05) |
| **Actor** | Who caused it | user / system / recurring-job |
| **Payload** | Domain-specific facts | amount, category, prayer name, goal id |
| **Magnitude** | How big/notable relative to the user's own baseline | "1.3× your Food average" |
| **Valence** | Direction relative to the person's goals/values | positive / neutral / negative / ambiguous |
| **Links** | Related entities across modules | expense → goal it drains; task → goal it serves |
| **Importance** | Weight for attention & memory (see §5.3) | trivial → pivotal |
| **Provenance** | Raw source, for explainability | "manual entry" / "Strava sync" |

### 5.3 Event importance (attention & memory weight)
Not all events deserve equal attention or permanence. Importance is judged **relative to the individual**, never absolutely.

| Tier | Definition | Attention | Memory horizon |
|---|---|---|---|
| **Trivial** | Routine, expected, in-baseline | none | short (fades into aggregates) |
| **Notable** | Mild deviation from the person's norm | maybe, in aggregate | medium (weeks) |
| **Significant** | Clear deviation or meaningful milestone | eligible to surface | long (months) |
| **Pivotal** | Life-shaping (goal finished, streak of a long habit broke, major income change) | surfaced & remembered | permanent (Life Timeline) |

Importance is **dynamic**: a single missed prayer is Trivial; a *pattern* of missed prayers becomes Significant; the same event's importance rises when it participates in a cross-domain pattern.

### 5.4 Event relationships
Events are not a flat log; they form a **graph**:
- **Causal links:** poor `SleepLogged` → likely `FocusAbandoned` → `TaskDeferred`.
- **Serving links:** `TaskCompleted` → advances `GoalProgressed`; `ExpenseAdded` → drains `SavingsGoal` fundability.
- **Explanatory links:** `SpendingSpike` ↔ `JournalWritten` ("stressful week") ↔ `LowEnergyDay`.
- **Temporal links:** events chain into days, weeks, seasons on the Life Timeline.

```mermaid
flowchart LR
    S[SleepLogged: 4h] -->|lowers capacity| E[EnergyScored: low]
    E -->|predicts| FA[FocusAbandoned]
    FA -->|causes| TD[TaskDeferred]
    E -->|correlates| SS[SpendingSpike: late-night]
    J[JournalWritten: 'overwhelmed'] -.explains.-> SS
    J -.explains.-> FA
    TD -->|slows| G[GoalStalled]
```

This graph — not any single event — is what lets ISA say something no module could: *"Your goal stalled this week because a bad night cascaded into skipped focus and stress-spending — and you felt it, you wrote 'overwhelmed.'"*

---

## 6. The Identity Layer & Context Layers

Context has two faces. Most of it is **descriptive** — perspectives on what *is* and what *happened*. But the most important context is **normative** — *who the person is trying to become.* That normative apex is the **Identity Layer**, and it changes everything downstream.

### 6.1 The Identity Layer (the apex — the most important layer)

> **Events tell ISA what you did. The Identity Layer tells ISA who you are doing it *for*.** Without it, ISA can only optimize toward your stated tasks. With it, ISA can align every recommendation to the person you are trying to become.

The Identity Layer holds the **aspirational self**, mostly *declared* by the user (in Settings/onboarding and refined over time), not merely inferred:

| Component | What it captures | Example |
|---|---|---|
| **Who I want to become** | Aspirational identities the person is growing into | "a healthy father," "a disciplined builder," "a person of my word" |
| **Core values** | The non-negotiables that bound every decision | faith, honesty, family, health, generosity |
| **Principles** | Personal rules the person chooses to live by | "sleep before midnight," "no debt," "pray on time," "ship every week" |
| **Long-term identity** | The stable self-concept beneath goals | "I am a learner," "I am someone who finishes" |
| **Personal mission** | The single sentence a life is organized around | "raise a strong family and build things that outlast me" |

**Two selves, kept distinct on purpose:**
- **Life Context** = the *descriptive* self — "who I am, based on my data." (What the events reveal.)
- **Identity Layer** = the *aspirational* self — "who I want to become." (What the person declares and commits to.)

The gap between them is the single most useful thing ISA can reason about. *"Your data says X; your identity says you want Y; here is where they diverged this week, and here is the one move that closes the gap."*

**How the Identity Layer governs the Engine:**
1. **It is the deepest constraint.** A recommendation that advances a goal but contradicts an identity or value is **rejected**, even if it is otherwise optimal. Identity outranks optimization.
2. **It is the highest-priority context** fed into every recommendation and into the Decision Engine (§12): the thing most aligned to *who you're becoming* wins the user's attention.
3. **It reframes advice from tactics to meaning.** Not "you overspent 200,000" but *"This purchase pulls against your 'no-debt, disciplined builder' identity — is it worth it?"*
4. **It makes reflection identity-aware.** Weekly/yearly reviews are measured against *who the person said they wanted to be*, not against generic productivity.

**Worked example of the difference it makes:**
> A late-night food-delivery habit. **Without Identity:** "You spend more on Food on weekends." (True, mild, ignorable.) **With Identity ('healthy father'):** *"This weekend pattern pulls against the 'healthy father' you said you want to become — it's the one place your habits and your identity disagree. Want a lighter default for weekends?"* Same data. Entirely different weight, because it now speaks to who the person is trying to be.

**Rules for the Identity Layer:**
- **Declared first, inferred cautiously.** Identity is primarily the user's stated commitment; ISA may *propose* an inferred identity ("you consistently act like someone who values learning — is that who you're becoming?") but never *impose* one.
- **Slow to change.** Identity shifts only on strong, repeated, or explicitly-declared evidence — it is the most permanent thing in User Memory (§7).
- **Never used to shame.** The identity–behavior gap is shown as *direction*, never as judgment. "Here's the gap and the next step," never "you failed to be who you wanted."
- **Always the user's.** ISA never overwrites a person's chosen identity with its own model of them.

### 6.2 Context lenses

Below the Identity apex, the **same events** are viewed through multiple descriptive lenses simultaneously. Context is not extra data — it is *perspective* on the event stream.

```mermaid
flowchart TB
    IDN["★ IDENTITY LAYER: 'who I want to become' (apex + hard constraint)"]:::apex
    E[(Life Event stream)] --> C0
    C0[Current Context: 'right now'] --> C1
    C1[Today's Context: 'this day'] --> C2
    C2[Weekly Context: 'this rhythm'] --> C3
    C3[Monthly Context: 'this season'] --> C4
    C4[Long-term Context: 'this era'] --> C5
    C5[Life Context: 'who I am (descriptive)'] 
    E --> BC[Behavior Context: 'how I tend to act']
    IDN --> DC
    C5 --> DC
    BC --> DC
    C0 --> DC[Decision Context: 'what I should weigh now']
    classDef apex fill:#fef3c7,stroke:#b45309,stroke-width:2px;
```

| Layer | Question it answers | Time window | Primary use |
|---|---|---|---|
| **★ Identity** | "Who do I want to become?" | lifetime (declared) | the apex constraint + top priority for every recommendation & the Decision Engine |
| **Current** | "What is true this exact moment?" | now (minutes) | timely nudges, "next prayer in 20m," protect the free block |
| **Today** | "What is this day shaped like?" | today | the daily picture, realistic load, morning intent / evening review |
| **Weekly** | "What is my rhythm?" | rolling 7 days | pattern onset, "this week vs last," the weekly review |
| **Monthly** | "What season am I in?" | rolling ~30 days | cash-flow shape, goal pace, habit reliability, monthly review |
| **Long-term** | "What era am I in?" | quarters / years | trajectory, life-phase shifts, multi-year trends |
| **Life** | "Who is this person, descriptively?" | lifetime | durable traits inferred from data — the deep descriptive model |
| **Behavior** | "How does this person tend to act?" | learned over time | prediction & recommendation grounding (tendencies, not events) |
| **Decision** | "Given everything, what should I weigh right now?" | synthesized on demand | the input to any recommendation — fuses Identity + Life + Behavior + Current |

**Key architectural idea — Decision Context:** when the Engine is about to advise or predict, it assembles a **Decision Context** — a fused snapshot of *who the person wants to become* (**Identity**), *who they are* (Life), *how they tend to behave* (Behavior), and *what is true now* (Current). Recommendations are computed from Decision Context, never from a single layer, and **Identity is the highest-weighted input.** This is what makes ISA's advice feel like it comes from someone who *knows who you are and who you're trying to be* — not from a rule reacting to one data point.

---

## 7. User Memory

The Engine deliberately distinguishes **remembering** from **storing**. Everything is stored (the event log is permanent and the user's); but the Engine's *working memory* — what it actively carries into reasoning — is curated, because a mind that remembers everything equally understands nothing.

### 7.1 What ISA should remember (carry forward, actively)
- **Baselines & norms:** the person's typical sleep, spend-by-category, daily task load, focus window, habit reliability.
- **Stable patterns:** "energy dips Thursdays," "good weeks start with a Sunday review," "stress → late-night spending."
- **Identity & values:** declared priorities, faith practice, what the person says matters — the hard constraints on advice.
- **Milestones:** goals reached/abandoned, major income changes, long streaks made/broken — the Life Timeline anchors.
- **Preferences learned from feedback:** which insights were accepted vs. dismissed; how and when the person likes to be spoken to.

### 7.2 What ISA should forget (let fade into aggregates)
- **Trivial, in-baseline events** individually — a normal coffee expense matters as part of the "Food baseline," not as a remembered moment.
- **Superseded state:** old baselines once new ones stabilize (people change; the model must too).
- **One-off noise:** anomalies that never repeat and never linked to anything.
- **Stale predictions & dismissed insights** (kept only as feedback signal, not as active beliefs).

> Forgetting is a *feature of understanding*. It is how the Engine keeps a clear, current picture instead of an ever-heavier archive. The raw events remain available; it is the *active model* that stays lean.

### 7.3 What becomes permanent knowledge
- **Declared identity, values, principles & personal mission** (the Identity Layer, §6.1) — the *most* permanent memory in the system; changed only by the user's explicit declaration or strong, repeated, sustained evidence. This is the North Star everything else is measured against.
- **Pivotal life events** (Life Timeline).
- **Durable descriptive traits** (Life Context) — the inferred self; updated as the person genuinely changes.
- **The event log itself**, as the user's inviolable record and export.

### 7.4 Memory decision tree
```mermaid
flowchart TD
    E[New event / observation] --> Q1{Pivotal / milestone?}
    Q1 -- Yes --> PERM[Permanent memory + Life Timeline]
    Q1 -- No --> Q2{Part of a real, repeated pattern?}
    Q2 -- Yes --> MODEL[Update baselines / Behavior Context]
    Q2 -- No --> Q3{Deviates meaningfully from baseline?}
    Q3 -- Yes --> WATCH[Hold in medium-term memory; watch for repetition]
    Q3 -- No --> AGG[Fold into aggregates; forget individually]
```

---

## 8. The Life Timeline

The Life Timeline is the **connected long-term record of a life** — the structure that turns a decade of events into a story ISA (and the user) can read.

- **Structure:** a continuous spine of time, threaded by **domain lanes** (money, goals, habits, energy, faith, focus…) and marked by **anchors** (pivotal events).
- **Connection principle:** the timeline's power is *vertical* — being able to slice any moment and see *all domains at once* ("in March, sleep collapsed, a goal stalled, spending spiked, and the journal explains why"), and *horizontal* — following one thread across years ("your saving discipline strengthened every year since 2026").
- **Eras & seasons:** the Engine segments the timeline into **eras** (long phases with stable characteristics) and **seasons** (monthly moods), so the user can see their life in chapters, not just days.
- **Reflection surface:** the timeline is what powers yearly review and, eventually, multi-year counsel — "here is who you were, here is who you're becoming."

```mermaid
flowchart LR
    subgraph Y1[Year 1]
      A1[Goal: MacBook ✓] --- B1[Habit: Reading streak] --- C1[Era: 'building discipline']
    end
    subgraph Y2[Year 2]
      A2[Income up] --- B2[Focus habit solidified] --- C2[Era: 'compounding']
    end
    subgraph Y3[Year 3]
      A3[Major goal ✓] --- B3[Stable rhythm] --- C3[Era: 'mastery']
    end
    Y1 --> Y2 --> Y3
```

**Rule:** the timeline is never a wall of raw logs shown to the user. It is *read* by the Engine to produce reflection; the user sees *meaning*, not a database dump. (Intelligence over Information, applied to time.)

---

## 9. Recommendation Inputs

Before ISA advises, it gathers a defined set of signals. A recommendation made without these is forbidden (it would be generic advice — an anti-pattern).

**Signals collected before any recommendation:**
1. **Identity alignment (§6.1)** — *first and highest-weighted:* does this serve who the person wants to become? A recommendation that fails identity alignment is discarded before anything else is considered.
2. **Decision Context** (§6): who the person wants to become + who they are + how they behave + what's true now.
3. **Active goals & their state** — what the person is trying to achieve, and which are at risk.
4. **Declared values & constraints** — faith, priorities, quiet hours, hard limits (from Settings).
5. **Current capacity** — energy, sleep debt, mood, calendar load (can they act on this today?).
6. **Relevant baselines** — is the situation actually a deviation, or normal for this person?
7. **Cross-domain links** — does the money situation touch a goal? does the calendar block the focus?
8. **Recent feedback** — what similar advice did the person accept or dismiss before?
9. **Timing appropriateness** — is *now* a moment where advice helps, or would it be noise/pressure? (Final go/no-go is the Decision Engine's, §12.)

**Recommendation quality contract:** every recommendation must be **specific** (to this person's data), **grounded** (traceable to events), **bounded** (respects values & capacity), **optional** (a proposal), and **timely** (delivered when actionable). Fails any → not shown.

---

## 10. Prediction Inputs

Prediction is Phase-III intelligence. Each predictable dimension draws on a defined signal set. Predictions are always **probabilistic and explainable** ("likely, because…"), never oracular.

| Predict | Primary inputs | Example foresight |
|---|---|---|
| **Productivity** | historical completion rate by day/energy, calendar load, sleep, focus history, task backlog | "Tomorrow looks over-committed given your energy — plan for 2 key tasks, not 6." |
| **Money** | income cadence, category baselines, recurring obligations, month-to-date pace, spend↔mood links | "At this pace you'll overshoot your budget by ~15% and miss the goal ETA by 3 weeks." |
| **Goals** | progress velocity, deadline, dependency on money/energy/focus, historical stall patterns | "This goal is trending to finish 6 weeks late unless weekly focus rises." |
| **Habits** | per-habit reliability, near-miss pattern, success conditions (sleep/workload/day), streak fragility | "Reading is fragile this week — high workload days are when you miss it." |
| **Energy** | sleep trend & consistency, activity, mood, recent load, historical recovery patterns | "You're building a sleep deficit; a low-capacity day is likely Thursday." |
| **Focus** | best-time-of-day model, session-length sustainability, sleep/energy, calendar collisions | "Your deep-work capacity will be low tomorrow morning after tonight's short sleep." |

**Prediction laws:**
1. **No prediction from thin data** — below a real evidence threshold, ISA says "not enough history yet."
2. **Always explainable** — a forecast the Engine can't justify is not shown.
3. **Always actionable or omitted** — a prediction the user can't influence is often better left unsaid (calm).
4. **Foresight serves prevention** — the purpose is to help pre-empt, not to alarm.

---

## 11. The Intelligence Pipeline

The permanent path from raw action to wisdom. Each stage has one job and hands a clean product to the next. This pipeline is the Engine's "how" in one line.

```mermaid
flowchart LR
    A[User Action] --> B[Life Event] --> C[Context + Identity] --> D[Patterns] --> E[Insights] --> F[Recommendations] & G[Predictions] & H[Reflection]
    F & G & H --> DEC[["★ Decision Engine: what surfaces now?"]]
    DEC --> S[Surface]
    H -. feeds back .-> C
    S -. accepted/dismissed .-> D
    S -. accepted/dismissed .-> DEC
```

| Stage | What happens | Input → Output | Governing law |
|---|---|---|---|
| **1 · User Action** | The person does something meaningful in a module | interaction → raw signal | capture faithfully |
| **2 · Life Event** | Signal normalized, typed, weighted, linked, provenance kept | signal → event | honesty & provenance |
| **3 · Context + Identity** | Event folded into every time-scale & behavioral lens, under the Identity apex | event → context layers | completeness + identity-aware |
| **4 · Patterns** | Real, repeated, cross-domain regularities detected; noise rejected | context → patterns | no fabrication |
| **5 · Insights** | Meaning attached — "what this means" with its reasoning | patterns → insight | intelligence > information |
| **6 · Recommendations** | A grounded, bounded, optional, *identity-aligned* proposal, if warranted | insight + Decision Context → proposal candidate | agency + identity/values |
| **7 · Predictions** | Probable, explainable foresight, if data supports it | insight + behavior model → forecast candidate | probabilistic + actionable |
| **8 · Reflection** | Honest mirrors across day/week/month/year; the story | everything → reflection candidate | calm + truth |
| **9 · Decision Engine** | Of **all** candidates from 6–8, decide what (if anything) surfaces now, and in what priority (§12) | candidates + attention budget + identity + feedback → the surfaced few | calm + priority |

Stages 6–8 are **generators**: they may each produce many candidates. Stage 9, the **Decision Engine**, is the single gate to the user's attention — it turns *"here is everything true we could say"* into *"here is the one thing worth saying now."*

**Feedback loops (why the Engine gets smarter over time):**
- **Reflection → Context:** last period's synthesis becomes context for the next (the system has a memory of how it summarized you).
- **Surface outcome → Patterns:** accepted/dismissed items refine what counts as a useful pattern *for this person*.
- **Surface outcome → Decision Engine:** what the user engaged with vs. ignored tunes *what earns attention* next time — the Decision Engine learns the person's threshold and taste.

**Crucial rule:** every stage can output **nothing**. No pattern? No insight. No warranted proposal? Nothing surfaced. The pipeline is not a content generator; it is a truth-and-attention filter. Most raw actions produce no visible intelligence — and that is correct.

---

## 12. The Decision Engine (attention arbitration)

The Engine's generators (§11 stages 6–8) are *abundant*: as ISA matures, on any given day they may produce dozens or hundreds of true, well-formed, identity-aligned candidates — insights, recommendations, predictions, reflections. Almost all of them are correct. **Saying all of them would destroy the product.** The whole philosophy — *calm, silence-by-default, attention is sacred* — collapses the moment ISA becomes a firehose of true-but-unimportant remarks.

The **Decision Engine** is the layer that solves this. Its single job:

> **Of everything ISA *could* truthfully say right now, decide the one (or few) things it *should* say — or decide to stay silent.**

It is the operational enforcement of the Calm principle. Truth earns a candidate the right to *exist*; identity keeps it *aligned*; the Decision Engine decides whether it is worth the user's *attention today.*

### 12.1 Why it must be its own layer
Without it, every module and every rule competes directly for the user's attention, and the loudest or most recent wins — which is exactly how every notification-farming product decays. A dedicated arbitration layer means attention is allocated **globally and intentionally**, by one authority that sees *all* candidates at once and holds the user's attention budget.

### 12.2 The flow

```mermaid
flowchart TB
    subgraph GEN["Generators (many candidates)"]
      I1[Insight A] & I2[Insight B] & R1[Recommendation C] & P1[Prediction D] & X1[... dozens more]
    end
    GEN --> DE
    subgraph DE["★ DECISION ENGINE"]
      SCORE[Score each candidate] --> RANK[Rank by priority] --> BUDGET{Within today's<br/>attention budget?<br/>Above the bar?}
    end
    BUDGET -- "highest 1–few" --> SURF[Surface: the right place, the right moment]
    BUDGET -- "everyone else" --> HOLD[Hold / defer / discard]
    SURF -. engaged? ignored? .-> LEARN[(Tune future thresholds)]
    LEARN -.-> DE
```

The permanent shape the user asked for:

```
Generated candidates → Decision Engine → Priority → Recommendation(s) → Surface
                                    ↘ (most candidates) → silence
```

### 12.3 How a candidate is scored
Each candidate is scored on a fixed set of dimensions. The score is **relative and global** — a candidate competes against every other candidate for the same scarce attention.

| Dimension | Question | Raises priority when… |
|---|---|---|
| **Identity alignment** | Does this serve *who the user wants to become?* | it closes a gap between behavior and a declared identity/value |
| **Importance** | How life-significant is the underlying event/pattern? | it's Significant/Pivotal (§5.3), not Trivial |
| **Timeliness** | Is *now* the moment it can change something? | acting now prevents a cost; the window is closing |
| **Actionability** | Can the user actually do something about it? | there is a clear, doable next step |
| **Novelty** | Does the user already know this? | it reveals something not obvious / not recently said |
| **Confidence** | How sure is the Engine? | evidence is strong; no fabrication risk |
| **Cost of silence** | What happens if ISA says nothing? | staying quiet lets a real problem grow |
| **Fit to the moment** | Does the current context welcome it? | the user is in a receptive state, not overloaded/resting |

### 12.4 The attention budget
The Decision Engine holds a deliberately **small, finite budget** of interruptions per day/week — a spending limit on the user's attention. Rules:
1. **Silence is free and preferred; speaking is expensive.** A candidate must beat the bar *and* fit the budget.
2. **One clear thing beats five true things.** When several candidates qualify, the Engine prefers the single most important over a list.
3. **Budget shrinks when the user is depleted.** Low energy, a hard season, quiet hours → the bar rises and the budget falls.
4. **Unspent attention does not roll over into nagging.** A quiet day is a success, not a backlog.
5. **The bar rises with horizon.** Daily nudges are rare; a yearly reflection is worth a larger, once-a-year spend.

### 12.5 Decision tree (does this candidate surface?)
```mermaid
flowchart TD
    C[Candidate] --> Q1{True & confident?<br/>no fabrication}
    Q1 -- No --> DROP[Discard]
    Q1 -- Yes --> Q2{Identity/values<br/>aligned?}
    Q2 -- No --> DROP
    Q2 -- Yes --> Q3{Important & novel<br/>to this person?}
    Q3 -- No --> HOLD[Hold - fold into a review, don't interrupt]
    Q3 -- Yes --> Q4{Actionable now<br/>& timely?}
    Q4 -- No --> HOLD
    Q4 -- Yes --> Q5{Highest-priority<br/>candidate right now?}
    Q5 -- No --> QUEUE[Wait its turn / defer]
    Q5 -- Yes --> Q6{Within attention budget<br/>& fits the moment?}
    Q6 -- No --> QUEUE
    Q6 -- Yes --> SURFACE[Surface it - once, well, in the right place]
```

### 12.6 Rules the Decision Engine obeys
- **Global, not local.** It arbitrates across *all* modules; no module can surface on its own authority.
- **One authority for attention.** Every notification, nudge, and highlighted insight passes through it. There is no side channel.
- **Prefer silence.** When in doubt, hold. The cost of an unsaid true thing is almost always lower than the cost of eroding trust with noise.
- **Prefer the review over the interruption.** Non-urgent truths are saved for the daily/weekly/monthly/yearly reflection, where the user *chooses* to receive them — not pushed.
- **Learn the person's threshold.** Repeated dismissal of a class of candidate raises its bar; engagement lowers it. The Engine adapts to how much, and what, this person wants to hear.
- **Never manufacture a reason to speak.** The budget is a ceiling, not a quota to fill.

> **The Decision Engine is what lets ISA generate the intelligence of a thousand observations and still feel like a calm friend who speaks rarely and always means it.** It is the bridge between "ISA is smart" and "ISA is trusted."

---

## 13. Cross-Module Intelligence

This is the payoff of the whole architecture: **the connections are the product.** Below are representative, load-bearing relationships. They are *rules of reasoning*, not features — the Engine applies them continuously.

### Relationship map (illustrative)
```mermaid
flowchart TD
    Energy((Energy / Sleep / Mood)):::hub
    Money((Money)):::hub
    Goals((Goals)):::hub
    Tasks((Tasks)):::hub
    Focus((Focus)):::hub
    Habits((Habits)):::hub
    Calendar((Calendar)):::hub
    Prayer((Prayer)):::hub
    Journal((Journal)):::hub
    Dash([Dashboard]):::sink
    AI([AI]):::sink

    Energy --> Focus & Tasks & Habits & Money
    Money --> Goals
    Goals --> Tasks & Focus
    Tasks --> Goals & Dash
    Calendar --> Focus & Tasks & Prayer
    Habits --> Energy & AI
    Prayer --> Calendar & AI
    Journal --> AI & Money & Goals
    Focus --> Goals & Energy
    Energy & Money & Goals & Tasks & Focus & Habits & Calendar & Prayer & Journal --> Dash
    Journal & Habits & Money & Energy & Goals --> AI
    classDef hub fill:#eef,stroke:#446;
    classDef sink fill:#efe,stroke:#464;
```

### Representative reasoning rules
| When… | …the Engine reasons… | Producing |
|---|---|---|
| **Sleep drops** | capacity is down today | lower suggested task load; soften habit expectations; warn focus will be weak |
| **Money is tight** | goals slow; stress rises | flag at-risk goal ETAs; watch for stress-spending; connect to journal mood |
| **A goal is finished** | momentum is available | offer it to the next goal; mark a Life Timeline anchor; reflect it into the yearly story |
| **Goals exist** | they must generate work | suggest linking tasks to goals; surface goals with no recent task activity (drift) |
| **Tasks pile up undone** | overload or avoidance | detect procrastination; propose scheduling or dropping chronic deferrals |
| **Calendar is packed** | no room for deep work | protect the one free block; predict an over-committed day; guard rest & prayer windows |
| **Habits hold** | the person is in a stable era | raise confidence in ambitious recommendations; reflect strength |
| **Habits fracture** | routine is fragile | predict relapse from success-conditions; offer a lighter version, not guilt |
| **Prayer times anchor the day** | structure exists to plan around | schedule focus/tasks around prayer; treat prayer windows as immovable |
| **Journal says 'overwhelmed'** | there is a felt cause behind the numbers | ground recommendations in the person's words; connect feeling to its data signature |
| **Focus is best at 9–11am** | capacity has a shape | recommend front-loading deep work; warn when a bad night threatens that window |
| **Energy + Money + Goals all dip together** | a hard season is underway | zoom out, name the season honestly, prioritize recovery over output |

### The synthesis that no competitor can produce
> *"Your goal stalled this month. The root cause wasn't laziness — it was a run of short sleep that cut your morning focus, which is when you make progress. That same tiredness shows up as late-night spending, which is why the goal's funding also slipped, and your journal on the 14th ('stretched thin') matches exactly. This is a recovery week, not a discipline problem. Protect sleep; the rest recovers with it."*

That sentence requires Money **and** Goals **and** Focus **and** Energy **and** Journal to be one connected understanding. That sentence is ISA. No single-domain tool can ever say it.

---

## 14. Temporal Intelligence

The Engine expresses itself at four cadences, each with a distinct job. Same brain, different zoom.

| Cadence | Question | The Engine's job | Tone |
|---|---|---|---|
| **Daily** | "What matters today?" | one clear, realistic picture: today's load vs. capacity, the one thing that matters, timely nudges. Never a firehose. | present, gentle, actionable |
| **Weekly** | "What was my rhythm?" | honest mirror of the week; the first place real patterns become visible; one thing to carry forward. | reflective, pattern-first |
| **Monthly** | "What season am I in?" | cash-flow shape, goal pace, habit reliability, energy trend — the health of the month; the first place *foresight* becomes reliable. | evaluative, trend-first |
| **Yearly** | "Who am I becoming?" | the life story: eras, milestones, growth across domains; the deepest reflection ISA offers; the payoff of a decade of data. | narrative, identity-first |

**Design laws for temporal intelligence:**
1. **Zoom, don't repeat.** Each cadence says something the others can't; weekly is not "seven dailies stacked."
2. **Longer horizon → higher bar for confidence** and lower frequency of interruption.
3. **The year is sacred.** Yearly reflection is where "Teach Instead of Store" fully pays off — the user learns who they are. It must be profound, honest, and unhurried.
4. **Every cadence ends with meaning, not metrics.** A number without a takeaway is a failure at any zoom level.

---

## 15. Why ISA is fundamentally different

Every tool below is excellent at one slice. Each is, architecturally, a **silo with no nervous system.** ISA's difference is not features — it's the Engine.

| Tool | What it is | Its structural ceiling | What ISA does instead |
|---|---|---|---|
| **Notion** | A flexible container you must structure yourself | It stores whatever you build; it understands none of it. The user is still the intelligence. | ISA *understands* the life inside it and connects domains automatically — the intelligence is the product, not the user's manual labor. |
| **Todoist** | A best-in-class task list | A task is an island; it doesn't know your energy, money, goals, or why you keep deferring. | ISA sees tasks as *one organ* — linked to goals, capacity, calendar, and follow-through patterns. |
| **Google Calendar** | Time blocks | It knows *when*, never *whether you should*, or how a day collides with your energy and priorities. | ISA reasons about time *against the whole person* — capacity, goals, prayer, focus windows. |
| **Apple Notes** | A place to dump text | Inert. Notes never become goals, never resurface at the right moment, never connect to anything. | ISA treats ideas as live signal — themes detected, promotion offered, relevant thoughts resurfaced in context. |
| **Money managers** | Transaction ledgers & charts | They optimize money in isolation — blind to your goals, stress, energy, and why you spent. | ISA connects money to goals, mood, and life-season; spending is understood, not just logged. |
| **AI chatbots** | A brilliant stranger behind a prompt | No persistent, structured model of *your* life; you must re-explain yourself every time; it reacts, never anticipates; it will confidently invent. | ISA has a durable, honest, event-grounded model of one life; intelligence is **ambient and anticipatory**, always traceable, never fabricated, and it *knows you already*. |

### The core distinction, stated once
> **Every competitor is a tool you operate. ISA is a system that understands you.**
>
> A tool waits for input and gives output. An operating system holds the whole environment, coordinates every part, and knows the state of the whole. ISA is a *Life* Operating System because the Life Intelligence Engine does for a human life what an OS does for a computer: it makes the pieces one coherent, self-aware system.

A collection of productivity tools can make you *organized.* Only a connected intelligence can help you *understand yourself and move your life forward.* That connection — the Engine described in this document — is the permanent reason ISA exists and the permanent reason it cannot be reduced to the sum of its modules.

---

## Appendix A — Glossary
- **Identity Layer:** the aspirational self — who the user wants to become (values, principles, long-term identity, personal mission). The apex context and the deepest constraint; the most permanent memory.
- **Life Event:** a normalized, provenance-bearing record of a meaningful action/state-change; the Engine's source of truth.
- **Context Layer:** a perspective (time-scale or abstraction) on the event stream.
- **Decision Context:** the fused snapshot (**Identity** + Life + Behavior + Current) used to generate any recommendation, with Identity highest-weighted.
- **Decision Engine:** the attention-arbitration layer that decides which of many true candidates (if any) surfaces now — the operational enforcement of calm/silence-by-default.
- **Attention budget:** the finite, deliberately small allowance of interruptions the Decision Engine may spend; shrinks when the user is depleted.
- **Life Timeline:** the connected long-term record; the substance of long-horizon reflection.
- **Pattern:** a real, repeated, cross-domain regularity — never a one-off.
- **Insight:** a pattern with meaning and reasoning attached.
- **Constraints band:** the always-on laws (identity/values, privacy, honesty, calm/timing) every layer obeys.

## Appendix B — Non-negotiable engine laws (quick reference)
1. Connections are the product; silos are forbidden.
2. Understanding over information, always.
3. **Identity outranks optimization.** Never advance a goal by contradicting who the user wants to become.
4. Every insight is traceable to its events.
5. No fabrication from noise or thin data.
6. The human decides; the Engine proposes.
7. Identity, values, and privacy are hard constraints, not preferences.
8. Silence is the default; speaking must be earned — and **only the Decision Engine may spend the user's attention.**
9. One clear thing beats five true things.
10. Forgetting is part of understanding; declared identity is the most permanent memory.
11. Every stage may output nothing — the pipeline is a truth-and-attention filter, not a content mill.
12. Optimize the person's life toward their chosen identity, never the app's engagement.

---

*End of Document 2 — ISA Life Intelligence Engine. This is the brain. Every module plugs into it; nothing bypasses it.*
