import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/lib/seo";
import { legalConfig } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Acceptable Use Policy",
  description: "What you may and may not do with nvault, and how we respond to abuse.",
  path: "/acceptable-use",
});

export default function AcceptableUsePage() {
  return (
    <LegalPage
      title="Acceptable Use Policy"
      path="/acceptable-use"
      intro="This policy is part of the Terms of Service. It applies to everyone who uses nvault, on any plan."
    >
      <h2>1. Prohibited content</h2>
      <p>Do not use nvault to store, transmit or back up:</p>
      <ul>
        <li>content you do not own or have permission to store;</li>
        <li>material that infringes intellectual-property or privacy rights;</li>
        <li>malware, exploit kits, or credentials obtained through unauthorised access;</li>
        <li>content that is unlawful in India or in your jurisdiction, including child sexual abuse material;</li>
        <li>content whose storage would violate export-control or sanctions law.</li>
      </ul>

      <h2>2. Prohibited conduct</h2>
      <ul>
        <li>Probing, scanning or testing the security of the Service without our prior written consent.</li>
        <li>Attempting to access another account, organization, project or file that is not yours.</li>
        <li>Circumventing plan limits, rate limits, or authentication.</li>
        <li>Reverse-engineering the Service except to the extent that restriction is prohibited by law.</li>
        <li>Automated use that degrades the Service for others, or using it as a general-purpose file host or CDN.</li>
        <li>Reselling or sublicensing access without our written agreement.</li>
        <li>Using the Service to send spam or to harass any person.</li>
      </ul>

      <h2>3. Fair use of resources</h2>
      <p>
        nvault is designed for environment and configuration files. Uploads are subject to per-file and per-account
        size limits enforced by the API. Do not use the vault to store large binaries, media libraries or backups
        unrelated to project configuration.
      </p>

      <h2>4. Security research</h2>
      <p>
        We welcome good-faith vulnerability reports. If you follow coordinated disclosure and email{" "}
        <a href={`mailto:${legalConfig.securityEmail}`}>{legalConfig.securityEmail}</a> before sharing details publicly,
        we will not pursue action against you for testing that is limited to your own account and does not access,
        modify or destroy other users&apos; data or degrade the Service.
      </p>

      <h2>5. Reporting abuse</h2>
      <p>
        Report content or behaviour that violates this policy to{" "}
        <a href={`mailto:${legalConfig.supportEmail}`}>{legalConfig.supportEmail}</a>. Please include enough detail to
        identify the account or content and the reason it is objectionable or unlawful. We aim to acknowledge reports
        within a few days and to act on clearly unlawful content promptly once verified.
      </p>

      <h2>6. Enforcement</h2>
      <p>
        Depending on severity, we may warn you, remove or disable access to specific content, suspend or terminate the
        account or organization, and report unlawful activity to the authorities. Where practicable we give notice and
        an opportunity to remedy the issue; we may act immediately where there is a risk of harm, legal exposure or
        ongoing abuse. Because content is encrypted, enforcement is generally triggered by a report or legal process
        rather than by us inspecting content.
      </p>

      <h2>7. Changes</h2>
      <p>We may update this policy; material changes are announced in the app or by email.</p>
    </LegalPage>
  );
}
