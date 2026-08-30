import Link from "next/link";
import { LogoMark } from "@/components/marketing/logo";
import { footerNav, legalConfig, siteConfig } from "@/lib/site";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <Link href="/" className="focus-ring inline-flex items-center gap-2 rounded font-semibold tracking-tight">
            <LogoMark />
            <span className="text-slate-900 dark:text-slate-100">nvault</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-slate-500 dark:text-slate-400">{siteConfig.tagline}</p>
        </div>

        {footerNav.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{group.title}</h3>
            <ul className="mt-3 space-y-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="focus-ring rounded text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 dark:text-slate-400 sm:px-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {year} {legalConfig.operatorName}. An independent project — {legalConfig.operatorLocation}.
            </p>
            <p className="flex flex-wrap gap-x-3">
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="focus-ring rounded hover:text-slate-900 dark:hover:text-slate-100"
              >
                {siteConfig.contactEmail}
              </a>
              <Link href="/legal" className="focus-ring rounded hover:text-slate-900 dark:hover:text-slate-100">
                Legal
              </Link>
            </p>
          </div>
          {legalConfig.operatorAddress ? <p>{legalConfig.operatorAddress}</p> : null}
        </div>
      </div>
    </footer>
  );
}
