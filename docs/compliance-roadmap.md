# Compliance roadmap

> **Not legal advice.** This is an engineering-side checklist of *when* each legal/compliance
> obligation realistically starts to matter for nvault, and what to do at that point. Get a
> CA-cum-company-secretary or a startup lawyer to review before you act on the money/registration
> items. Written for the current setup: **operated by one person in India (Hyderabad), no
> registered company, no GST, payments via Polar as Merchant of Record, `nvault.dev`.**

Related: the marketing legal pages live under `src/app/(marketing)/` (`/legal`, `/privacy`,
`/terms`, `/refunds`, `/acceptable-use`, `/cookies`, `/subprocessors`, `/dpa`). Their shared
config is `legalConfig` + `subprocessors` in [`src/lib/site.ts`](../src/lib/site.ts).

---

## TL;DR trigger table

| # | Trigger (whichever comes first) | What to get / do | Rough cost | Lead time |
|---|---|---|---|---|
| 0 | **Now** (pre-revenue, free only) | Monitored `privacy@` + `security@` + `hello@` mailboxes; put your real name in `NEXT_PUBLIC_LEGAL_OPERATOR_NAME`; keep books of any expenses | ₹0 | — |
| 1 | **You decide to turn on paid plans** (Pro/Team) | (a) Mailing-only **virtual office address** → `NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS`; (b) re-add a **one-paragraph grievance/complaint clause** to Privacy + Terms; (c) confirm Polar tax/invoice settings; (d) start declaring the income in your ITR as business income | ₹500–1,000/mo + CA time | 3–7 days |
| 2 | **DPDP Rules become operative with compliance deadlines** | Add "data principal grievance" wording + statutory response time to the Privacy Policy; make sure the `privacy@` workflow is documented internally | ₹0 (DIY) or ₹30–60k/qtr for a fractional DPO if a customer asks | within the transition window |
| 3 | **First B2B / organisation customer runs vendor due diligence** | Offer the signed **DPA** (already drafted at `/dpa`); keep `/subprocessors` current; fill a security questionnaire | ₹0 | per deal |
| 4 | **EU/UK becomes a real target audience** (not incidental users) | Consider a **GDPR Art. 27 EU representative**; add SCC references to the DPA | ~€300–1,500/yr | 1–2 weeks |
| 5 | **Aggregate turnover crosses ₹20 lakh** (services), OR you need input-tax credit, OR a customer demands a GST invoice from *you* | **GST registration** → upgrade the virtual office to a **GST-documentation plan** (NOC + rent agreement + utility bill), file returns monthly/quarterly | ₹1,000–2,500/mo + ₹1–3k/mo CA for returns | 2–4 weeks incl. verification |
| 6 | **You want limited liability / outside funding / to hire / bigger enterprise deals** | Incorporate (LLP or Pvt Ltd); virtual office becomes the **registered office**; full statutory footer (entity name, CIN/LLPIN, GSTIN, registered address) | ₹8–20k setup + ₹15–40k/yr compliance | 2–4 weeks |
| 7 | **"Significant Data Fiduciary" designation** (high volume / sensitive data — unlikely for a while) | India-resident DPO, DPIA, annual data audit | ₹15–30 L/yr in-house or fractional | — |

---

## Milestone 0 — Now (pre-revenue, free tier only)

**Do:**
- Create and actually monitor `hello@nvault.dev`, `privacy@nvault.dev`, `security@nvault.dev`.
- Set `NEXT_PUBLIC_LEGAL_OPERATOR_NAME` to your real name.
- Leave `NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS` **unset** — the pages fall back to
  "Hyderabad, Telangana, India" + "postal address on request for legal notice".
- Keep a simple record of any expenses (domain, hosting) — useful once there's income to offset.

**Don't bother with:** virtual office, GST, grievance officer page, DPO, incorporation.

**Why it's fine:** the IT Rules 2021 grievance officer is practically enforced against
content-hosting platforms at scale, not zero-user dev tools. DPDP's operative rules aren't in
force with deadlines yet. With no payments, you're not an "e-commerce entity" under the Consumer
Protection (E-Commerce) Rules. Early-stage legal guidance is "a `privacy@` you answer is enough."

---

