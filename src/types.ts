/** Domain model for the roadmap content. These types describe the JSON in src/data. */

export type Pace = "core" | "recommended" | "intensive";
export type Energy = "low" | "normal" | "deep";
export type ItemKind = "lesson" | "build" | "debug" | "project" | "review" | "quiz" | "consulting";
export type LessonStatus = "understood" | "revision" | "confused";
export type Confidence = 1 | 2 | 3 | 4 | 5;

export interface LearnRef {
  resId: string;
  focus: string;
  primary: boolean;
}

export interface BuildTask {
  task: string;
  steps: string[];
  hint?: string | null;
  code?: string | null;
}

export interface DebugMission {
  scenario: string;
  artifact?: string | null;
  hints: string[];
  solution: string;
}

export interface KeyConcept {
  term: string;
  def: string;
}

export interface Item {
  id: string;
  kind: ItemKind;
  title: string;
  time: number;
  difficulty: number;
  energy: Energy;
  pace: Pace;
  prereqs: string[];
  concept: string;
  why: string;
  learn: LearnRef[];
  build: BuildTask | null;
  challenge: string | null;
  debugMission: DebugMission | null;
  reflection: string[];
  done: string[];
  xp: number;
  keyConcepts: KeyConcept[];
  /** Model answer revealed after the learner attempts the task. */
  expert?: string | null;
  /** Links a lesson to a consulting case. */
  caseRef?: string | null;
}

export interface Day {
  id: string;
  day: number;
  title: string;
  items: Item[];
}

export type QuizQuestion =
  | { type: "mcq"; q: string; options: string[]; answer: number; explain: string }
  | { type: "short"; q: string; answer: string; keywords?: string[] };

export interface Quiz {
  id: string;
  title: string;
  passPct: number;
  questions: QuizQuestion[];
}

export interface Week {
  id: string;
  week: number;
  phase: number;
  phaseName: string;
  title: string;
  objective: string;
  narrative: string;
  whatYouCanBuild: string;
  whyProfessionally: string;
  days: Day[];
  quiz: Quiz;
}

export type ResourceType =
  | "docs" | "tutorial" | "video" | "article" | "repo" | "course" | "book" | "paper" | "tool";
export type ResourceCost = "free" | "paid" | "freemium";
export type VerifyStatus = "ok" | "moved" | "unchecked" | "broken";

export interface Resource {
  id: string;
  title: string;
  provider: string;
  type: ResourceType;
  url: string;
  minutes: number;
  cost: ResourceCost;
  verified: boolean;
  lastVerified: string | null;
  note: string;
  status: VerifyStatus;
}

export type SkillCategory =
  | "Python" | "Backend" | "APIs" | "Databases" | "LLMs" | "RAG" | "Agents"
  | "Evals" | "Security" | "Reliability" | "Cloud" | "System Design" | "Consulting";

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  blurb: string;
  icon: string;
  requires: string[];
  items: string[];
  evidence: { quiz: string | null; project: string | null; tickets: string[] };
}

export type ProjectTier = "mini" | "medium" | "capstone";
export type ProjectStatus = "not-started" | "building" | "shipped";

export interface ChecklistItem {
  id: string;
  label: string;
  hint: string;
}

export interface Project {
  id: string;
  name: string;
  tier: ProjectTier;
  week: number;
  blurb: string;
  itemIds: string[];
  stack: string[];
  portfolioWeight: number;
  checklist: ChecklistItem[];
}

export interface KnowledgeNode {
  id: string;
  label: string;
  group: SkillCategory;
  week: number;
}

export interface KnowledgeEdge {
  from: string;
  to: string;
  label: string;
}

export interface KnowledgeMap {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export interface PaceProfile {
  id: "minimum" | "recommended" | "intensive";
  name: string;
  hoursPerDay: number;
  blurb: string;
  includes: Pace[];
}

export interface Phase {
  n: number;
  name: string;
  weeks: number[];
  blurb: string;
}

export type InterviewTopic =
  | "python" | "apis" | "llms" | "rag" | "embeddings" | "agents" | "evals"
  | "databases" | "system-design" | "debugging" | "security" | "deployment";

export interface InterviewQuestion {
  id: string;
  topic: InterviewTopic;
  type: "flash" | "short" | "coding" | "architecture" | "scenario";
  difficulty: 1 | 2 | 3;
  q: string;
  answer: string;
  followup: string | null;
}

export interface CaseTask {
  id: string;
  name: string;
  prompt: string;
  expert: string;
}

export interface ConsultingCase {
  id: string;
  title: string;
  client: string;
  industry: string;
  brief: string;
  artifacts: string;
  tasks: CaseTask[];
  debrief: string;
}

export interface Ticket {
  id: string;
  title: string;
  severity: "P1" | "P2" | "P3";
  area: string;
  symptom: string;
  context: string;
  artifact: string;
  mission: string;
  hints: string[];
  resolution: string;
  lesson: string;
  time: number;
  difficulty: number;
  xp: number;
}

export interface Flashcard {
  id: string;
  topic: InterviewTopic;
  front: string;
  back: string;
}

export interface AssessmentArea {
  id: string;
  name: string;
  checks: string[];
  nextThirtyDays: string;
}

export interface Assessment {
  areas: AssessmentArea[];
}
