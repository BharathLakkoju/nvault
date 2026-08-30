import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/lib/seo";
import { legalConfig } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Refunds & Cancellation Policy",
  description:
    "How to cancel an nvault Pro or Team subscription, when refunds are issued, and how billing is handled by our Merchant of Record, Polar.",
  path: "/refunds",
});

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refunds & Cancellation Policy"
      path="/refunds"
      intro="nvault sells digital subscriptions to a software service. This page explains how to cancel, what happens to your data, and when you are entitled to a refund."
    >
      <h2>1. What you are buying</h2>
      <p>
        nvault Pro and nvault Team are recurring subscriptions to a hosted software service. There is no physical
        product and nothing is shipped. Access is provisioned immediately after a successful payment, so a subscription
        is a service that begins at once with your consent.
      </p>

      <h2>2. Who processes your payment</h2>
      <p>
        Payments are handled by our Merchant of Record, {legalConfig.merchantOfRecord} (
        <a href={legalConfig.merchantOfRecordUrl} target="_blank" rel="noopener noreferrer">
          {legalConfig.merchantOfRecordUrl.replace("https://", "")}
        </a>
        ). {legalConfig.merchantOfRecord} is the seller of record, issues your invoice, collects and remits applicable
        taxes, and holds your card details. nvault never sees or stores card data. {legalConfig.merchantOfRecord}&apos;s
        own{" "}
        <a href={legalConfig.merchantOfRecordTerms} target="_blank" rel="noopener noreferrer">
          terms and refund handling
        </a>{" "}
        apply to the payment transaction in addition to this policy.
      </p>

      <h2>3. Cancelling a subscription</h2>
      <ul>
        <li>
          <strong>Pro:</strong> cancel any time from <em>Settings → Billing</em> in the app, which opens the
          customer portal. Your Pro features remain active until the end of the current billing period; you are not
          charged again.
        </li>
        <li>
          <strong>Team:</strong> the organization owner can cancel from the organization&apos;s billing page. The
          organization keeps Team features until the end of the current period, then becomes read-only (existing files
          can still be pulled; new pushes and new projects are blocked) until a subscription is started again.
        </li>
        <li>Cancelling stops future renewals. It does not, by itself, trigger a refund of the current period.</li>
        <li>You can also cancel by emailing <a href={`mailto:${legalConfig.supportEmail}`}>{legalConfig.supportEmail}</a>.</li>
      </ul>

      <h2>4. Refunds</h2>
      <p>We want you to be happy with nvault. Refunds are issued as follows:</p>
      <ul>
        <li>
          <strong>14-day goodwill refund.</strong> If you are dissatisfied for any reason, contact us within 14 days of
          your first payment or of a renewal and we will refund that payment in full.
        </li>
        <li>
          <strong>Service failure.</strong> If a confirmed, prolonged fault on our side prevented you from using a paid
          feature, we will refund a pro-rata amount for the affected period.
        </li>
        <li>
          <strong>Accidental or duplicate charges</strong> are refunded in full on request.
        </li>
        <li>
          <strong>Downgrades and tier changes</strong> for Team are prorated automatically by{" "}
          {legalConfig.merchantOfRecord}; you are credited or charged the difference.
        </li>
      </ul>
      <p>
        Outside the situations above, payments for a billing period already in progress are generally non-refundable,
        because the service was available to you throughout that period. This does not affect any non-waivable rights
        you have under the Consumer Protection Act, 2019 or other mandatory consumer law that applies to you.
      </p>

      <h2>5. What is never refundable</h2>
      <ul>
        <li>Loss of access caused by a forgotten vault passphrase — the zero-knowledge design means we never held it.</li>
        <li>Charges older than 12 months.</li>
        <li>Fees where the account was terminated for breach of the <a href="/terms">Terms of Service</a> or the <a href="/acceptable-use">Acceptable Use Policy</a>.</li>
      </ul>

      <h2>6. How to request a refund</h2>
      <p>Email <a href={`mailto:${legalConfig.supportEmail}`}>{legalConfig.supportEmail}</a> from your account email address with:</p>
      <ul>
        <li>the account or organization name;</li>
        <li>the approximate date and amount of the charge;</li>
        <li>a short description of the reason.</li>
      </ul>
      <p>
        We acknowledge refund requests within 2 business days and, where approved, {legalConfig.merchantOfRecord}{" "}
        processes the refund to your original payment method. Banks typically take 5–10 business days to post it.
      </p>

      <h2>7. Chargebacks</h2>
      <p>
        If you believe a charge is wrong, please contact us first — we can almost always resolve it faster than a bank
        dispute. Accounts with an unresolved chargeback may be suspended pending resolution.
      </p>

      <h2>8. Contact</h2>
      <p>
        Billing questions: <a href={`mailto:${legalConfig.supportEmail}`}>{legalConfig.supportEmail}</a>. If a refund
        request is declined and you disagree, reply to that thread and we will review it again; you can also raise the
        dispute with our Merchant of Record, {legalConfig.merchantOfRecord}, who issued your invoice.
      </p>
    </LegalPage>
  );
}
