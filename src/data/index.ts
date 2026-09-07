import type {
  Assessment, ConsultingCase, Flashcard, InterviewQuestion, KnowledgeMap,
  PaceProfile, Phase, Project, Resource, Skill, Ticket, Week,
} from "../types";

import weeksJson from "./weeks.json";
import resourcesJson from "./resources.json";
import skillsJson from "./skills.json";
import projectsJson from "./projects.json";
import knowledgeMapJson from "./knowledgeMap.json";
import paceProfilesJson from "./paceProfiles.json";
import phasesJson from "./phases.json";
import interviewJson from "./interview.json";
import casesJson from "./cases.json";
import ticketsJson from "./tickets.json";
import flashdeckJson from "./flashdeck.json";
import assessmentJson from "./assessment.json";

/**
 * Content is authored as JSON and asserted into the domain types here. This is the
 * single place a cast happens: everything downstream is fully typed.
 */
export const weeks = weeksJson as unknown as Week[];
export const resources = resourcesJson as unknown as Resource[];
export const skills = skillsJson as unknown as Skill[];
export const projects = projectsJson as unknown as Project[];
export const knowledgeMap = knowledgeMapJson as unknown as KnowledgeMap;
export const paceProfiles = paceProfilesJson as unknown as PaceProfile[];
export const phases = phasesJson as unknown as Phase[];
export const interview = interviewJson as unknown as InterviewQuestion[];
export const cases = casesJson as unknown as ConsultingCase[];
export const tickets = ticketsJson as unknown as Ticket[];
export const flashdeck = flashdeckJson as unknown as Flashcard[];
export const assessment = assessmentJson as unknown as Assessment;

/** Flat lookup indices, built once at module load. */
export const allItems = weeks.flatMap((w) => w.days.flatMap((d) => d.items));

export const itemById = new Map(allItems.map((i) => [i.id, i]));
export const weekOfItem = new Map(
  weeks.flatMap((w) => w.days.flatMap((d) => d.items.map((i) => [i.id, w] as const))),
);
export const dayOfItem = new Map(
  weeks.flatMap((w) => w.days.flatMap((d) => d.items.map((i) => [i.id, d] as const))),
);
export const resourceById = new Map(resources.map((r) => [r.id, r]));
export const skillById = new Map(skills.map((s) => [s.id, s]));
export const projectById = new Map(projects.map((p) => [p.id, p]));
export const ticketById = new Map(tickets.map((t) => [t.id, t]));
export const caseById = new Map(cases.map((c) => [c.id, c]));

export const totalXp =
  allItems.reduce((s, i) => s + i.xp, 0) + tickets.reduce((s, t) => s + t.xp, 0);
