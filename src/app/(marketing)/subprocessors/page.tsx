import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/lib/seo";
import { legalConfig, subprocessors } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Sub-processors",
  description:
    "The infrastructure providers that process encrypted data and account metadata on nvault's behalf. File contents are only ever transferred as ciphertext.",
  path: "/subprocessors",
});

export default function SubprocessorsPage() {
  return (
    <LegalPage
      title="Sub-processors"
      path="/subprocessors"
      intro="nvault engages the third parties below to help deliver the service. Each is bound by contractual security and confidentiality obligations. None receives plaintext file contents or your vault passphrase — file data crosses these systems only as ciphertext."
    >
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Purpose</th>
            <th>Data processed</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {subprocessors.map((s) => (
            <tr key={s.name}>
              <td>{s.name}</td>
              <td>{s.purpose}</td>
              <td>{s.data}</td>
              <td>{s.location}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Changes and notice</h2>
      <p>
        We keep this list current. Organizations on the Team plan can request advance email notice of new
        sub-processors by writing to <a href={`mailto:${legalConfig.privacyEmail}`}>{legalConfig.privacyEmail}</a>; we
        will give at least 30 days&apos; notice before a new sub-processor starts processing personal data, during
        which you may raise a reasonable objection.
      </p>

      <h2>Onward transfers</h2>
      <p>
        Where a sub-processor is outside India, the EU or the UK, transfers are covered by that provider&apos;s
        contractual safeguards (including Standard Contractual Clauses where applicable). See the{" "}
        <a href="/privacy">Privacy Policy</a> and <a href="/dpa">Data Processing Addendum</a> for details.
      </p>
    </LegalPage>
  );
}
