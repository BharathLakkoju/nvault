import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/lib/seo";
import { legalConfig } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Data Processing Addendum",
  description:
    "nvault's processor terms for organizations: roles, security measures, sub-processing, international transfers, breach notification and audit.",
  path: "/dpa",
});

export default function DpaPage() {
  return (
    <LegalPage
      title="Data Processing Addendum"
      path="/dpa"
      intro="This Addendum applies where nvault processes personal data on behalf of a customer (a “Controller”), typically an organization on the Team plan. It forms part of the Terms of Service. Where it conflicts with the Terms on data protection, this Addendum prevails."
    >
      <h2>1. Roles</h2>
      <p>
        For account and organization metadata, the customer is the <strong>Controller / Data Fiduciary</strong> and
        nvault is the <strong>Processor / Data Processor</strong>. For the contents of files stored in the vault, nvault
        acts purely as a processor of ciphertext and has no ability to access the plaintext.
      </p>

      <h2>2. Subject matter and duration</h2>
      <p>
        Processing continues for as long as the customer uses the service and for the retention periods stated in the{" "}
        <a href="/privacy">Privacy Policy</a>. The subject matter is the provision of a zero-knowledge configuration
        vault.
      </p>

      <h2>3. Nature and purpose of processing</h2>
      <p>
        Storage, versioning, transmission, backup and restoration of encrypted files; authentication; organization and
        membership management; billing; security monitoring and audit logging.
      </p>

      <h2>4. Categories of data and data subjects</h2>
      <ul>
        <li>
          <strong>Data subjects:</strong> the customer&apos;s personnel who hold accounts or organization memberships.
        </li>
        <li>
          <strong>Personal data:</strong> names, email addresses, hashed passwords, session/device records, roles,
          audit events. Any personal data the customer places inside a stored file is encrypted client-side and is
          opaque to nvault.
        </li>
        <li>nvault does not require or want special-category data in account metadata.</li>
      </ul>

      <h2>5. Processor obligations</h2>
      <ul>
        <li>Process personal data only on the customer&apos;s documented instructions, including for transfers, unless required by law.</li>
        <li>Ensure personnel with access are bound by confidentiality.</li>
        <li>Implement the technical and organisational measures in section 7.</li>
        <li>Assist the customer, taking into account the nature of processing, with data-subject requests and with DPIAs and prior-consultation obligations.</li>
        <li>Make available information necessary to demonstrate compliance and allow for reasonable audits (section 9).</li>
        <li>On termination, delete or return personal data as described in the Privacy Policy.</li>
      </ul>

      <h2>6. Sub-processing</h2>
      <p>
        The customer authorises the sub-processors listed at <a href="/subprocessors">/subprocessors</a>. nvault
        imposes data-protection obligations on each sub-processor no less protective than this Addendum and remains
        responsible for their performance. nvault will give at least 30 days&apos; notice of a new sub-processor, during
        which the customer may object on reasonable data-protection grounds.
      </p>

      <h2>7. Security measures</h2>
      <ul>
        <li>Client-side AES-256-GCM encryption of file contents before upload; the server stores ciphertext only.</li>
        <li>A server-side envelope-encryption layer over stored blobs, keyed outside the database.</li>
        <li>Key hierarchy derived from a user passphrase that is never transmitted (see the <a href="/security">security page</a>).</li>
        <li>Passwords stored using a memory-hard hash; scoped, short-lived access tokens; session and device revocation.</li>
        <li>Authorization checks on every project, file, version and organization operation; non-guessable identifiers.</li>
        <li>Encryption in transit (TLS); strict transport security and a restrictive content-security policy.</li>
        <li>Audit logging of security-sensitive actions without secret values; least-privilege operational access.</li>
      </ul>

      <h2>8. Personal data breach</h2>
      <p>
        nvault will notify the customer without undue delay after becoming aware of a personal data breach affecting
        the customer&apos;s data, with the information the customer reasonably needs to meet its own notification
        obligations, and will cooperate on remediation.
      </p>

      <h2>9. Audit</h2>
      <p>
        On reasonable written request, no more than once per year (or after a breach), nvault will provide relevant
        documentation and respond to a security questionnaire. On-site audits, where required by law, are by prior
        appointment, subject to confidentiality, and at the requesting party&apos;s cost.
      </p>

      <h2>10. International transfers</h2>
      <p>
        Where nvault or its sub-processors transfer personal data across borders, the transfer relies on an adequacy
        decision or on Standard Contractual Clauses (or the UK IDTA / Addendum), which are incorporated by reference.
        File contents are transferred only as ciphertext.
      </p>

      <h2>11. Liability and precedence</h2>
      <p>
        Each party&apos;s liability under this Addendum is subject to the limitations in the Terms of Service. This
        Addendum does not grant the customer rights beyond those in applicable data-protection law.
      </p>

      <h2>12. Requesting a signed copy</h2>
      <p>
        Organizations that need a countersigned DPA can email{" "}
        <a href={`mailto:${legalConfig.privacyEmail}`}>{legalConfig.privacyEmail}</a> from an authorised address.
      </p>
    </LegalPage>
  );
}
