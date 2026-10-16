/** Isolated UI prototype: no persistence, account, business Actions or database. */
export const IDEA_MODULES = ["wallet", "transfer", "browser", "other"] as const;
export const IDEA_STATES = ["inbox", "evaluating", "planned", "building", "done", "needsInfo", "declined"] as const;
export const IDEA_MARKS = ["none", "research", "needsInfo", "featured"] as const;
export type IdeaModule = typeof IDEA_MODULES[number];
export type IdeaState = typeof IDEA_STATES[number];
export type IdeaMark = typeof IDEA_MARKS[number];
export interface DemoIdea {
  id: string; seed?: string; title?: string; description?: string; author: string;
  createdAt: string; module: IdeaModule; status: IdeaState; mark: IdeaMark; voters: string[];
  revisions: { title: string; description: string; module: IdeaModule; status: IdeaState; mark: IdeaMark }[];
}
export interface IdeaComment {
  id: string; ideaId: string; parent?: string; seed?: string; body?: string; author: string;
  voters: string[]; mark: IdeaMark; revisions: { body: string; mark: IdeaMark }[];
}
export interface IdeaMerge { source: string; target: string }
export interface CooperationDemo { ideas: DemoIdea[]; comments: IdeaComment[]; merges: IdeaMerge[] }
export const VIEWER = "you";
export function initialCooperationDemo(): CooperationDemo {
  const seeds: [string, IdeaModule, IdeaState, string[]][] = [
    ["simulation", "transfer", "evaluating", ["lin", "moss", "river"]],
    ["preview", "transfer", "inbox", ["lin", "summer"]],
    ["addresses", "wallet", "planned", ["river", "summer"]],
    ["permissions", "browser", "building", ["moss"]],
    ["networks", "wallet", "done", ["lin", "river"]],
  ];
  return {
    ideas: seeds.map(([id, module, status, voters], index) => ({ id, seed: id, author: index % 2 ? "summer" : "lin", createdAt: `2026-10-${String(10 + index).padStart(2, "0")}T02:00:00Z`, module, status, mark: "none", voters, revisions: [] })),
    comments: [
      { id: "c1", ideaId: "simulation", seed: "scenario", author: "river", voters: ["moss"], mark: "none", revisions: [] },
      { id: "c2", ideaId: "simulation", parent: "c1", seed: "reply", author: "lin", voters: [], mark: "none", revisions: [] },
      { id: "c3", ideaId: "preview", seed: "preview", author: "summer", voters: ["river"], mark: "none", revisions: [] },
    ], merges: [],
  };
}
export function ideaGroup(data: CooperationDemo, id: string): string[] {
  const root = data.merges.find((merge) => merge.source === id)?.target ?? id;
  return [root, ...data.merges.filter((merge) => merge.target === root).map((merge) => merge.source)];
}
export function ideaVoters(data: CooperationDemo, id: string): string[] {
  const ids = ideaGroup(data, id);
  return [...new Set(data.ideas.filter((idea) => ids.includes(idea.id)).flatMap((idea) => idea.voters))];
}
export function setIdeaVote(data: CooperationDemo, id: string, supported: boolean): CooperationDemo {
  const ids = ideaGroup(data, id);
  // Cancellation is applied to every origin so unmerging cannot revive a removed vote.
  return { ...data, ideas: data.ideas.map((idea) => !ids.includes(idea.id) ? idea : { ...idea, voters: supported && idea.id === ids[0] ? [...new Set([...idea.voters, VIEWER])] : supported ? idea.voters : idea.voters.filter((voter) => voter !== VIEWER) }) };
}
export function mergePair(data: CooperationDemo, first: string, second: string): CooperationDemo {
  if (first === second || data.merges.some((merge) => [merge.source, merge.target].some((id) => id === first || id === second))) return data;
  const pair = data.ideas.filter((idea) => idea.id === first || idea.id === second).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  if (pair.length !== 2) return data;
  // Originals remain intact. The merged view derives votes/comments from both origins.
  return { ...data, merges: [...data.merges, { target: pair[0].id, source: pair[1].id }] };
}
export function undoMerge(data: CooperationDemo, target: string): CooperationDemo {
  return { ...data, merges: data.merges.filter((merge) => merge.target !== target) };
}
