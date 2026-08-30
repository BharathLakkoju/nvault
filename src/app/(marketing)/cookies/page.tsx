import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/lib/seo";
import { legalConfig } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Cookie Policy",
  description:
    "nvault uses a small number of strictly-necessary cookies and no third-party tracking, advertising or analytics.",
  path: "/cookies",
});

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      path="/cookies"
      intro="nvault uses the minimum browser storage needed to keep you signed in and remember your display preferences. We do not use tracking, advertising or analytics cookies, and we load no third-party scripts."
    >
      <h2>1. Strictly-necessary cookies</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Purpose</th>
            <th>Type</th>
            <th>Retention</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>evrt</code>
            </td>
            <td>
              Holds your session refresh token so you stay signed in. <code>HttpOnly</code>, <code>Secure</code> in
              production, <code>SameSite=Lax</code>, and scoped to <code>/api/v1/auth</code> so it is only sent to the
              refresh and logout endpoints.
            </td>
            <td>First-party, essential</td>
            <td>Up to the session lifetime; cleared on logout</td>
          </tr>
        </tbody>
      </table>
      <p>
        These cookies are required for the app to function and cannot be switched off. They do not require consent
        under the GDPR&apos;s ePrivacy rules or comparable law because they are strictly necessary to deliver a service
        you have requested.
      </p>

      <h2>2. Local storage (not cookies)</h2>
      <p>
        The marketing site and app store two small preference values in your browser&apos;s <code>localStorage</code>:
        your theme (light / dark / system) and your accent colour. These never leave your device and are not sent to
        our servers.
      </p>

      <h2>3. What we do not use</h2>
      <ul>
        <li>No advertising or retargeting cookies.</li>
        <li>No third-party analytics (no Google Analytics, no product-analytics SDKs).</li>
        <li>No social-media pixels or embedded trackers.</li>
        <li>No cross-site tracking of any kind.</li>
      </ul>

      <h2>4. Payment pages</h2>
      <p>
        When you start a checkout you are taken to a page hosted by our Merchant of Record,{" "}
        {legalConfig.merchantOfRecord}. That page is governed by {legalConfig.merchantOfRecord}&apos;s own cookie and
        privacy notices.
      </p>

      <h2>5. Managing cookies</h2>
      <p>
        You can clear or block cookies in your browser settings, but blocking the <code>evrt</code> cookie will sign
        you out and prevent you from using the app.
      </p>

      <h2>6. Contact</h2>
      <p>
        Questions: <a href={`mailto:${legalConfig.privacyEmail}`}>{legalConfig.privacyEmail}</a>.
      </p>
    </LegalPage>
  );
}