## Milestone 1 — Turning on paid plans (first consumer revenue)

This is the big one. The moment you accept money from consumers, three regimes start to apply:
consumer-protection disclosure, tax on the income, and a real customer who can complain.

### 1a. Get a virtual office address (mailing-only)

You need a real postal address to publish. **Do not use your home address** — it's permanently
public and scraped. **Do not skip it** either, once you're charging.

- **What to buy:** the cheapest "business address / mail handling" plan. NOT the GST plan yet.
- **Cost:** ~₹500–1,000/month, usually billed annually.
- **Where:** a business area in Hyderabad — HITEC City / Madhapur, Gachibowli, Kondapur,
  Banjara Hills, Begumpet.
- **Providers:** myHQ, InstaSpaces, Cofynd, Team Cowork, The Office Address, Aaddress.in,
  91springboard, Awfis. (Or use your CA's office address if they allow it, or a coworking
  membership that includes an address.)
- **Turnaround:** 1–3 days for a mailing-only plan.

Then set:

```
NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS="c/o <Provider>, <Floor>, <Building>, <Road>, HITEC City, Hyderabad, Telangana 500081, India"
```

Every legal page and the footer pick it up automatically.

### 1b. Re-add a grievance / complaint clause

Do **not** build a Razorpay-style multi-level grievance portal — that's an RBI/SEBI fintech
requirement, not a SaaS one. The SaaS norm (Pattern C) is **one paragraph** at the end of the
Privacy Policy and the Terms:

> **Complaints & grievances.** If you have a complaint about the Service or about how we handle
> your personal data, contact **[Your name], nvault** at `grievance@nvault.dev` (or
> `privacy@nvault.dev` for data-protection matters). We will acknowledge within 3 working days
> and aim to resolve within 15 days. Our address for the service of formal notice is
> [virtual office address].

Options:
- Minimal: add the paragraph to `/privacy` and `/terms` only.
- Fuller: restore the dedicated `/grievances` page (it's in git history on the `fix-pages`
  branch — `git show fix-pages:src/app/(marketing)/grievances/page.tsx`), re-add
  `grievanceOfficerName` / `grievanceEmail` to `legalConfig`, and relink it in `legalPages`
  (`src/components/marketing/legal-page.tsx`), `footerNav` (`src/lib/site.ts`), and
  `src/app/sitemap.ts`.

### 1c. Payment / tax hygiene (Polar as Merchant of Record)

- In the Polar dashboard, confirm tax collection is enabled and your business/individual details
  are correct. Polar is the **seller of record** to your customers — it issues their invoices and
  collects/remits *their* sales tax / VAT / GST. You don't invoice the end customer.
- What Polar pays out to you is **income** (export of services / B2B receipts from a foreign
  payer). It is taxable from the first rupee regardless of registration.
- Tell your CA you've started receiving Polar payouts. They'll advise on advance tax, FIRC/FIRA
  for the inward remittance, and whether the export-of-services GST exemption keeps you under the
  threshold.

### 1d. Keep the refund policy accurate

`/refunds` already describes cancel-anytime, a 14-day goodwill window, and Polar handling the
mechanics. Keep it truthful to what you actually honour.

---

## Milestone 2 — DPDP Rules operative

The Digital Personal Data Protection Act, 2023 is passed; the **Rules** that make it operational
(with compliance timelines) are the thing to watch for. When they're notified:

- There is **no revenue or size exemption** for the basic obligations: publish a contact for
  data-processing questions, run a grievance mechanism with defined response times, honour
  access/correction/erasure/nomination requests.
- Practically, for a small operator: the `privacy@` address + the paragraph from 1b + honouring
  requests within 30 days covers it. Document the internal process (even a one-page note).
- A fractional/outsourced DPO retainer (~₹30–60k/quarter) only becomes worth it when a customer's
  due-diligence asks for a named DPO, or at "Significant Data Fiduciary" scale.

---

## Milestone 3 — First B2B customer due diligence

- Point them at `/dpa` (drafted) and offer to countersign. Keep `/subprocessors` accurate —
  update it whenever you change hosting, database, email, or add any processor.
- Expect a security questionnaire; the `/security` page + the DPA cover most answers.
- If they need SCCs, that's the trigger for Milestone 4 too.

