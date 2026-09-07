import { requireSession } from "@/lib/auth";
import { getProfile } from "@/lib/agents/context";
import { dec } from "@/lib/utils";
import { ProfileForm, type ProfileData, type Achievement, type PortfolioItem, type CaseStudy, type FaqItem } from "@/components/settings/profile-form";

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export default async function ProfileSettingsPage() {
  const user = await requireSession();
  const p = await getProfile(user.orgId);
  const initial: ProfileData = {
    companyName: p.companyName,
    tagline: p.tagline,
    services: p.services,
    strengths: p.strengths,
    weaknesses: p.weaknesses,
    capabilities: p.capabilities,
    priceRange: p.priceRange,
    minimumOrderPrice: dec(p.minimumOrderPrice),
    currency: p.currency,
    hourlyRate: p.hourlyRate === null ? null : dec(p.hourlyRate),
    achievements: arr<Achievement>(p.achievements),
    portfolio: arr<PortfolioItem>(p.portfolio),
    caseStudies: arr<CaseStudy>(p.caseStudies),
    differentiators: p.differentiators,
    languages: p.languages,
    availableHours: p.availableHours,
    typicalLeadTime: p.typicalLeadTime,
    staffCount: p.staffCount,
    techStack: p.techStack,
    pastProjects: arr<unknown>(p.pastProjects),
    faq: arr<FaqItem>(p.faq),
    forbiddenConditions: p.forbiddenConditions,
    excludeKeywords: p.excludeKeywords,
    priorityKeywords: p.priorityKeywords,
  };
  return <ProfileForm initial={initial} />;
}
