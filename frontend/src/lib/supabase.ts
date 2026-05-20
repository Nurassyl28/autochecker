import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

export interface DbMessage {
  id: string;
  room_id: string;
  sender: string;
  sender_name: string;
  sender_role: "teacher" | "student";
  text: string;
  created_at: string;
}
