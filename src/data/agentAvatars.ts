import avatarLuca from "@/assets/agents/avatar-luca.png";
import avatarImane from "@/assets/agents/avatar-imane.png";
import avatarGigi from "@/assets/agents/avatar-gigi.png";
import avatarFelice from "@/assets/agents/avatar-felice.png";
import avatarRobin from "@/assets/agents/avatar-robin.png";
import avatarBruce from "@/assets/agents/avatar-bruce.png";
import avatarRenato from "@/assets/agents/avatar-renato.png";
import avatarCarlo from "@/assets/agents/avatar-carlo.png";
import avatarLeonardo from "@/assets/agents/avatar-leonardo.png";
import avatarGianfranco from "@/assets/agents/avatar-gianfranco.png";

export interface AgentAvatar {
  id: string;
  src: string;
  label: string;
  gender: "male" | "female";
}

export const AGENT_AVATARS: AgentAvatar[] = [
  { id: "luca", src: avatarLuca, label: "Luca", gender: "male" },
  { id: "imane", src: avatarImane, label: "Imane", gender: "female" },
  { id: "gigi", src: avatarGigi, label: "Gigi", gender: "male" },
  { id: "felice", src: avatarFelice, label: "Felice", gender: "female" },
  { id: "robin", src: avatarRobin, label: "Robin", gender: "male" },
  { id: "bruce", src: avatarBruce, label: "Bruce", gender: "male" },
  { id: "renato", src: avatarRenato, label: "Renato", gender: "female" },
  { id: "carlo", src: avatarCarlo, label: "Carlo", gender: "female" },
  { id: "leonardo", src: avatarLeonardo, label: "Leonardo", gender: "male" },
];

/**
 * Default avatar mapping per agent name.
 * Matches agent names (case-insensitive, partial match) to avatar images.
 */
const NAME_AVATAR_MAP: Record<string, string> = {
  luca: "luca",
  imane: "imane",
  gigi: "gigi",
  felice: "felice",
  robin: "robin",
  bruce: "bruce",
  renato: "renato",
  carlo: "carlo",
  leonardo: "leonardo",
  marco: "bruce", // fallback male
};

/**
 * Resolve avatar image src for an agent.
 * Priority: avatar_emoji field (if it's an avatar ID), name match, role default.
 */
export function resolveAgentAvatar(agentName: string, avatarEmoji?: string): string | null {
  // If avatar_emoji is actually an avatar ID
  if (avatarEmoji) {
    const byId = AGENT_AVATARS.find((a) => a.id === avatarEmoji);
    if (byId) return byId.src;
  }

  // Match by name
  const nameLower = agentName.toLowerCase();
  for (const [key, avatarId] of Object.entries(NAME_AVATAR_MAP)) {
    if (nameLower.includes(key)) {
      const avatar = AGENT_AVATARS.find((a) => a.id === avatarId);
      if (avatar) return avatar.src;
    }
  }

  return null;
}
