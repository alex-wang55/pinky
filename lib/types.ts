export type GoalType = "daily" | "count" | "weekly";
export type CheckStatus = "kept" | "broke" | "off";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  color: string;
  created_at?: string;
};

export type Pact = {
  id: string;
  name: string;
  emoji: string;
  rules: string | null;
  goal_type: GoalType;
  target: number | null;
  unit: string | null;
  stake_cents: number;
  escalating: boolean;
  off_days_per_week: number;
  pot_destination: string | null;
  start_date: string;
  end_date: string;
  timezone: string;
  created_by: string;
  created_at: string;
};

export type Member = {
  pact_id: string;
  user_id: string;
  status: "invited" | "active";
  invited_by: string | null;
  starts_on: string | null;
  joined_at: string | null;
  profile: Profile;
};

export type Checkin = {
  id: string;
  pact_id: string;
  user_id: string;
  day: string;
  status: CheckStatus;
  value: number | null;
  note: string | null;
  proof_path: string | null;
  created_at: string;
  updated_at: string;
};

export type Doubt = {
  id: string;
  checkin_id: string;
  pact_id: string;
  doubter_id: string;
  status: "open" | "proved" | "confessed";
  created_at: string;
  resolved_at: string | null;
};

export type Reaction = {
  checkin_id: string;
  pact_id: string;
  user_id: string;
  emoji: string;
};

export type Friendship = {
  id: string;
  requester: string;
  addressee: string;
  status: "pending" | "accepted";
  created_at: string;
};
