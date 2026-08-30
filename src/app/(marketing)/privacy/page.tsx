import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/lib/seo";
import { legalConfig } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How nvault handles your data. Because the vault is zero-knowledge, we cannot access your file contents or your vault passphrase. Covers the DPDP Act, GDPR and CCPA.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      path="/privacy"
      intro="This policy explains what personal data nvault collects, why, how long it is kept, and the rights you have over it. It is written to match how the product actually works: a zero-knowledge vault in which encryption happens in your browser."
    >
      <h2>1. Who we are</h2>
      <p>
        nvault (&quot;nvault&quot;, &quot;we&quot;, &quot;us&quot;) is operated by {legalConfig.operatorName},{" "}
        {legalConfig.operatorDescriptor}. nvault is currently an independent project, not a registered company. For the
        purposes of the Digital Personal Data Protection Act, 2023 (&quot;DPDP Act&quot;) we are the{" "}
        <strong>Data Fiduciary</strong>; for the purposes of the EU/UK General Data Protection Regulation
        (&quot;GDPR&quot;) we are the <strong>data controller</strong> for account data and the{" "}
        <strong>data processor</strong> for the file content you store.
      </p>
      <p>
        Data-protection contact and point of contact for questions or complaints about our processing of your
        personal data: <a href={`mailto:${legalConfig.privacyEmail}`}>{legalConfig.privacyEmail}</a>.
      </p>

      <h2>2. What we cannot see</h2>
      <ul>
        <li>The plaintext contents of any file you store.</li>
        <li>Your vault passphrase, which is never transmitted to us.</li>
        <li>The key material required to decrypt your files.</li>
      </ul>
      <p>
        Files reach our servers already encrypted and are stored only as ciphertext. See the{" "}
        <a href="/security">security page</a> for the full model.
      </p>

      <h2>3. Personal data we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> your email address, an optional display name, and a hashed account password.
        </li>
        <li>
          <strong>Vault metadata:</strong> project names, file names, version timestamps and sizes, and the wrapped
          (encrypted) keys needed for your own client to decrypt.
        </li>
        <li>
          <strong>Organization data (Team plan):</strong> organization name, membership list, roles, and the
          organization&apos;s public enrollment/roster keys.
        </li>
        <li>
          <strong>Session and device data:</strong> active browser sessions and CLI tokens, their creation and
          last-seen time, IP address and user-agent, so you can review and revoke them.
        </li>
        <li>
          <strong>Billing data:</strong> if you subscribe to a paid plan, a subscription identifier, plan, tier and
          status. Payment card details are collected and stored by our Merchant of Record ({legalConfig.merchantOfRecord}
          ), not by us — see the <a href="/refunds">Refunds &amp; Cancellation Policy</a>.
        </li>
        <li>
          <strong>Audit records:</strong> timestamps and types of security-sensitive actions (login, key rotation,
          file deletion, membership changes). These never contain secret values.
        </li>
        <li>
          <strong>Operational logs:</strong> minimal request metadata for reliability and abuse prevention. We do not
          log environment variables, keys, tokens or passwords.
        </li>
        <li>
          <strong>Support correspondence:</strong> the content of emails you send us.
        </li>
      </ul>
      <p>We do not use third-party analytics, advertising or tracking scripts. We do not buy or sell personal data.</p>

      <h2>4. Why we process it, and our legal basis</h2>
      <ul>
        <li>
          <strong>To provide the service</strong> — authentication, storage, versioning, restore and organization
          management. Legal basis: performance of a contract (GDPR Art. 6(1)(b)); necessary for providing a service you
          requested (DPDP Act &sect; 7).
        </li>
        <li>
          <strong>To secure accounts and prevent abuse</strong> — session management, rate limiting, audit logging.
          Legal basis: legitimate interests (GDPR Art. 6(1)(f)); legitimate use (DPDP Act).
        </li>
        <li>
          <strong>To take payment</strong> for paid plans. Legal basis: performance of a contract.
        </li>
        <li>
          <strong>To comply with law</strong> and respond to valid legal requests. Legal basis: legal obligation.
        </li>
        <li>
          <strong>To respond to your support requests.</strong> Legal basis: legitimate interests / consent.
        </li>
      </ul>

      <h2>5. Sub-processors and international transfers</h2>
      <p>
        We use a small number of infrastructure providers to host the application, store encrypted data, send
        transactional email and process payments. They act on our instructions under contractual security and
        confidentiality obligations and do not receive plaintext file contents or your passphrase. The current list is
        on the <a href="/subprocessors">Sub-processors</a> page.
      </p>
      <p>
        Some providers are located outside India, the EU and the UK. Where personal data is transferred across borders
        it is protected by the provider&apos;s contractual commitments (including Standard Contractual Clauses where
        applicable) and by the fact that file content is transferred only as ciphertext.
      </p>

      <h2>6. Data retention</h2>
      <ul>
        <li>Vault data (encrypted blobs and metadata) is retained while your account is active.</li>
        <li>
          Deleting a file, version, project or organization removes it from active storage. Encrypted backups roll off
          within 30 days.
        </li>
        <li>
          When you close your account we delete your vault data and account data within 30 days, except where we must
          retain limited records to comply with law, resolve disputes or enforce our agreements.
        </li>
        <li>Audit and security logs are retained for up to 12 months.</li>
        <li>Billing records are retained for the period required by applicable tax and accounting law.</li>
      </ul>

      <h2>7. Your rights</h2>
      <p>Subject to verification of your identity, you can:</p>
      <ul>
        <li>access the personal data we hold about you and get a copy;</li>
        <li>correct or update inaccurate data (much of this is editable in the app);</li>
        <li>delete your data by deleting projects and then your account, or by contacting us;</li>
        <li>export your data — you can download your files and their history at any time from the app;</li>
        <li>withdraw consent where processing is based on consent;</li>
        <li>object to or restrict certain processing, and (GDPR) request data portability;</li>
        <li>
          nominate another individual to exercise these rights on your behalf in the event of death or incapacity
          (DPDP Act &sect; 14);
        </li>
        <li>
          complain to a supervisory authority — the Data Protection Board of India, or your local EU/UK authority.
        </li>
      </ul>
      <p>
        Because the vault is zero-knowledge, we cannot recover, produce or correct plaintext we never had. To exercise
        a right, email <a href={`mailto:${legalConfig.privacyEmail}`}>{legalConfig.privacyEmail}</a>. We respond within
        30 days.
      </p>

      <h2>8. California residents (CCPA/CPRA)</h2>
      <p>
        In the past 12 months we have collected the categories of personal information described in section 3
        (identifiers, account and commercial information, internet activity limited to the service, and the contents
        of your communications with us). We do not &quot;sell&quot; or &quot;share&quot; personal information as those
        terms are defined by the CPRA, and we do not use sensitive personal information for purposes beyond providing
        the service. You have the right to know, delete, correct and limit, and not to be discriminated against for
        exercising those rights.
      </p>

      <h2>9. Children</h2>
      <p>
        nvault is a developer tool and is not directed at children. We do not knowingly process the personal data of
        anyone under 18. If you believe a child has provided us data, contact us and we will delete it.
      </p>

      <h2>10. Security</h2>
      <p>
        We apply reasonable security practices and procedures as required by the SPDI Rules, 2011 and the DPDP Act:
        client-side AES-256-GCM encryption, a server-side envelope-encryption layer, hashed passwords, scoped access
        tokens, least-privilege authorization checks on every request, and audit logging. No system is perfectly
        secure; you are responsible for your account credentials and your vault passphrase.
      </p>

      <h2>11. Breach notification</h2>
      <p>
        If a personal data breach affecting you occurs, we will notify you and the Data Protection Board of India (and
        other regulators where required) without undue delay and in line with applicable law.
      </p>

      <h2>12. Changes</h2>
      <p>
        We may update this policy as the product evolves. Material changes will be announced in the app or by email,
        and the effective date above will change.
      </p>

      <h2>13. Contact</h2>
      <p>
        Privacy questions: <a href={`mailto:${legalConfig.privacyEmail}`}>{legalConfig.privacyEmail}</a>. Operated from{" "}
        {legalConfig.operatorLocation}. If you require a postal address for a formal legal notice, request one at that
        email and we will provide it.
      </p>
    </LegalPage>
  );
}
