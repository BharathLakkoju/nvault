import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/lib/seo";
import { legalConfig } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service",
  description: "The terms under which you may use nvault, including subscriptions, acceptable use, liability and governing law.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      path="/terms"
      intro="By creating an account or using nvault (the “Service”) you agree to these terms. If you do not agree, do not use the Service."
    >
      <h2>1. Who you are contracting with</h2>
      <p>
        The Service is provided by {legalConfig.operatorName}, {legalConfig.operatorDescriptor}. nvault is operated as
        {" "}
        {legalConfig.operatorType} and is not a registered company. References to &quot;nvault&quot;, &quot;we&quot; or
        &quot;us&quot; mean that individual.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 18 years old and able to form a binding contract in your jurisdiction. If you use the
        Service on behalf of an organization, you represent that you are authorised to bind that organization to these
        terms.
      </p>

      <h2>3. Early access</h2>
      <p>
        The Service is provided during an early-access period. Features may change, and the Service is provided on an
        &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind, to the fullest extent
        permitted by law.
      </p>

      <h2>4. Your account</h2>
      <ul>
        <li>You are responsible for all activity under your account and for keeping your credentials secure.</li>
        <li>
          You are solely responsible for your vault passphrase. Because the Service is zero-knowledge, we cannot reset
          it or recover data encrypted under it. Loss of the passphrase means permanent loss of access to that data.
        </li>
        <li>You must provide accurate account information and keep it current.</li>
        <li>Notify us promptly of any unauthorised use at <a href={`mailto:${legalConfig.securityEmail}`}>{legalConfig.securityEmail}</a>.</li>
      </ul>

      <h2>5. Acceptable use</h2>
      <p>
        Your use of the Service is subject to the <a href="/acceptable-use">Acceptable Use Policy</a>, which is
        incorporated into these terms. In summary, you must not store content you have no right to store, probe or
        attack the Service or other accounts, or use the Service to distribute malware or conduct abuse.
      </p>

      <h2>6. Your content</h2>
      <p>
        You retain all rights to the files and data you store (&quot;Your Content&quot;). You grant us only the limited,
        worldwide, non-exclusive licence needed to store, transmit, back up and return encrypted blobs and metadata so
        the Service can function. We claim no other rights in Your Content.
      </p>

      <h2>7. Plans, billing and taxes</h2>
      <ul>
        <li>
          The Free plan is offered at no charge and with the limits described on the{" "}
          <a href="/pricing">pricing page</a>. Paid plans (Pro and Team) are billed in advance on a recurring basis
          until cancelled.
        </li>
        <li>
          Payments are processed by our Merchant of Record, {legalConfig.merchantOfRecord} (
          <a href={legalConfig.merchantOfRecordUrl} target="_blank" rel="noopener noreferrer">
            {legalConfig.merchantOfRecordUrl.replace("https://", "")}
          </a>
          ). {legalConfig.merchantOfRecord} is the seller of record for your purchase, handles billing and card data,
          and collects and remits applicable taxes (including GST/VAT/sales tax). Their{" "}
          <a href={legalConfig.merchantOfRecordTerms} target="_blank" rel="noopener noreferrer">
            terms
          </a>{" "}
          also apply to the payment transaction. nvault never receives or stores your card details.
        </li>
        <li>
          Cancellations and refunds are governed by the <a href="/refunds">Refunds &amp; Cancellation Policy</a>.
        </li>
        <li>
          We may change plan pricing or limits with at least 30 days&apos; notice; changes take effect at your next
          renewal.
        </li>
        <li>
          If a Team (organization) subscription lapses, the organization becomes read-only until it is renewed. Data is
          not deleted for non-payment.
        </li>
      </ul>

      <h2>8. Organizations</h2>
      <p>
        An organization owner is responsible for their organization&apos;s subscription, for managing membership and
        roles, and for the conduct of members within the organization. Members&apos; access is controlled by the
        organization&apos;s key roster; removing a member does not retroactively re-encrypt data the member could
        previously access, so rotate credentials that were shared while they were a member.
      </p>

      <h2>9. Availability and data</h2>
      <p>
        We aim for high availability but do not guarantee uninterrupted service. You are responsible for keeping your
        own backups of critical configuration. We are not liable for loss of data resulting from a lost passphrase, or
        from your failure to maintain independent backups.
      </p>

      <h2>10. Intellectual property</h2>
      <p>
        The Service, including its software, design and documentation, is owned by {legalConfig.operatorName} and
        protected by law. These terms grant you no rights in our trademarks or branding. The nvault CLI is published
        under its own licence as stated in its repository.
      </p>

      <h2>11. Third-party components</h2>
      <p>
        The Service relies on third-party infrastructure listed on the <a href="/subprocessors">Sub-processors</a>{" "}
        page. We are not responsible for third-party services you choose to connect or for outages originating with
        those providers.
      </p>

      <h2>12. Suspension and termination</h2>
      <ul>
        <li>You may stop using the Service and delete your account at any time.</li>
        <li>
          We may suspend or terminate access, with notice where practicable, for a material or repeated breach of
          these terms or the Acceptable Use Policy, for non-payment, or where required by law.
        </li>
        <li>On termination, the licence in section 6 ends and we delete data as described in the Privacy Policy.</li>
      </ul>

      <h2>13. Disclaimers</h2>
      <p>
        To the maximum extent permitted by law, the Service is provided without warranties of any kind, express or
        implied, including merchantability, fitness for a particular purpose, and non-infringement. We do not warrant
        that the Service will be error-free or that stored data can never be lost.
      </p>

      <h2>14. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, {legalConfig.operatorName} is not liable for indirect, incidental,
        special, consequential or exemplary damages, or for loss of data, profits, revenue or goodwill, arising from or
        related to the Service. Our total aggregate liability for any claim is limited to the amount you paid us for
        the Service in the 12 months before the event giving rise to the claim, or INR 5,000 if you are on the Free
        plan. Nothing in these terms excludes liability that cannot be excluded under applicable law.
      </p>

      <h2>15. Indemnity</h2>
      <p>
        You will indemnify {legalConfig.operatorName} against third-party claims arising from Your Content or from your
        breach of these terms or the Acceptable Use Policy, except to the extent the claim results from our own
        wrongdoing.
      </p>

      <h2>16. Governing law and disputes</h2>
      <p>
        These terms are governed by {legalConfig.governingLaw}, without regard to conflict-of-laws rules. Subject to
        the paragraph below, the courts at {legalConfig.jurisdictionCity}, {legalConfig.jurisdictionState},
        {legalConfig.jurisdictionCountry} have exclusive jurisdiction. If you are a consumer resident elsewhere,
        mandatory consumer-protection laws and the courts of your place of residence may also be available to you.
      </p>
      <p>
        The parties will first attempt to resolve any dispute informally by contacting{" "}
        <a href={`mailto:${legalConfig.supportEmail}`}>{legalConfig.supportEmail}</a>. A dispute not resolved within
        30 days may be referred to arbitration by a sole arbitrator under the Arbitration and Conciliation Act, 1996,
        seated in {legalConfig.jurisdictionCity}, conducted in English.
      </p>

      <h2>17. Changes to these terms</h2>
      <p>
        We may update these terms as the Service evolves. We will announce material changes in the app or by email.
        Continued use after a change takes effect constitutes acceptance of the updated terms.
      </p>

      <h2>18. Contact</h2>
      <p>
        Questions or complaints about these terms or the Service:{" "}
        <a href={`mailto:${legalConfig.supportEmail}`}>{legalConfig.supportEmail}</a>. Data-protection matters:{" "}
        <a href={`mailto:${legalConfig.privacyEmail}`}>{legalConfig.privacyEmail}</a>.
      </p>
    </LegalPage>
  );
}
