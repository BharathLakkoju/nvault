import { sortByDateDesc, type BlogPost } from "@/lib/blog";

import { post as whyWeBuiltNvault } from "./why-we-built-nvault";
import { post as theRealCostOfALeakedEnvFile } from "./the-real-cost-of-a-leaked-env-file";
import { post as howNvaultWorks } from "./how-nvault-works";
import { post as zeroKnowledgeEncryptionExplained } from "./zero-knowledge-encryption-explained";
import { post as clientSideVsServerSideEncryption } from "./client-side-vs-server-side-encryption";
import { post as defenseInDepthEnvelopeEncryption } from "./defense-in-depth-envelope-encryption";
import { post as versioningEnvironmentFiles } from "./versioning-environment-files";
import { post as whyWeNeverParseYourEnvFile } from "./why-we-never-parse-your-env-file";
import { post as theCliIsAProduct } from "./the-cli-is-a-product";
import { post as deviceAuthorizationLogin } from "./device-authorization-login";
import { post as projectDetectionFromGit } from "./project-detection-from-git";
import { post as ourThreatModel } from "./our-threat-model";
import { post as roadmapNvaultRun } from "./roadmap-nvault-run";

/** All posts, newest first. */
export const posts: readonly BlogPost[] = sortByDateDesc([
  whyWeBuiltNvault,
  theRealCostOfALeakedEnvFile,
  howNvaultWorks,
  zeroKnowledgeEncryptionExplained,
  clientSideVsServerSideEncryption,
  defenseInDepthEnvelopeEncryption,
  versioningEnvironmentFiles,
  whyWeNeverParseYourEnvFile,
  theCliIsAProduct,
  deviceAuthorizationLogin,
  projectDetectionFromGit,
  ourThreatModel,
  roadmapNvaultRun,
]);

export function getPost(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}

/** The N posts nearest in date to `slug`, excluding it — for "related reading". */
export function relatedPosts(slug: string, count = 3): BlogPost[] {
  return posts.filter((p) => p.slug !== slug).slice(0, count);
}