---

## Milestone 4 — EU/UK as a real audience

If you have no establishment in the EU and you're offering the service to EU data subjects on
more than an occasional basis:

- **GDPR Article 27 representative** in the EU (and a UK representative for UK GDPR). Third-party
  services do this for ~€300–1,500/yr (e.g. Prighter, DataRep, IITR).
- Add the representative's details to the Privacy Policy and reference Standard Contractual
  Clauses in the DPA for transfers out of the EEA.
- Skip this while EU users are incidental.

---

## Milestone 5 — GST registration

**Triggers (any one):**
- Aggregate turnover crosses **₹20 lakh** (services) in a financial year.
- You want to claim input-tax credit on business expenses.
- A customer specifically needs a GST invoice **from you** (rare — Polar handles their invoice).
- You start any B2B supply within India that makes registration mandatory (get CA advice — the
  export-of-services position matters here).

**What to do:**
1. Upgrade the virtual office to a **"virtual office for GST registration"** plan from the *same*
   provider. This adds the document kit GST needs:
   - owner **NOC** (No Objection Certificate),
   - notarised **rent / leave-and-licence agreement**,
   - a recent **electricity/utility bill** for the premises.
   - Cost: ~₹1,000–2,500/month. Documents in 48–72h.
2. Apply for GSTIN (your CA does this, or the provider's tied CA).
3. **Physical verification:** GST officers increasingly visit the address. A pure virtual office
   can get flagged or rejected — a good provider stages the premises and handles the visit. Ask
   the provider directly about their verification success rate in Hyderabad before paying.
4. After GSTIN: file returns (GSTR-1 + GSTR-3B monthly, or QRMP quarterly). Budget ~₹1–3k/month
   for a CA to file, or use a filing tool.
5. Put the GSTIN in the site footer / legal pages once you have it.

---

## Milestone 6 — Incorporation (LLP or Pvt Ltd)

**Triggers:** you want limited liability, you're raising money, you're hiring, or enterprise
deals require contracting with a company rather than an individual.

**What changes:**
- The virtual office becomes the company's **registered office** (needs the same NOC + agreement
  + utility bill kit as GST, plus MCA-format proof).
- Full statutory footer: registered entity name, **CIN** (Pvt Ltd) or **LLPIN** (LLP), GSTIN,
  registered address, and often "Registered under the Companies Act, 2013 / LLP Act, 2008".
- Update `legalConfig`: `operatorName` → entity name, `operatorType` → "a company registered in
  India" / "an LLP registered in India", set `operatorAddress` to the registered office.
- Annual compliance: ROC filings, board/partner meetings, statutory audit (Pvt Ltd), etc.
  Budget ₹15–40k/year.
- LLP is lighter and cheaper to run than Pvt Ltd; Pvt Ltd is expected if you take equity funding.

---

## Milestone 7 — Significant Data Fiduciary (far off)

Government designates you an SDF based on volume/sensitivity of personal data, risk to
electoral democracy, etc. Unlikely for a zero-knowledge config vault, but if it happens:
India-resident **DPO**, mandatory **DPIA**, and an annual **data audit** by an independent
auditor. Handle it with counsel if you ever get there.

---

## Quick reference: config keys

| Key | Set when | Value |
|---|---|---|
| `NEXT_PUBLIC_LEGAL_OPERATOR_NAME` | Now | Your real name (later: entity name) |
| `NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS` | Milestone 1 | Virtual office address string |
| `NEXT_PUBLIC_DB_PROVIDER` | At deploy | "Neon, Inc." / "Supabase, Inc." — whichever hosts the DB |
| (re-add) `grievanceOfficerName` / `grievanceEmail` in `legalConfig` | Milestone 1b, if using the full page | Your name / `grievance@nvault.dev` |

## Quick reference: what NOT to do early

- Don't publish your home address — use "on request" (current) or a virtual office (Milestone 1).
- Don't build a multi-level grievance portal — that's a fintech (RBI/SEBI) pattern, not SaaS.
- Don't register GST "to look legit" — it creates a monthly filing obligation forever after.
- Don't incorporate before there's a reason — an individual/sole operator needs no registration.
- Don't hire a full-time DPO — fractional/retainer only, and only when a customer requires it.
